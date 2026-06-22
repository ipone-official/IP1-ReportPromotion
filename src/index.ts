import 'dotenv/config';
import express from 'express';
import { middleware, messagingApi, WebhookEvent } from '@line/bot-sdk';
import * as flow from './flow/flow';
import { loadMaster, masterReady, aliasRows } from './infra/master';
import { setEnglishAliases } from './domain/store-resolve';
import { ENGLISH_ALIASES } from './domain/english-aliases';

function applyEnglishAliases(): void {
  const enMap: Record<string, string[]> = {};
  for (const r of aliasRows) if (r.kind === 'english') (enMap[r.canonical] = enMap[r.canonical] || []).push(r.alias);
  setEnglishAliases(Object.keys(enMap).length ? enMap : ENGLISH_ALIASES);
}
import { getPhoto, setBaseUrl } from './infra/photoStore';
import { runOnce } from './infra/inflight';
import { Session } from './shared/types';
import { tagName } from './infra/nameTag';

const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

const client = new messagingApi.MessagingApiClient({ channelAccessToken });
const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken });

let botUserId = '';
client.getBotInfo().then((i: any) => { botUserId = i?.userId || ''; console.log('bot userId:', botUserId || '(ไม่ทราบ)'); }).catch((e: any) => console.error('getBotInfo error:', e?.message));

async function toBuffer(content: any): Promise<Buffer> {
  if (content && typeof content.arrayBuffer === 'function') return Buffer.from(await content.arrayBuffer());
  const chunks: Buffer[] = [];
  for await (const chunk of content as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

const processedEvents = new Set<string>();
function alreadyProcessed(id?: string): boolean {
  if (!id) return false;
  if (processedEvents.has(id)) return true;
  processedEvents.add(id);
  if (processedEvents.size > 5000) processedEvents.clear();
  return false;
}

const app = express();

app.use('/assets', express.static('assets'));
app.get('/', (_req, res) => res.send('IP1 Promo Report bot is running'));

app.get('/photo/:id', (req, res) => {
  const buf = getPhoto(req.params.id);
  if (!buf) return res.status(404).end();
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(buf);
});

const webhookStack = [
  (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    console.log(`[webhook] ${new Date().toLocaleTimeString()} ${req.method} ${req.path} — request เข้ามา`);
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    if (host) setBaseUrl(`${proto}://${host}`);
    next();
  },
  middleware({ channelSecret }),
  (req: express.Request, res: express.Response) => {
    const events: WebhookEvent[] = req.body.events || [];
    console.log(`[webhook] ✓ signature ผ่าน, ${events.length} events: ${events.map((e: any) => e.type).join(',')}`);
    res.sendStatus(200);
    Promise.all(events.map(handleEvent)).catch((e) => console.error('handleEvent error:', e?.message || e));
  },
];
app.post('/webhook', ...webhookStack);
app.post('/api/LineWebhook', ...webhookStack);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[webhook] ❌ middleware error (signature ไม่ตรง? channel secret ผิด?):', err?.message);
  if (!res.headersSent) res.sendStatus(200);
});

async function reply(replyToken: string, messages: any[]): Promise<boolean> {
  if (!messages || messages.length === 0) return true;
  try {
    await client.replyMessage({ replyToken, messages });
    return true;
  } catch (e: any) {
    console.error('reply error:', e?.statusCode, JSON.stringify(e?.body || e?.message));
    return false;
  }
}

async function push(to: string | undefined, messages: any[]): Promise<void> {
  if (!to || !messages?.length) return;
  try {
    await client.pushMessage({ to, messages });
  } catch (e: any) {
    console.error('push error:', e?.statusCode, JSON.stringify(e?.body || e?.message));
  }
}

async function replyOrPush(replyToken: string, to: string | undefined, messages: any[]): Promise<void> {
  if (!(await reply(replyToken, messages))) await push(to, messages);
}

const photoSummaryTimers = new Map<string, ReturnType<typeof setTimeout>>();
function queuePhotoSummary(key: string, to: string | undefined, s: Session, groupName?: string): void {
  const existing = photoSummaryTimers.get(key);
  if (existing) clearTimeout(existing);
  photoSummaryTimers.set(key, setTimeout(() => {
    photoSummaryTimers.delete(key);
    s.lastBotInteract = Date.now();
    let msgs = flow.ask(s, 'summary');
    if (groupName) { msgs = tagName(msgs, groupName); stampOwner(msgs, ownerTag(key.split(':').pop() || key)); }
    push(to, msgs);
  }, 2000));
}

const nameCache = new Map<string, string>();
async function getMemberName(groupId: string, userId: string): Promise<string> {
  const k = `${groupId}:${userId}`;
  if (nameCache.has(k)) return nameCache.get(k)!;
  try {
    const p: any = await (client as any).getGroupMemberProfile(groupId, userId);
    const name = p?.displayName || 'คุณ';
    nameCache.set(k, name);
    return name;
  } catch { return 'คุณ'; }
}
function ownerTag(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function stampOwner(node: any, tag: string): void {
  if (Array.isArray(node)) { for (const n of node) stampOwner(n, tag); return; }
  if (node && typeof node === 'object') {
    if ((node.type === 'postback' || node.type === 'datetimepicker') && typeof node.data === 'string') {
      try { const d = JSON.parse(node.data); d.o = tag; node.data = JSON.stringify(d); } catch {}
      delete node.displayText; // ในกลุ่ม: ไม่ echo ฟองข้อความตอนกด → คนอื่นกดแล้วเงียบสนิท (เจ้าของรู้ว่ากดติดจากการ์ดที่บอทตอบ)
    } else {
      for (const k of Object.keys(node)) stampOwner(node[k], tag);
    }
  }
}

async function respond(event: WebhookEvent, messages: any[]): Promise<void> {
  if (!messages?.length) return;
  const src = (event as any).source || {};
  const groupId = src.groupId || src.roomId;
  const userId = src.userId || 'anon';
  let msgs = messages;
  if (groupId) {
    msgs = tagName(msgs, await getMemberName(groupId, userId));
    stampOwner(msgs, ownerTag(userId));
    const m: any = (event as any).message;
    const qt = event.type === 'message' && m?.type === 'text' ? m.quoteToken : undefined;
    if (qt && msgs[0]?.type === 'text') msgs = [{ ...msgs[0], quoteToken: qt }, ...msgs.slice(1)];
  }
  await replyOrPush((event as any).replyToken, groupId || userId, msgs);
}

async function postbackMessages(s: Session, data: any, event: any): Promise<any[]> {
  if (data.s === 'save') return await flow.onSave(s);
  if (data.s === 'restart') return flow.confirmRestart(s);
  if (data.s === 'dorestart') return flow.onRestartExit(s);
  if (data.s === 'picktopic') return await flow.onPickTopic(s, data.v);
  if (data.s === 'back') return flow.goBack(s);
  if (data.s === 'exit') return flow.onExit(s);
  if (data.s === 'doexit') return flow.endSession(s);
  if (data.s === 'resume') return flow.onResume(s);
  if (data.s === 'addphoto') return flow.ask(s, 'photo');
  if (data.s === 'edit') return flow.onEdit();
  if (data.s === 'editfield') return flow.onEditField(s, data.v);
  if (data.s === 'editproducts') return flow.onEditProducts(s);
  if (data.s === 'edititem') return flow.onEditItem(s, Number(data.v));
  if (data.s === 'edititemtype') return flow.onEditItemType(s, Number(data.v));
  if (data.s === 'edititemfield') return flow.onEditItemField(s, Number(data.i), data.f, data.v);
  if (data.s === 'edititemmore') return flow.onEditItemMore(s, Number(data.i));
  if (data.s === 'confirmitemapprox') return flow.onConfirmItemApprox(s, Number(data.i), data.f);
  if (data.s === 'delitem') return flow.onDelItem(s, Number(data.v));
  if (data.s === 'additem') return flow.onAddItem(s);
  if (data.s === 'addfield') return flow.onAddItemField(s, data.f);
  if (data.s === 'clritem') return flow.onClearItemField(s, Number(data.i), data.f);
  if (data.s === 'clrfield') return flow.onClearField(s, data.f);
  if (data.s === 'editextra') return flow.onEditExtra(s, Number(data.i));
  if (data.s === 'delextra') return flow.onDelExtra(s, Number(data.i));
  if (data.s === 'addextra') return flow.onAddExtra(s);
  if (data.s === 'storepick') return flow.onStorePick(s, data.a, data.b);
  if (data.s === 'usebranch') return flow.onUseBranch(s, data.v);
  if (data.s === 'usestore') return flow.onUseStore(s, data.f, data.v);
  if (data.s === 'delphoto') return flow.onDelReportPhoto(s, Number(data.ki));
  if (data.s === 'tosummary') return flow.ask(s, 'summary');
  if (data.s === 'example') return flow.onExample();
  if (data.s === 'guided') return flow.onGuided(s);
  const date = event.postback?.params?.date;
  if (date) return flow.onDate(s, data.s, date);
  return flow.onSelect(s, data.s, data.v);
}

function sessionKeyOf(event: WebhookEvent): string {
  const src = (event as any).source || {};
  const groupId = src.groupId || src.roomId;
  const userId = src.userId || 'anon';
  return groupId ? `${groupId}:${userId}` : userId;
}

function signatureOf(event: WebhookEvent): string {
  if (event.type === 'postback') return (event as any).postback?.data || 'postback';
  if (event.type === 'message') {
    const m = (event as any).message;
    return m?.type === 'text' ? 'txt:' + (m.text || '') : 'msg:' + (m?.type || '');
  }
  return event.type;
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  const rt = (event as any).replyToken;
  const mutating = event.type === 'postback';
  try {
    if (mutating) await runOnce(sessionKeyOf(event), signatureOf(event), () => handleEventCore(event));
    else await handleEventCore(event);
  } catch (e: any) {
    console.error('handleEvent error:', e?.message, e?.stack);
    const errMsg = [{ type: 'text', text: 'ขออภัยครับ ระบบประมวลผลไม่สำเร็จชั่วคราว กรุณาส่งข้อความเดิมอีกครั้งครับ' }];
    const src = (event as any).source || {};
    const to = src.userId || src.groupId || src.roomId;
    const ok = rt ? await reply(rt, errMsg) : false;
    if (!ok) await push(to, errMsg);
  }
}

async function handleEventCore(event: WebhookEvent) {
  if (alreadyProcessed((event as any).webhookEventId)) return;
  const rt = (event as any).replyToken;
  if (!masterReady() && rt) {
    return reply(rt, [{ type: 'text', text: 'ระบบกำลังเชื่อมต่อฐานข้อมูล ขออภัยครับ รอสักครู่แล้วลองพิมพ์ใหม่อีกครั้ง' }]);
  }
  const src = (event as any).source || {};
  const groupId = src.groupId || src.roomId;
  const userId = src.userId || 'anon';
  const inGroup = !!groupId;
  const sessionKey = groupId ? `${groupId}:${userId}` : userId;
  const s = await flow.loadSession(sessionKey);

  try {
  if (event.type === 'follow') {
    return respond(event, flow.start(s));
  }
  if (event.type === 'join') {
    return reply(event.replyToken, [{ type: 'text', text: 'ระบบแจ้งโปรโมชั่น IP1 พร้อมใช้งานในกลุ่มแล้วครับ\nแท็กบอท (พิมพ์ @ แล้วเลือกบอท) เพื่อเริ่มแจ้งรายงาน — เลือกหัวข้อ แล้วพิมพ์รายละเอียดได้เลย' }]);
  }

  if (event.type === 'postback') {
    let data: any = {};
    try { data = JSON.parse(event.postback.data); } catch {}
    if (inGroup && data.o && data.o !== ownerTag(userId)) return; // คนอื่นกดการ์ดเรา → เงียบ ไม่ตอบ
    s.lastBotInteract = Date.now();
    return respond(event, await postbackMessages(s, data, event));
  }

  if (event.type === 'message') {
    if (event.message.type === 'text') {
      let txt = event.message.text || '';
      const activeFlow = !!(s.step || s.askingMore || s.awaitingText);
      if (inGroup) {
        const mentioned = (event.message as any).mention?.mentionees?.some((m: any) => m.isSelf || m.type === 'all' || (!!botUserId && m.userId === botUserId));
        const grace = Date.now() - (s.lastBotInteract || 0) < 5 * 60 * 1000;
        if (!mentioned && !activeFlow && !grace) return;
        if (!mentioned && !activeFlow) s.lastBotInteract = 0;
        const mentionees = (event.message as any).mention?.mentionees;
        if (Array.isArray(mentionees) && mentionees.length) {
          for (const mz of [...mentionees].sort((a, b) => (b.index || 0) - (a.index || 0))) {
            if (typeof mz.index === 'number' && typeof mz.length === 'number') txt = txt.slice(0, mz.index) + txt.slice(mz.index + mz.length);
          }
        }
        txt = txt.replace(/@\S+\s*/g, '').trim();
        if (!txt) {
          s.lastBotInteract = Date.now();
          return respond(event, activeFlow ? flow.ask(s, s.step || 'summary') : flow.startReport(s));
        }
        return respond(event, await flow.onText(s, txt));
      }
      if (!activeFlow && !s.topicName) return respond(event, flow.startReport(s));
      return respond(event, await flow.onText(s, txt));
    }
    if (event.message.type === 'image') {
      const photoGrace = Date.now() - (s.lastBotInteract || 0) < 5 * 60 * 1000;
      if (inGroup && s.step !== 'photo' && !s.askingMore && !s.topicName && !photoGrace) return;
      try {
        const content = await blobClient.getMessageContent(event.message.id);
        const buf = await toBuffer(content);
        const msgs = flow.onImage(s, { data: buf, type: 'image' });
        if (msgs.length) return respond(event, msgs);
        const gname = inGroup ? await getMemberName(groupId!, userId) : undefined;
        return queuePhotoSummary(sessionKey, groupId || userId, s, gname);
      } catch (e: any) {
        console.error('image fetch error:', e?.message);
        return respond(event, flow.onImage(s));
      }
    }
    if (inGroup && !s.step) return;
    if (s.step) return respond(event, [{ type: 'text', text: 'รองรับเฉพาะข้อความ/รูปครับ ถ้าจะแนบรูปกดปุ่ม "แนบรูป"' }, ...flow.ask(s, s.step)]);
    if (!inGroup) return respond(event, flow.start(s));
    return;
  }
  } finally {
    await flow.saveSession(s);
  }
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`bot running on :${port}/webhook`));

async function initMaster(attempt = 1): Promise<void> {
  try {
    await loadMaster();
    applyEnglishAliases();
  } catch (e: any) {
    const wait = Math.min(30000, 2000 * attempt);
    console.error(`master: โหลดไม่สำเร็จ (ครั้งที่ ${attempt}) — ${e?.message}; ลองใหม่ใน ${Math.round(wait / 1000)}s`);
    setTimeout(() => initMaster(attempt + 1), wait).unref();
  }
}
initMaster();

setInterval(() => { loadMaster().then(() => applyEnglishAliases()).catch((e) => console.error('master refresh error:', e?.message)); }, 10 * 60 * 1000).unref();


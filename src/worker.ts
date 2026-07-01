import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { WebhookEvent } from '@line/bot-sdk';
import * as flow from './flow/flow';
import { loadMaster, masterReady, aliasRows } from './infra/master';
import { autoPromoteBrands } from './infra/auto-promote';
import { setEnglishAliases } from './domain/store-resolve';
import { ENGLISH_ALIASES } from './domain/english-aliases';
import { runOnce } from './infra/inflight';
import { envNumber } from './infra/env';
import { logLatency } from './infra/timing';
import {
  respond,
  reply,
  push,
  queuePhotoSummary,
  getMemberName,
  ownerTag,
  stampOwner,
  toBuffer,
  blobClient,
  botUserId
} from './infra/lineClient';
import { Session } from './shared/types';

function applyEnglishAliases(): void {
  const enMap: Record<string, string[]> = {};
  for (const r of aliasRows) if (r.kind === 'english') (enMap[r.canonical] = enMap[r.canonical] || []).push(r.alias);
  setEnglishAliases(Object.keys(enMap).length ? enMap : ENGLISH_ALIASES);
}

async function initMaster(attempt = 1): Promise<void> {
  try {
    await loadMaster();
    applyEnglishAliases();
    try {
      const { syncMasterToMeilisearch } = await import('./infra/meilisearch');
      await syncMasterToMeilisearch();
    } catch (err: any) {
      console.warn('Meilisearch sync skipped:', err.message);
    }
    console.log('Worker: Master data loaded successfully');
  } catch (e: any) {
    const wait = Math.min(30000, 2000 * attempt);
    console.error(`Worker: Master load failed (attempt ${attempt}) - ${e?.message}; retry in ${Math.round(wait / 1000)}s`);
    setTimeout(() => initMaster(attempt + 1), wait).unref();
  }
}
initMaster();
setInterval(() => {
  // self-improving: ดูดยี่ห้อใหม่จากรายงานจริง → reload master → sync ทุก 10 นาที
  autoPromoteBrands()
    .then(() => loadMaster())
    .then(async () => {
      applyEnglishAliases();
      try {
        const { syncMasterToMeilisearch } = await import('./infra/meilisearch');
        await syncMasterToMeilisearch();
      } catch { }
    })
    .catch((e) => console.error('Worker master refresh error:', e?.message));
}, 10 * 60 * 1000).unref();

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
  if (data.s === 'togglesubtype') return flow.onToggleReportSubtype(s, data.v);
  if (data.s === 'subtypedone') return flow.onReportSubtypeDone(s);
  if (data.s === 'subtypeclear') return flow.onReportSubtypeClear(s);
  if (data.s === 'delitem') return flow.onDelItem(s, Number(data.v));
  if (data.s === 'additem') return flow.onAddItem(s);
  if (data.s === 'addfield') return flow.onAddItemField(s, data.f);
  if (data.s === 'clritem') return flow.onClearItemField(s, Number(data.i), data.f);
  if (data.s === 'clrfield') return flow.onClearField(s, data.f);
  if (data.s === 'noend') return flow.onNoEndDate(s);
  if (data.s === 'editextra') return flow.onEditExtra(s, Number(data.i));
  if (data.s === 'delextra') return flow.onDelExtra(s, Number(data.i));
  if (data.s === 'addextra') return flow.onAddExtra(s);
  if (data.s === 'storepick') return flow.onStorePick(s, data.a, data.b);
  if (data.s === 'usebranch') return flow.onUseBranch(s, data.v);
  if (data.s === 'usestore') return flow.onUseStore(s, data.f, data.v);
  if (data.s === 'delphoto') return await flow.onDelReportPhoto(s, Number(data.ki));
  if (data.s === 'tosummary') return flow.ask(s, 'summary');
  if (data.s === 'example') return flow.onExample();
  if (data.s === 'guided') return flow.onGuided(s);
  const date = event.postback?.params?.date;
  if (date) return flow.onDate(s, data.s, date);
  return flow.onSelect(s, data.s, data.v);
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  const rt = (event as any).replyToken;
  const mutating = event.type === 'postback';
  try {
    if (mutating) await runOnce(sessionKeyOf(event), signatureOf(event), () => handleEventCore(event));
    else await handleEventCore(event);
  } catch (e: any) {
    console.error('handleEvent error:', e?.message, e?.stack);
    try {
      const errMsg = [{ type: 'text', text: 'ขออภัยครับ ระบบประมวลผลไม่สำเร็จชั่วคราว กรุณาส่งข้อความเดิมอีกครั้งครับ' }];
      const src = (event as any).source || {};
      const to = src.userId || src.groupId || src.roomId;
      const ok = rt ? await reply(rt, errMsg) : false;
      if (!ok && to) await push(to, errMsg);
    } catch (replyErr: any) {
      console.error('handleEvent: failed to send error message:', replyErr?.message);
    }
  }
}

async function handleEventCore(event: WebhookEvent) {
  if (!masterReady()) {
    console.log('Worker: master data not ready yet, throwing error to retry');
    throw new Error('master not ready');
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
      try { data = JSON.parse(event.postback.data); } catch { }
      if (inGroup && data.o && data.o !== ownerTag(userId)) return;
      s.lastBotInteract = Date.now();
      return respond(event, await postbackMessages(s, data, event));
    }

    if (event.type === 'message') {
      if (event.message.type === 'text') {
        let txt = event.message.text || '';
        const activeFlow = !!(s.step || s.askingMore || s.awaitingText);
        if (inGroup) {
          const mentionees = (event.message as any).mention?.mentionees;
          const hasMentions = Array.isArray(mentionees) && mentionees.length > 0;
          const mentioned = hasMentions && mentionees.some((m: any) => m.isSelf || m.type === 'all' || (!!botUserId && m.userId === botUserId));
          const inReport = activeFlow || !!s.topicName;
          // ในกลุ่ม: ตอบเฉพาะตอนถูกแท็ก หรือกำลังกรอกรายงานอยู่จริง — ข้อความอื่น (แท็กคนอื่น/พิมพ์เล่น) เงียบหมด
          if (!mentioned && !inReport) return;
          if (hasMentions) {
            for (const mz of [...mentionees].sort((a: any, b: any) => (b.index || 0) - (a.index || 0))) {
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
        // ในกลุ่ม: รับรูปเฉพาะตอนกำลังกรอกรายงานอยู่จริง (รูปไม่มีการแท็ก) — รูปอื่นในกลุ่มเงียบ
        if (inGroup && s.step !== 'photo' && !s.askingMore && !s.topicName) return;
        try {
          const content = await blobClient.getMessageContent(event.message.id);
          const buf = await toBuffer(content);
          const msgs = await flow.onImage(s, { data: buf, type: 'image' });
          if (msgs.length) return respond(event, msgs);
          const gname = inGroup ? await getMemberName(groupId!, userId) : undefined;
          return queuePhotoSummary(sessionKey, groupId || userId, s, gname);
        } catch (e: any) {
          console.error('image fetch error:', e?.message);
          return respond(event, await flow.onImage(s));
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

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
const worker = new Worker('line-webhook-events', async (job) => {
  const event = job.data as WebhookEvent;
  const started = Date.now();
  console.log(`Worker: Processing event (id: ${(event as any).webhookEventId || job.id}, type: ${event.type})`);
  await handleEvent(event);
  logLatency('worker.event', started, { type: event.type, id: (event as any).webhookEventId || job.id });
}, {
  connection: redisConnection as any,
  concurrency: envNumber('WORKER_CONCURRENCY', 5, 1)
});

worker.on('failed', (job, err) => {
  console.error(`Worker: Job ${job?.id} failed with error: ${err.message}`);
});

console.log('Worker: Line event consumer started');

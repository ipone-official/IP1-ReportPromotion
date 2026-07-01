import { messagingApi } from '@line/bot-sdk';
import * as flow from '../flow/flow';
import { tagName } from './nameTag';
import { Session } from '../shared/types';
import { envNumber } from './env';
import { withTimeout } from './timing';
import { G } from '../view/theme';
import { getUserColor } from './userColor';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const memberProfileTimeoutMs = envNumber('LINE_PROFILE_TIMEOUT_MS', 2500, 100);
const fallbackMemberName = 'คุณ';

export const client = new messagingApi.MessagingApiClient({ channelAccessToken });
export const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken });

export let botUserId = '';
client.getBotInfo()
  .then((i: any) => {
    botUserId = i?.userId || '';
    console.log('bot userId:', botUserId || '(unknown)');
  })
  .catch((e: any) => console.error('getBotInfo error:', e?.message));

export async function toBuffer(content: any): Promise<Buffer> {
  if (content && typeof content.arrayBuffer === 'function') return Buffer.from(await content.arrayBuffer());
  const chunks: Buffer[] = [];
  for await (const chunk of content as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function reply(replyToken: string, messages: any[]): Promise<boolean> {
  if (!messages || messages.length === 0) return true;
  try {
    await client.replyMessage({ replyToken, messages });
    return true;
  } catch (e: any) {
    console.error('reply error:', e?.statusCode, JSON.stringify(e?.body || e?.message));
    return false;
  }
}

export async function push(to: string | undefined, messages: any[]): Promise<void> {
  if (!to || !messages?.length) return;
  try {
    await client.pushMessage({ to, messages });
  } catch (e: any) {
    console.error('push error:', e?.statusCode, JSON.stringify(e?.body || e?.message));
  }
}

export async function replyOrPush(replyToken: string, to: string | undefined, messages: any[]): Promise<void> {
  if (!(await reply(replyToken, messages))) await push(to, messages);
}

export const photoSummaryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function queuePhotoSummary(key: string, to: string | undefined, s: Session, groupName?: string): void {
  const existing = photoSummaryTimers.get(key);
  if (existing) clearTimeout(existing);
  photoSummaryTimers.set(key, setTimeout(() => {
    photoSummaryTimers.delete(key);
    s.lastBotInteract = Date.now();
    let msgs = flow.ask(s, 'summary');
    if (groupName) {
      const uid = key.split(':').pop() || key;
      msgs = tagName(msgs, groupName);
      stampOwner(msgs, ownerTag(uid));
      stampColor(msgs, getUserColor(uid));
    }
    push(to, msgs);
  }, 2000));
}

export const nameCache = new Map<string, string>();

export async function getMemberName(groupId: string, userId: string): Promise<string> {
  const k = `${groupId}:${userId}`;
  if (nameCache.has(k)) return nameCache.get(k)!;
  const fetchProfile = (async () => {
    const p: any = await (client as any).getGroupMemberProfile(groupId, userId);
    const name = p?.displayName || fallbackMemberName;
    nameCache.set(k, name);
    return name;
  })().catch((e: any) => { console.error('getMemberName error:', e?.statusCode || '', e?.message || e); return fallbackMemberName; });
  return withTimeout(fetchProfile, memberProfileTimeoutMs, fallbackMemberName);
}

export function ownerTag(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function stampOwner(node: any, tag: string): void {
  if (Array.isArray(node)) {
    for (const n of node) stampOwner(n, tag);
    return;
  }
  if (node && typeof node === 'object') {
    if ((node.type === 'postback' || node.type === 'datetimepicker') && typeof node.data === 'string') {
      try {
        const d = JSON.parse(node.data);
        d.o = tag;
        node.data = JSON.stringify(d);
      } catch {}
      delete node.displayText;
    } else {
      for (const k of Object.keys(node)) stampOwner(node[k], tag);
    }
  }
}

// เปลี่ยนแถบสีหัวการ์ด (G.accent) เป็นสีประจำตัวผู้ใช้ → ในกลุ่มจะดูออกว่าการ์ดไหนของใคร
export function stampColor(node: any, color: string): void {
  if (Array.isArray(node)) {
    for (const n of node) stampColor(n, color);
    return;
  }
  if (node && typeof node === 'object') {
    if (node.backgroundColor === G.accent) node.backgroundColor = color;
    for (const k of Object.keys(node)) stampColor(node[k], color);
  }
}

export async function respond(event: any, messages: any[]): Promise<void> {
  if (!messages?.length) return;
  const src = event.source || {};
  const groupId = src.groupId || src.roomId;
  const userId = src.userId || 'anon';
  let msgs = messages;
  if (groupId) {
    msgs = tagName(msgs, await getMemberName(groupId, userId));
    stampOwner(msgs, ownerTag(userId));
    stampColor(msgs, getUserColor(userId));
    const m: any = event.message;
    const qt = event.type === 'message' && m?.type === 'text' ? m.quoteToken : undefined;
    if (qt && msgs[0]?.type === 'text') msgs = [{ ...msgs[0], quoteToken: qt }, ...msgs.slice(1)];
  }
  await replyOrPush(event.replyToken, groupId || userId, msgs);
}

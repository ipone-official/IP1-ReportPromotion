import * as D from '../infra/master';
import * as AI from '../infra/ai';
import { matchMaster, norm } from '../domain/match';
import { saveReport, sqlEnabled, logParse } from '../infra/db';
import { savePhoto, deletePhotos } from '../infra/photoStore';
import { ORDER, PRODUCT_STEPS } from '../shared/steps';
import { Session, ReportItem } from '../shared/types';
import { resolveStore, nearbyAccounts } from '../domain/store-resolve';
import { loadSessionState, saveSessionState, clearSessionState } from '../infra/sessionStore';
import {
  buildItem, mergeParsed, normalizeDate, addApprox, dropApprox, applyStoreChannel,
  itemDesc, sessionSnapshot, setItemField,
} from '../domain/items';
import { firstMissing, saveBlockers, wantedMissing, parseSkipFields } from './completeness';
import { parseEditCommand, EditCmd } from './edit';
import {
  text, promptText, promptCard, selectCard, searchCard, dateCard, photoCard, detailCard,
  summaryFlex, welcomeCard, topicPickCard, topicReadyCard, editPicker, savedCard, confirmCard,
  storeSelectCard, notFoundCard, didYouMeanCard, branchDidYouMeanCard, productEditPicker, itemActionCard, itemFieldPicker, askMoreText, exitCard,
} from '../view/cards';
import { ask, afterField, optionsFor, continueLoop, clearField } from './nav';
export { ask } from './nav';
import { applyItemFieldValue, applyItemFieldText, ITEM_FIELD_LABEL, editItemFromText, onExtraText } from './item-edit';

export { resolveStore } from '../domain/store-resolve';
export { buildItem, mergeParsed } from '../domain/items';
export type { Session } from '../shared/types';
export { onImage, onDelReportPhoto } from './photo';
export { onEdit, onEditField, onEditProducts, onEditItem, onDelItem, onEditItemType, onAddItem, onAddItemField, onEditItemField, onEditItemMore, onConfirmItemApprox, onClearItemField, onEditExtraList, onDelExtra, onEditExtra, onAddExtra } from './item-edit';

const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { current: {}, items: [], photoCount: 0, asked: [], userId: id };
    sessions.set(id, s);
  }
  s.lastSeen = Date.now();
  return s;
}

export async function loadSession(id: string): Promise<Session> {
  let s = sessions.get(id);
  if (!s) {
    const json = await loadSessionState(id);
    if (json) { try { s = JSON.parse(json) as Session; } catch { s = undefined; } }
    if (!s) s = { current: {}, items: [], photoCount: 0, asked: [], userId: id };
    s.userId = id;
    sessions.set(id, s);
  }
  s.lastSeen = Date.now();
  return s;
}

export async function saveSession(s: Session): Promise<void> {
  if (!s.userId) return;
  try { await saveSessionState(s.userId, JSON.stringify(s)); } catch (e: any) { console.warn('saveSession:', e?.message); }
}

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if ((s.lastSeen || 0) < cutoff) { sessions.delete(id); clearSessionState(id).catch(() => {}); }
}, 30 * 60 * 1000).unref();

function resetSession(s: Session) {
  s.step = undefined;
  s.awaitingText = undefined;
  s.topicCode = undefined;
  s.topicName = undefined;
  s.channel = undefined;
  s.account = undefined;
  s.branch = undefined;
  s.storeNew = undefined;
  s.company = undefined;
  s.current = {};
  s.items = [];
  s.startDate = undefined;
  s.endDate = undefined;
  s.photoCount = 0;
  s.photoKeys = [];
  s.asked = [];
  s.rawText = undefined;
  s.pendingReport = undefined;
  s.fillingMissing = false;
  s.askingMore = false;
  s.skipMore = false;
  s.skippedFields = undefined;
  s.askRounds = 0;
  s.pendingFields = undefined;
  s.storeCands = undefined;
  s.editItemIndex = undefined;
  s.editExtraIndex = undefined;
  s.editing = false;
  s.editTarget = undefined;
  s.approx = undefined;
  s.extra = undefined;
  s.savedReportId = undefined;
}

export function start(s: Session): any[] {
  resetSession(s);
  return [welcomeCard()];
}

export function startReport(s: Session, pending?: string): any[] {
  if (s.step !== 'topic') resetSession(s);
  if (pending && pending.trim()) s.pendingReport = pending.trim();
  s.step = 'topic';
  if (s.asked[s.asked.length - 1] !== 'topic') s.asked.push('topic');
  return [topicPickCard(D.topics.map((t) => t.name))];
}

export function goBack(s: Session): any[] {
  if (s.editing) { s.editing = false; return ask(s, 'summary'); }
  s.asked.pop();
  const prev = s.asked.pop();
  if (!prev) return s.items.length || s.topicName ? ask(s, 'summary') : start(s);
  clearField(s, prev);
  return ask(s, prev);
}

export function onSelect(s: Session, step: string, value: string): any[] {
  if (s.editTarget) {
    if (value === 'อื่นๆ') { s.awaitingText = 'itemfield'; return [promptCard(ITEM_FIELD_LABEL[s.editTarget.field] || 'ข้อมูล', 'พิมพ์ในช่องแชทด้านล่างได้เลยครับ')]; }
    return applyItemFieldValue(s, s.editTarget.i, s.editTarget.field, value);
  }
  if (value === 'อื่นๆ' && step !== 'addMore') {
    s.awaitingText = step; s.step = step;
    const lbl: Record<string, string> = { company: 'ชื่อบริษัท', account: 'ชื่อห้าง/ร้าน', branch: 'ชื่อสาขา' };
    return [promptCard(ITEM_FIELD_LABEL[step] || lbl[step] || 'ข้อมูล', 'พิมพ์ในช่องแชทด้านล่างได้เลยครับ')];
  }
  switch (step) {
    case 'topic': s.topicName = value; s.topicCode = D.topicCode(value); dropApprox(s, 'topic'); break;
    case 'channel': s.channel = value; dropApprox(s, 'channel'); break;
    case 'account': s.account = value; s.storeNew = false; dropApprox(s, 'store'); break;
    case 'branch': s.branch = value; s.storeNew = false; dropApprox(s, 'store'); break;
    case 'company': s.company = value; dropApprox(s, 'company'); break;
    case 'category': s.current.category = value; break;
    case 'subCategory': s.current.subCategory = value; break;
    case 'brand': s.current.brand = value; break;
    case 'size': s.current.size = value; break;
    case 'pack': s.current.pack = value; break;
    case 'variant': s.current.variant = value; break;
    case 'addMore':
      if (s.current.subCategory || s.current.brand) s.items.push({ ...s.current });
      s.current = {};
      if (value.includes('เพิ่ม')) return ask(s, 'category');
      if (s.editing) { s.editing = false; return ask(s, 'summary'); }
      return ask(s, 'startDate');
    case 'reportType': s.current.reportType = value; break;
    case 'reportSubtype': s.current.reportSubtype = value; break;
  }
  if (step === 'account' || step === 'branch') applyStoreChannel(s);
  return afterField(s, step);
}

export async function onPickTopic(s: Session, value: string): Promise<any[]> {
  s.topicName = value;
  s.topicCode = D.topicCode(value);
  dropApprox(s, 'topic');
  if (s.editing) { s.editing = false; s.step = 'summary'; return [summaryFlex(s)]; }
  const pending = s.pendingReport; s.pendingReport = undefined;
  s.step = undefined;
  if (s.topicCode === 'etc' && !pending) {
    s.awaitingText = 'customtopic';
    return [promptCard('เรื่องอื่นๆ', 'พิมพ์ชื่อหัวข้อที่ต้องการแจ้งได้เลยครับ')];
  }
  if (pending) return fastParse(s, pending);
  return [topicReadyCard(value)];
}

export function endSession(s: Session): any[] {
  resetSession(s);
  return [exitCard()];
}

export function onRestartExit(s: Session): any[] {
  resetSession(s);
  return [exitCard('ล้างข้อมูลแล้ว')];
}

export function onExit(s: Session): any[] {
  if (s.items.length || s.topicName) return [confirmCard('doexit', 'หากออกจากระบบ ข้อมูลที่กรอกไว้ทั้งหมดจะหายไป ต้องการยืนยันหรือไม่', 'ออก')];
  return endSession(s);
}

export function confirmRestart(s: Session): any[] {
  if (s.items.length || s.topicName) return [confirmCard('dorestart', 'ล้างข้อมูลที่กรอกไว้ทั้งหมดและออกจากระบบ ต้องการยืนยันหรือไม่', 'ล้างข้อมูล')];
  return onRestartExit(s);
}

export function onResume(s: Session): any[] {
  return ask(s, s.step || 'summary');
}

export function onExample(): any[] {
  return [text('ตัวอย่างการพิมพ์ (แทนค่าในวงเล็บเหลี่ยมด้วยข้อมูลจริงของคุณ):\n\nแจ้ง [ชื่อห้าง] [สาขา]\n[ยี่ห้อสินค้า] [ขนาด] [ราคา/ลด/โปร]\n[ยี่ห้อสินค้า] [ขนาด] [แพ็ค] [ราคา]\n[วันเริ่ม]-[วันจบ] บริษัท [ชื่อบริษัท]\n\nพิมพ์กี่สินค้าก็ได้ ระบบจะแยกรายการให้อัตโนมัติ หากข้อมูลไม่ครบ ระบบจะสอบถามเพิ่มเติมครับ')];
}

export function onGuided(s: Session): any[] {
  return ask(s, firstMissing(s) || 'topic');
}

export function onDate(s: Session, step: string, date: string): any[] {
  const d = normalizeDate(date);
  if (!d) return [text('วันที่ไม่ถูกต้อง กรุณาเลือกใหม่อีกครั้งครับ'), ...ask(s, step)];
  if (step === 'startDate') {
    s.startDate = d; if (s.endDate && s.endDate < d) s.endDate = undefined;
    return [];
  }
  if (step === 'endDate') {
    if (s.startDate && d < s.startDate) return [text('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม กรุณาเลือกใหม่ครับ'), ...ask(s, 'endDate')];
    s.endDate = d;
  }
  return afterField(s, step);
}

function matchFieldText(s: Session, f: string, x: string): any[] {
  if (f === 'detail') { s.current.detail = x; return afterField(s, 'detail'); }
  if (f === 'account') return matchAccountText(s, x);
  if (f === 'branch') return matchBranchText(s, x);
  const opts = (optionsFor(f, s) || []).filter((o) => o !== 'อื่นๆ');
  if (opts.length) {
    const m = matchMaster(x, opts);
    if (m.best) return onSelect(s, f, m.best);
    if (m.candidates.length) { // กำกวม → ให้เลือกจากที่ใกล้เคียง
      s.step = f;
      return [text('กรุณาเลือกตัวเลือกที่ถูกต้อง หรือพิมพ์ใหม่อีกครั้งครับ'), selectCard(f, s, m.candidates.map((c) => c.value).slice(0, 12))];
    }
  }
  if (['size', 'variant', 'pack', 'category', 'subCategory', 'reportType', 'reportSubtype'].includes(f)) { (s.current as any)[f] = x; return afterField(s, f); }
  if (f === 'company') { s.company = x; dropApprox(s, 'company'); return afterField(s, 'company'); }
  s.awaitingText = f;
  return [text(`ไม่พบ "${x}" ในระบบครับ กรุณาพิมพ์ใหม่ หรือพิมพ์เพียงบางส่วนของชื่อ`)];
}

function matchAccountText(s: Session, x: string): any[] {
  const r = resolveStore(x);
  if (r.account) {
    s.storeNew = false;
    s.account = r.account;
    if (r.approx) addApprox(s, 'store'); else dropApprox(s, 'store');
    applyStoreChannel(s);
    if (r.branch) { s.branch = r.branch; return afterField(s, 'branch'); }
    s.branch = undefined;
    return afterField(s, 'account');
  }
  if (r.candidates?.length) {
    s.step = 'account';
    s.awaitingText = 'account';
    return [storeSelectCard(r.candidates, x)];
  }
  const near = nearbyAccounts(x);
  s.awaitingText = 'account';
  if (near.length) { s.step = 'account'; return [didYouMeanCard(x, near)]; }
  return [notFoundCard(x, 'account')];
}

function matchBranchText(s: Session, x: string): any[] {
  const opts = D.branchesByAccount[s.account || ''] || [];
  if (opts.length) {
    const m = matchMaster(x, opts);
    const nx = norm(x);
    if (m.best && (norm(m.best) === nx || norm(m.best).includes(nx))) return onSelect(s, 'branch', m.best);
    const near = [...new Set([...(m.best ? [m.best] : []), ...m.candidates.map((c) => c.value)])].slice(0, 5);
    if (near.length) { s.step = 'branch'; s.awaitingText = 'branch'; return [branchDidYouMeanCard(x, near, s.account || '')]; }
  }
  s.branch = x; dropApprox(s, 'store'); return afterField(s, 'branch');
}

export function onUseBranch(s: Session, value: string): any[] {
  s.branch = value;
  s.awaitingText = undefined;
  dropApprox(s, 'store');
  return afterField(s, 'branch');
}

export function onClearField(s: Session, step: string): any[] {
  if (step === 'date') { clearField(s, 'startDate'); clearField(s, 'endDate'); }
  else clearField(s, step);
  s.editing = false;
  s.awaitingText = undefined;
  s.step = 'summary';
  return [summaryFlex(s)];
}

export function onUseStore(s: Session, field: string, value: string): any[] {
  s.storeNew = true;
  s.awaitingText = undefined;
  dropApprox(s, 'store');
  if (field === 'branch') s.branch = value;
  else { s.account = value; s.branch = undefined; }
  const f = firstMissing(s);
  if (f) { s.fillingMissing = true; return ask(s, f); }
  const next = continueLoop(s);
  if (next) return [text('บันทึกเป็น "ร้านใหม่" แล้วครับ ทีมงานจะเพิ่มเข้าระบบให้'), ...next];
  return [text('บันทึกเป็น "ร้านใหม่" แล้วครับ ทีมงานจะเพิ่มเข้าระบบให้ กรุณาตรวจสอบ แล้วกดบันทึกรายงาน'), summaryFlex(s)];
}

export function onStorePick(s: Session, account: string, branch: string): any[] {
  s.account = account; s.storeNew = false; s.storeCands = undefined;
  dropApprox(s, 'store');
  applyStoreChannel(s);
  if (!branch) { s.branch = undefined; return afterField(s, 'account'); }
  s.branch = branch;
  return afterField(s, 'branch');
}

export async function onText(s: Session, t: string): Promise<any[]> {
  const x = (t || '').trim();

  if (/^(เริ่ม|เริ่มใหม่|start|ยกเลิก|reset)$/i.test(x)) return startReport(s);
  if (s.awaitingText === 'edititem') { s.awaitingText = undefined; return editItemFromText(s, x); }
  if (s.awaitingText === 'extra') return onExtraText(s, x);
  if (s.awaitingText === 'itemfield' && s.editTarget) return applyItemFieldText(s, x);
  if (s.awaitingText === 'customtopic') {
    if (!x) return [text('พิมพ์ชื่อหัวข้อที่ต้องการแจ้งได้เลยครับ')];
    s.awaitingText = undefined;
    s.topicName = x;
    s.step = undefined;
    return [topicReadyCard(x)];
  }
  if (s.awaitingText) {
    const f = s.awaitingText; s.awaitingText = undefined;
    return matchFieldText(s, f, x);
  }
  if (s.fillingMissing && s.step && optionsFor(s.step, s)) return matchFieldText(s, s.step, x);
  if (s.askingMore) {
    if (/^(ข้าม|ข้ามทั้งหมด|พอ|พอแล้ว|ครบแล้ว|จบ|skip|ไม่มี|ไม่มีแล้ว|ไม่รู้)$/i.test(x)) {
      s.askingMore = false; s.skipMore = true; s.step = 'summary';
      return [text('รับทราบครับ จัดทำสรุปให้แล้ว'), summaryFlex(s)];
    }
    const lines = x.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const skipKeys: string[] = []; const skipLabels: string[] = []; const blocked: string[] = [];
    const rest: string[] = [];
    for (const line of lines) {
      const mSkip = line.match(/^(?:ข้าม|ไม่มี|ไม่รู้)\s*(.+)$/);
      const sel = mSkip ? parseSkipFields(mSkip[1]) : null;
      if (sel) { skipKeys.push(...sel.keys); skipLabels.push(...sel.labels); blocked.push(...sel.blocked); }
      else rest.push(line);
    }
    const msgs: any[] = [];
    if (skipKeys.length) {
      s.skippedFields = [...new Set([...(s.skippedFields || []), ...skipKeys])];
      msgs.push(text(`รับทราบครับ ข้ามรายการ: ${[...new Set(skipLabels)].join(', ')}`));
    }
    if (blocked.length) msgs.push(text(`${[...new Set(blocked)].join(', ')} เป็นข้อมูลที่จำเป็น ไม่สามารถข้ามได้ครับ (สามารถแก้ไขหรือลบรายการแทนได้)`));
    if (rest.length) return [...msgs, ...(await fastParse(s, rest.join('\n')))];
    if (msgs.length) {
      const next = continueLoop(s);
      return next ? [...msgs, ...next] : [...msgs, summaryFlex(s)];
    }
    return fastParse(s, x);
  }
  if (!s.topicName) {
    const body = x.replace(/^\s*(แจ้ง|รายงาน|report)[:\s]*/i, '').trim();
    return startReport(s, body);
  }
  return fastParse(s, x);
}

async function applyEditCommand(s: Session, cmd: EditCmd): Promise<any[]> {
  const oob = (n: number): any[] => [text(`ไม่พบรายการที่ ${n} ครับ (ขณะนี้มี ${s.items.length} รายการ)`), summaryFlex(s)];
  if (cmd.op === 'delete') {
    if (cmd.n < 1 || cmd.n > s.items.length) return oob(cmd.n);
    s.items.splice(cmd.n - 1, 1); s.step = 'summary';
    return [text(s.items.length ? `ลบรายการที่ ${cmd.n} แล้วครับ` : `ลบรายการที่ ${cmd.n} แล้วครับ ขณะนี้ไม่มีรายการสินค้า กรุณาพิมพ์เพิ่มได้เลย`), summaryFlex(s)];
  }
  if (cmd.op === 'add') { s.editItemIndex = -1; return editItemFromText(s, cmd.text); }
  if (cmd.op === 'editItem') {
    if (cmd.n < 1 || cmd.n > s.items.length) return oob(cmd.n);
    setItemField(s.items[cmd.n - 1], cmd.field, cmd.value, s.topicCode || ''); s.step = 'summary';
    return [text(`แก้ไข${ITEM_FIELD_LABEL[cmd.field] || cmd.field} รายการที่ ${cmd.n} แล้วครับ`), summaryFlex(s)];
  }
  const f = cmd.field;
  if (f === 'channel') {
    const mm = matchMaster(cmd.value, D.channels); if (mm.best) { s.channel = mm.best; dropApprox(s, 'channel'); }
  } else if (f === 'dates' || f === 'startDate' || f === 'endDate') {
    const ctx = f === 'endDate' ? `ถึง ${cmd.value}` : f === 'startDate' ? `เริ่ม ${cmd.value}` : cmd.value;
    const ef = f === 'endDate' ? ['วันจบโปร'] : ['ช่วงวันที่'];
    s.rawText = (s.rawText ? s.rawText + '\n' : '') + ctx;
    const dp = await AI.parseReport(ctx, ef);
    mergeParsed(s, dp, false, ctx);
  } else {
    const p: any = {}; p[f] = cmd.value;
    mergeParsed(s, p, false, cmd.value);
  }
  s.step = 'summary';
  return [text('แก้ไขเรียบร้อยแล้วครับ กรุณาตรวจสอบความถูกต้อง แล้วกดบันทึกรายงาน'), summaryFlex(s)];
}

const REPORT_KW = /คู่แข่ง|สินค้าใหม่|โปรโมชั่น|กิจกรรม|บูธ|ลดราคา|แจ้ง/g;

function detectReportStore(p: any, x: string): string | undefined {
  const cands: string[] = [];
  if (p.account) cands.push(String(p.account));
  if (p.branch) cands.push(String(p.branch));
  for (const e of (Array.isArray(p.extra) ? p.extra : [])) { const v = typeof e === 'string' ? e : String(e?.value || ''); if (v) cands.push(v); }
  for (const seg of x.split(/[\/\n]+/).map((t) => t.trim()).filter((t) => t.length >= 3).slice(0, 4)) cands.push(seg);
  for (const c of cands) {
    for (const t of [c, c.replace(REPORT_KW, ' ').replace(/\s+/g, ' ').trim()]) {
      if (t.length < 3) continue;
      const r = resolveStore(t);
      if (r.account) return r.account;
    }
  }
  if (p.account && String(p.account).trim().length >= 3) return String(p.account).trim();
  return undefined;
}

async function fastParse(s: Session, x: string): Promise<any[]> {
  if (!s.askingMore && s.items.length) {
    const cmd = parseEditCommand(x);
    if (cmd) return applyEditCommand(s, cmd);
  }
  const fillMode = !!s.askingMore;
  const expectFields = fillMode ? s.pendingFields : undefined;
  s.rawText = (s.rawText ? s.rawText + '\n' : '') + x;
  let p: any;
  try {
    p = await AI.parseReport(x, expectFields);
  } catch (e) {
    console.error('AI error', e);
    logParse({ userId: s.userId, raw: x, outcome: 'ai_error' });
    const f = firstMissing(s);
    if (f) { s.fillingMissing = true; return [text('ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว ระบบสลับเป็นโหมดกดปุ่มให้แล้ว ข้อมูลที่พิมพ์ถูกบันทึกไว้เรียบร้อย'), ...ask(s, f)]; }
    if (s.items.length) return [text('ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว กรุณาใช้การ์ดสรุปด้านล่างเพื่อตรวจสอบและแก้ไข'), summaryFlex(s)];
    return [text('ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว กรุณาพิมพ์ใหม่อีกครั้ง หรือพิมพ์ "เริ่ม" เพื่อกรอกแบบกดปุ่ม')];
  }
  const logRound = (outcome: string, asked?: string[]) =>
    logParse({ userId: s.userId, raw: x, aiJson: p, merged: sessionSnapshot(s), askedFields: asked, outcome });

  if (/พิมพ์ผิด|เมื่อกี้\S{0,8}ผิด|ที่ถูก(?:คือ|ต้องเป็น|เป็น)|แก้เป็น|ขอแก้/.test(x) && s.items.length && Array.isArray(p.items) && p.items.length) {
    let applied = 0;
    for (const raw of p.items) {
      const ni = buildItem(raw, s.topicCode || '', x);
      const ex: any = ni.brand ? s.items.find((it) => it.brand === ni.brand) : (s.items.length === 1 ? s.items[0] : undefined);
      if (!ex) continue;
      for (const k of ['detail', 'size', 'pack', 'variant'] as const) {
        if (ni[k]) {
          ex[k] = ni[k]; applied++;
          if (ni.approx?.includes(k)) ex.approx = [...new Set([...(ex.approx || []), k])];
        }
      }
    }
    mergeParsed(s, { ...p, items: [] }, false, x);
    s.step = 'summary'; s.fillingMissing = false; s.askingMore = false; s.pendingFields = undefined;
    if (!applied && s.items.length > 1) { logRound('asked', ['เลือกรายการที่แก้']); return [text('กรุณาเลือกรายการที่ต้องการแก้ไขครับ'), productEditPicker(s)]; }
    logRound('summary');
    return [text('แก้ไขเรียบร้อยแล้วครับ กรุณาตรวจสอบอีกครั้ง แล้วกดบันทึกรายงาน'), summaryFlex(s)];
  }

  if (!fillMode && (s.items.length || s.extra?.length)) {
    const pHasContent = !!((p.items && p.items.length) || (Array.isArray(p.extra) ? p.extra.length : (p.extra ? 1 : 0)));
    const storeHere = detectReportStore(p, x);
    if (storeHere && pHasContent && norm(storeHere) !== norm(s.account || '')) {
      s.items = []; s.extra = []; s.startDate = undefined; s.endDate = undefined;
      s.company = undefined; s.photoKeys = []; s.photoCount = 0; s.approx = undefined; s.storeCands = undefined;
      s.account = undefined; s.branch = undefined; s.storeNew = undefined; s.channel = undefined;
      s.rawText = x;
    }
  }
  mergeParsed(s, p, fillMode, x);
  s.step = 'summary';
  s.fillingMissing = false;
  if (!s.account) {
    for (const seg of x.split(/[\/\n]+/).map((t) => t.trim()).filter((t) => t.length >= 3).slice(0, 6)) {
      const rr = resolveStore(seg);
      if (rr.account) { s.account = rr.account; if (rr.branch) s.branch = rr.branch; if (rr.approx) addApprox(s, 'store'); break; }
    }
  }
  const second = detectSecondStore(x, s.account);
  const warn: any[] = second
    ? [text(`พบ 2 ร้านในข้อความ ระบบรองรับ 1 ร้านต่อรายงาน รอบนี้บันทึก "${[s.account, s.branch].filter(Boolean).join(' ')}" ไว้ก่อน ส่วน "${second}" กรุณาแจ้งแยกอีกรายงานครับ`)]
    : [];
  if (s.storeCands?.length && !s.branch) { s.fillingMissing = true; logRound('asked', ['เลือกสาขา']); return [...warn, text('กรุณาเลือกสาขาที่ถูกต้องครับ'), storeSelectCard(s.storeCands)]; }
  if (!s.items.length && !s.extra?.length) { logRound('asked', ['เนื้อหา']); return [...warn, text('กรุณาพิมพ์รายละเอียดรายงานได้เลยครับ')]; }
  s.askingMore = false; s.step = 'summary'; s.fillingMissing = false;
  logRound('summary');
  return [...warn, summaryFlex(s)];
}

function detectSecondStore(x: string, account?: string): string | undefined {
  if (!account) return undefined;
  for (const seg of x.split(/[\/\n]+/).map((t) => t.trim()).filter((t) => t.length >= 4)) {
    const r = resolveStore(seg);
    if (r.account && r.account !== account) return [r.account, r.branch].filter(Boolean).join(' ');
  }
  return undefined;
}

export async function onSave(s: Session): Promise<any[]> {
  if (s.savedReportId && !s.items.length && !s.extra?.length && !(s.rawText && s.rawText.trim())) {
    return [text(`รายงานนี้บันทึกไปแล้วครับ (เลขที่ #${s.savedReportId})\nแท็กบอทเพื่อเริ่มรายงานใหม่ได้เลย`)];
  }
  const errs = saveBlockers(s);
  if (errs.length) {
    return [text('ยังไม่สามารถบันทึกได้ครับ กรุณาตรวจสอบ:\n• ' + errs.join('\n• ')), summaryFlex(s)];
  }
  acceptNewBrands(s);
  let savedId: number | undefined;
  try {
    if (sqlEnabled()) {
      savedId = await saveReport(s);
      console.log('บันทึกลง SQL: report id', savedId, 'โดย', s.userId);
      const allKeys = s.photoKeys || [];
      if (allKeys.length) deletePhotos(allKeys);
    } else {
      console.log('SAVED (demo):', JSON.stringify({ topic: s.topicName, items: s.items }));
    }
  } catch (e: any) {
    console.error('save error', e);
    return [text('บันทึกลงระบบไม่สำเร็จครับ กรุณากดบันทึกอีกครั้ง\n(' + (e.message || '') + ')'), summaryFlex(s)];
  }
  const recap = {
    id: savedId,
    store: [s.account, s.branch].filter(Boolean).join(' · ') || undefined,
    nItems: s.items.length,
    nPhotos: s.photoKeys?.length || 0,
  };
  logParse({ userId: s.userId, raw: s.rawText, merged: sessionSnapshot(s), outcome: 'saved', reportId: savedId });
  start(s);
  s.savedReportId = savedId;
  return [savedCard(recap)];
}

function acceptNewBrands(s: Session): void {
  for (const it of s.items) {
    if (!it.needsReview) continue;
    if (!it.brand && it.rawBrand) { it.brand = it.rawBrand; it.isNpd = true; }
    if (it.brand) it.needsReview = false;
  }
}

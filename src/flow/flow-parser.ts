import * as D from '../infra/master';
import * as AI from '../infra/ai';
import { matchMaster, norm, snap, fuzzyBrandAccept } from '../domain/match';
import { searchBrandMeili, meiliEnabled } from '../infra/meilisearch';
import { logParse } from '../infra/db';
import { Session } from '../shared/types';
import { resolveStore, nearbyAccounts, preMatchStoreAndBrands } from '../domain/store-resolve';
import {
  buildItem,
  mergeParsed,
  addApprox,
  dropApprox,
  applyStoreChannel,
  sessionSnapshot,
  setItemField,
  isApproxMatch,
} from '../domain/items';
import { parseSkipFields, firstMissing } from './completeness';
import { parseEditCommand, EditCmd } from './edit';
import {
  text,
  storeSelectCard,
  didYouMeanCard,
  productEditPicker,
  summaryFlex,
} from '../view/cards';
import { ask, continueLoop } from './nav';
import { editItemFromText } from './item-edit';

import {
  TEXT_SKIP_MORE_REGEX,
  TEXT_SKIP_FIELDS_EXTRACT_REGEX,
  TEXT_CORRECT_TYPO_REGEX,
  RESIDUAL_CLEAN_REGEX
} from '../shared/constants';
import { detectReportStore, detectSecondStore } from './report-store-detection';

export const ITEM_FIELD_LABEL: Record<string, string> = {
  category: 'หมวดหมู่สินค้า',
  subCategory: 'ประเภทสินค้าหลัก',
  brand: 'ยี่ห้อสินค้า',
  size: 'ขนาดสินค้า',
  pack: 'ขนาดบรรจุภัณฑ์',
  variant: 'รุ่น/สี/รสชาติ',
  detail: 'รายละเอียดราคา/โปรโมชั่น',
  reportType: 'ลักษณะโปรโมชั่น',
  reportSubtype: 'รูปแบบโปรโมชั่น',
};

export async function applyEditCommand(s: Session, cmd: EditCmd): Promise<any[]> {
  const oob = (n: number): any[] => [text(`ไม่พบรายการที่ ${n} ครับ (ขณะนี้มี ${s.items.length} รายการ)`), summaryFlex(s)];
  if (cmd.op === 'delete') {
    if (cmd.n < 1 || cmd.n > s.items.length) return oob(cmd.n);
    s.items.splice(cmd.n - 1, 1);
    s.step = 'summary';
    return [
      text(s.items.length ? `ลบรายการที่ ${cmd.n} แล้วครับ` : `ลบรายการที่ ${cmd.n} แล้วครับ ขณะนี้ไม่มีรายการสินค้า กรุณาพิมพ์เพิ่มได้เลย`),
      summaryFlex(s),
    ];
  }
  if (cmd.op === 'add') {
    s.editItemIndex = -1;
    return editItemFromText(s, cmd.text);
  }
  if (cmd.op === 'editItem') {
    if (cmd.n < 1 || cmd.n > s.items.length) return oob(cmd.n);
    setItemField(s.items[cmd.n - 1], cmd.field, cmd.value, s.topicCode || '');
    s.step = 'summary';
    return [text(`แก้ไข${ITEM_FIELD_LABEL[cmd.field] || cmd.field} รายการที่ ${cmd.n} แล้วครับ`), summaryFlex(s)];
  }
  const f = cmd.field;
  if (f === 'channel') {
    const mm = matchMaster(cmd.value, D.channels);
    if (mm.best) {
      s.channel = mm.best;
      dropApprox(s, 'channel');
    }
  } else if (f === 'dates' || f === 'startDate' || f === 'endDate') {
    const ctx = f === 'endDate' ? `ถึง ${cmd.value}` : f === 'startDate' ? `เริ่ม ${cmd.value}` : cmd.value;
    const ef = f === 'endDate' ? ['วันจบโปร'] : ['ช่วงวันที่'];
    s.rawText = (s.rawText ? s.rawText + '\n' : '') + ctx;
    const dp = await AI.parseReport(ctx, ef, undefined, s.topicCode);
    mergeParsed(s, dp, false, ctx);
  } else if (f === 'account') {
    const r = resolveStore(cmd.value);
    if (r.account) {
      s.storeNew = false;
      s.account = r.account;
      if (r.branch) s.branch = r.branch;
      else s.branch = undefined;
      s.storeCands = undefined;
      if (r.approx || !r.branch) addApprox(s, 'store'); else dropApprox(s, 'store');
      applyStoreChannel(s);
    } else if (r.candidates?.length) {
      s.step = 'account';
      s.awaitingText = 'account';
      s.typedStore = cmd.value;
      return [storeSelectCard(r.candidates, cmd.value)];
    } else {
      const near = nearbyAccounts(cmd.value);
      if (near.length) {
        s.step = 'account';
        s.awaitingText = 'account';
        s.typedStore = cmd.value;
        return [didYouMeanCard(cmd.value, near)];
      }
      s.account = cmd.value;
      s.branch = undefined;
      s.storeNew = true;
      s.storeCands = undefined;
      addApprox(s, 'store');
      applyStoreChannel(s);
    }
  } else if (f === 'branch') {
    const opts = D.branchesByAccount[s.account || ''] || [];
    if (opts.length) {
      const m = matchMaster(cmd.value, opts);
      if (m.best) {
        s.branch = m.best;
        if (isApproxMatch(cmd.value, m.best)) addApprox(s, 'store'); else dropApprox(s, 'store');
      } else {
        s.branch = cmd.value;
        dropApprox(s, 'store');
      }
    } else {
      s.branch = cmd.value;
      dropApprox(s, 'store');
    }
  } else if (f === 'company') {
    const snapC = snap(cmd.value, D.companies);
    s.company = snapC || cmd.value;
    if (snapC && isApproxMatch(cmd.value, snapC)) addApprox(s, 'company'); else dropApprox(s, 'company');
  } else if (f === 'topic') {
    const matchedTopic = D.topics.find(t => norm(t.name) === norm(cmd.value) || norm(t.code) === norm(cmd.value));
    if (matchedTopic) {
      s.topicCode = matchedTopic.code;
      s.topicName = matchedTopic.name;
    } else {
      s.topicName = cmd.value;
      s.topicCode = undefined;
    }
  } else {
    const p: any = {};
    p[f] = cmd.value;
    mergeParsed(s, p, false, cmd.value);
  }
  s.step = 'summary';
  return [text('แก้ไขเรียบร้อยแล้วครับ กรุณาตรวจสอบความถูกต้อง แล้วกดบันทึกรายงาน'), summaryFlex(s)];
}

// A2: ยี่ห้อที่ matcher แบบ string เดิมจับไม่ได้ (needsReview) → ลองผ่าน Meilisearch (typo-tolerant)
// Meili หา candidate, แล้วยืนยันความคล้ายด้วย editDist/soundex (รองรับชื่อสั้นที่ matchMaster กันด้วย min-length)
// เป็นการเพิ่มเฉพาะ item ที่ยังไม่ resolve → improve only, ไม่แตะของที่ match แล้ว
async function resolveBrandsViaMeili(s: Session): Promise<void> {
  if (!meiliEnabled()) return;
  for (const it of s.items) {
    if (it.brand || !it.needsReview || !it.rawBrand) continue;
    const raw = it.rawBrand;
    let cands: string[] = [];
    try { cands = await searchBrandMeili(raw, 5); } catch { continue; }
    if (!cands.length) continue;
    const hit = cands.find((c) => fuzzyBrandAccept(raw, c));
    if (hit) {
      it.brand = hit;
      it.needsReview = false;
      it.approx = [...new Set([...(it.approx || []), 'brand'])]; // ทำเครื่องหมาย ≈ ให้ผู้ใช้ยืนยัน (fuzzy resolve)
    }
  }
}

export async function fastParse(s: Session, x: string): Promise<any[]> {
  if (!s.askingMore && s.items.length) {
    const cmd = parseEditCommand(x);
    if (cmd) return applyEditCommand(s, cmd);
  }
  const fillMode = !!s.askingMore;
  const expectFields = fillMode ? s.pendingFields : undefined;
  s.rawText = (s.rawText ? s.rawText + '\n' : '') + x;

  let preMatched: any = undefined;
  let pmSecondStore: string | undefined = undefined;
  if (!fillMode) {
    const pm = preMatchStoreAndBrands(x);
    if (pm.account || pm.brands.length) {
      preMatched = pm;
      if (pm.account) {
        s.account = pm.account;
        s.storeNew = false;
        if (pm.branch) s.branch = pm.branch;
        applyStoreChannel(s);
        dropApprox(s, 'store');
      }
      if (pm.hasSecondStore && pm.secondStoreName) {
        pmSecondStore = pm.secondStoreName;
      }
    }
  }

  let p: any;
  try {
    p = await AI.parseReport(x, expectFields, preMatched, s.topicCode);
  } catch (e) {
    console.error('AI error', e);
    logParse({ userId: s.userId, raw: x, outcome: 'ai_error' });
    const f = firstMissing(s);
    if (f) {
      s.fillingMissing = true;
      return [text('ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว ระบบสลับเป็นโหมดกดปุ่มให้แล้ว ข้อมูลที่พิมพ์ถูกบันทึกไว้เรียบร้อย'), ...ask(s, f)];
    }
    if (s.items.length) return [text('ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว กรุณาใช้การ์ดสรุปด้านล่างเพื่อตรวจสอบและแก้ไข'), summaryFlex(s)];
    return [text('ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว กรุณาพิมพ์ใหม่อีกครั้ง หรือพิมพ์ "เริ่ม" เพื่อกรอกแบบกดปุ่ม')];
  }
  const logRound = (outcome: string, asked?: string[]) =>
    logParse({ userId: s.userId, raw: x, aiJson: p, merged: sessionSnapshot(s), askedFields: asked, outcome });

  if (TEXT_CORRECT_TYPO_REGEX.test(x) && s.items.length && Array.isArray(p.items) && p.items.length) {
    let applied = 0;
    for (const raw of p.items) {
      const ni = buildItem(raw, s.topicCode || '', x);
      const ex: any = ni.brand ? s.items.find((it) => it.brand === ni.brand) : (s.items.length === 1 ? s.items[0] : undefined);
      if (!ex) continue;
      for (const k of ['detail', 'size', 'pack', 'variant'] as const) {
        if (ni[k]) {
          ex[k] = ni[k];
          applied++;
          if (ni.approx?.includes(k)) ex.approx = [...new Set([...(ex.approx || []), k])];
        }
      }
    }
    mergeParsed(s, { ...p, items: [] }, false, x);
    s.step = 'summary';
    s.fillingMissing = false;
    s.askingMore = false;
    s.pendingFields = undefined;
    if (!applied && s.items.length > 1) {
      logRound('asked', ['เลือกรายการที่แก้']);
      return [text('กรุณาเลือกรายการที่ต้องการแก้ไขครับ'), productEditPicker(s)];
    }
    logRound('summary');
    return [text('แก้ไขเรียบร้อยแล้วครับ กรุณาตรวจสอบอีกครั้ง แล้วกดบันทึกรายงาน'), summaryFlex(s)];
  }

  const storeResetWarn: any[] = [];
  if (!fillMode && (s.items.length || s.extra?.length)) {
    const pHasContent = !!((p.items && p.items.length) || (Array.isArray(p.extra) ? p.extra.length : (p.extra ? 1 : 0)));
    const storeHere = detectReportStore(p, x);
    if (storeHere && pHasContent && norm(storeHere) !== norm(s.account || '')) {
      const prevCount = s.items.length + (s.extra?.length || 0);
      storeResetWarn.push(text(`⚠️ ตรวจพบร้านใหม่ "${storeHere}" — ล้างรายการเดิม ${prevCount} รายการเพื่อเริ่มรายงานใหม่`));
      s.items = [];
      s.extra = [];
      s.startDate = undefined;
      s.endDate = undefined;
      s.company = undefined;
      s.photoKeys = [];
      s.photoCount = 0;
      s.approx = undefined;
      s.storeCands = undefined;
      s.account = undefined;
      s.branch = undefined;
      s.storeNew = undefined;
      s.channel = undefined;
      s.rawText = x;
    }
  }
  mergeParsed(s, p, fillMode, x);
  await resolveBrandsViaMeili(s); // A2: กู้ยี่ห้อที่ matcher เดิมจับไม่ได้ ผ่าน Meili (typo-tolerant)
  s.step = 'summary';
  s.fillingMissing = false;
  if (!s.account) {
    for (const seg of x.split(/[\/\n]+/).map((t) => t.trim()).filter((t) => t.length >= 3).slice(0, 6)) {
      const rr = resolveStore(seg);
      if (rr.account) {
        s.account = rr.account;
        if (rr.branch) s.branch = rr.branch;
        if (rr.approx) addApprox(s, 'store');
        break;
      }
    }
  }
  const second = pmSecondStore || detectSecondStore(x, s.account);
  const warn: any[] = [
    ...storeResetWarn,
    ...(second
      ? [text(`พบ 2 ร้านในข้อความ ระบบรองรับ 1 ร้านต่อรายงาน รอบนี้บันทึก "${[s.account, s.branch].filter(Boolean).join(' ')}" ไว้ก่อน ส่วน "${second}" กรุณาแจ้งแยกอีกรายงานครับ`)]
      : []),
  ];
  if (s.storeCands?.length && !s.branch) {
    s.fillingMissing = true;
    logRound('asked', ['เลือกสาขา']);
    return [...warn, text('กรุณาเลือกสาขาที่ถูกต้องครับ'), storeSelectCard(s.storeCands)];
  }
  if (!s.items.length && !s.extra?.length) {
    logRound('asked', ['เนื้อหา']);
    return [...warn, text('กรุณาพิมพ์รายละเอียดรายงานได้เลยครับ')];
  }
  s.step = 'summary';
  s.fillingMissing = false;
  logRound('summary');
  const loopMsgs = continueLoop(s);
  if (loopMsgs) return [...warn, ...loopMsgs];
  return [...warn, summaryFlex(s)];
}

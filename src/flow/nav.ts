import * as D from '../infra/master';
import { ORDER, PRODUCT_STEPS } from '../shared/steps';
import { Session, ReportItem } from '../shared/types';
import { firstMissing, wantedMissing } from './completeness';
import { selectCard, searchCard, dateCard, photoCard, detailCard, summaryFlex, topicPickCard, storeSelectCard, askMoreText, text } from '../view/cards';

export function nextOf(step: string): string {
  return ORDER[ORDER.indexOf(step) + 1];
}

export const MAX_BUTTONS = 25;

export const ASK_OPTIONAL_LOOP = false;

export function afterField(s: Session, step: string): any[] {
  if (s.fillingMissing || s.askingMore) {
    s.fillingMissing = false;
    const f = firstMissing(s);
    if (f) { s.fillingMissing = true; return ask(s, f); }
    const next = continueLoop(s);
    if (next) return next;
    return [text('ข้อมูลครบถ้วนแล้วครับ กรุณาตรวจสอบความถูกต้อง แล้วกด "บันทึกรายงาน"'), summaryFlex(s)];
  }
  if (s.editing && step === 'account') return ask(s, 'branch');
  if (s.editing && !PRODUCT_STEPS.includes(step)) { s.editing = false; return ask(s, 'summary'); }
  return ask(s, nextOf(step));
}

export function optionsFor(step: string, s: Session): string[] | null {
  switch (step) {
    case 'topic': return D.topics.map((t) => t.name);
    case 'channel': return D.channels;
    case 'account': return withOther(D.accountsByChannel[s.channel || ''] || D.accounts);
    case 'branch': return withOther(D.branchesByAccount[s.account || ''] || []);
    case 'company': return withOther(D.companies);
    case 'category': return withOther(D.categories);
    case 'subCategory': return withOther(D.subCatsByCategory[s.current.category || ''] || []);
    case 'brand': return D.brandsBySubCat[s.current.subCategory || ''] || [];
    case 'size': return withOther(D.sizes);
    case 'pack': return withOther(D.packs);
    case 'variant': return withOther(D.variants);
    case 'addMore': return ['เพิ่มสินค้าอีก', 'พอแล้ว ไปต่อ'];
    case 'reportType': return withOther(D.reportTypesByTopic[s.topicCode || ''] || []);
    case 'reportSubtype': return withOther(D.subtypesByReportType[s.current.reportType || ''] || []);
    default: return null;
  }
}

export function optionsForItem(field: string, s: Session, item: ReportItem): string[] | null {
  switch (field) {
    case 'category': return withOther(D.categories);
    case 'subCategory': return item.category ? withOther(D.subCatsByCategory[item.category] || []) : null;
    case 'brand': return item.subCategory ? (D.brandsBySubCat[item.subCategory] || []) : null;
    case 'size': return withOther(D.sizes);
    case 'pack': return withOther(D.packs);
    case 'variant': return withOther(D.variants);
    case 'reportType': return withOther(D.reportTypesByTopic[s.topicCode || ''] || []);
    case 'reportSubtype': return item.reportType ? withOther(D.subtypesByReportType[item.reportType] || []) : null;
    default: return null;
  }
}

export const withOther = (list: string[]): string[] => (list.length && !list.includes('อื่นๆ')) ? [...list, 'อื่นๆ'] : list;

export function ask(s: Session, step: string): any[] {
  s.editTarget = undefined;
  s.step = step;
  let msg: any[];
  if (step === 'detail') {
    s.awaitingText = 'detail';
    msg = [detailCard(s)];
  } else if (step === 'startDate' || step === 'endDate') msg = [dateCard(step, s)];
  else if (step === 'photo') msg = [photoCard()];
  else if (step === 'summary') msg = [summaryFlex(s)];
  else if (step === 'topic') msg = [topicPickCard(D.topics.map((t) => t.name), s.topicName)];
  else {
    const opts = optionsFor(step, s);
    const cv = (s as any)[step];
    const clr = s.editing && cv != null && cv !== '' ? { s: 'clrfield', f: step } : undefined;
    if (opts && opts.length === 0) {
      if (step === 'branch' && s.account) { s.awaitingText = 'branch'; msg = [searchCard('branch', s, 0, undefined, clr, s.editing)]; }
      else if (step === 'branch') return [text('กรุณาเลือกห้าง/ร้านก่อน แล้วจึงเลือกสาขาครับ'), ...ask(s, 'account')];
      else return ask(s, nextOf(step));
    } else if (opts && opts.length > MAX_BUTTONS) {
      s.awaitingText = step;
      msg = [searchCard(step, s, opts.length, undefined, clr, s.editing)];
    } else {
      msg = [selectCard(step, s, opts as string[], undefined, clr, s.editing)];
    }
  }
  if (s.asked[s.asked.length - 1] !== step) s.asked.push(step);
  return msg;
}

export function clearField(s: Session, step: string) {
  switch (step) {
    case 'topic': s.topicName = undefined; s.topicCode = undefined; break;
    case 'channel': s.channel = undefined; break;
    case 'account': s.account = undefined; s.branch = undefined; break;
    case 'branch': s.branch = undefined; break;
    case 'company': s.company = undefined; break;
    case 'category': s.current.category = undefined; s.current.subCategory = undefined; s.current.brand = undefined; break;
    case 'subCategory': s.current.subCategory = undefined; s.current.brand = undefined; break;
    case 'brand': s.current.brand = undefined; break;
    case 'size': s.current.size = undefined; break;
    case 'pack': s.current.pack = undefined; break;
    case 'variant': s.current.variant = undefined; break;
    case 'reportType': s.current.reportType = undefined; s.current.reportSubtype = undefined; break;
    case 'reportSubtype': s.current.reportSubtype = undefined; break;
    case 'detail': s.current.detail = undefined; s.awaitingText = undefined; break;
    case 'startDate': s.startDate = undefined; break;
    case 'endDate': s.endDate = undefined; break;
    case 'photo': s.photoCount = 0; break;
  }
}

export function continueLoop(s: Session): any[] | null {
  if (s.storeCands?.length && !s.branch) { s.askingMore = true; return [text('กรุณาเลือกสาขาที่ถูกต้องครับ'), storeSelectCard(s.storeCands)]; }
  if (!s.items.length && !s.extra?.length) { s.askingMore = true; return [text('กรุณาพิมพ์รายละเอียดรายงานได้เลยครับ')]; }
  if (!s.skipMore && ASK_OPTIONAL_LOOP) {
    const miss = wantedMissing(s);
    if (miss.length && (s.askRounds || 0) < 3) { s.askRounds = (s.askRounds || 0) + 1; s.askingMore = true; s.pendingFields = miss; return [askMoreText(miss)]; }
  }
  s.askingMore = false; s.step = 'summary'; s.pendingFields = undefined;
  return null;
}

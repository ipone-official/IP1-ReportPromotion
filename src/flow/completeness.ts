import * as D from '../infra/master';
import { Session, ReportItem } from '../shared/types';

export function missingRequired(s: Session): { step: string; label: string }[] {
  const m: { step: string; label: string }[] = [];
  if (!s.account) m.push({ step: 'account', label: 'ห้าง/ร้านค้า' });
  else if (!s.branch && !s.storeNew) m.push({ step: 'branch', label: 'สาขา' });
  return m;
}

export const firstMissing = (s: Session): string | null => missingRequired(s)[0]?.step || null;

export function saveBlockers(s: Session): string[] {
  const errs: string[] = [];
  const hasContent = s.items.length > 0 || !!s.extra?.length || !!(s.rawText && s.rawText.trim());
  if (!hasContent) errs.push('ยังไม่มีเนื้อหา — พิมพ์รายละเอียดมาได้เลย');
  if (s.startDate && s.endDate && s.endDate < s.startDate) errs.push('วันจบต้องไม่ก่อนวันเริ่ม');
  // Soft warnings: don't block save, but inform user of missing critical data
  const noBrand = s.items.filter((it) => !it.brand && !it.rawBrand);
  if (noBrand.length) errs.push(`⚠️ ${noBrand.length} รายการยังไม่มียี่ห้อ`);
  return errs;
}

export const SKIP_FIELDS: { key: string; label: string; aliases: string[]; required?: boolean }[] = [
  { key: 'topic', label: 'หัวข้อ', aliases: ['หัวข้อ'], required: true },
  { key: 'account', label: 'ห้าง/ร้านค้า', aliases: ['ห้าง', 'ร้าน', 'ร้านค้า'], required: true },
  { key: 'branch', label: 'สาขา', aliases: ['สาขา'], required: true },
  { key: 'brand', label: 'ยี่ห้อ', aliases: ['ยี่ห้อ', 'แบรนด์'], required: true },
  { key: 'channel', label: 'ช่องทาง', aliases: ['ช่องทาง'] },
  { key: 'company', label: 'บริษัท', aliases: ['บริษัท'] },
  { key: 'dates', label: 'ช่วงวันที่', aliases: ['วันที่', 'ช่วงวันที่', 'วัน'] },
  { key: 'endDate', label: 'วันจบโปร', aliases: ['วันจบ', 'วันจบโปร'] },
  { key: 'detail', label: 'ราคา/โปร', aliases: ['โปร', 'ราคา', 'ราคา/โปร', 'โปรโมชั่น'] },
  { key: 'size', label: 'ขนาด', aliases: ['ขนาด', 'ไซส์'] },
  { key: 'variant', label: 'กลิ่น/สี', aliases: ['กลิ่น', 'สี', 'กลิ่น/สี'] },
  { key: 'pack', label: 'แพ็ค', aliases: ['แพ็ค', 'แพค'] },
  { key: 'subCategory', label: 'ประเภทสินค้า', aliases: ['ประเภท', 'ประเภทสินค้า'] },
  { key: 'reportSubtype', label: 'รายการย่อย', aliases: ['รายการย่อย'] },
  { key: 'reportType', label: 'รายการที่จะแจ้ง', aliases: ['รายการ', 'รายการที่จะแจ้ง'] },
  { key: 'photo', label: 'รูป', aliases: ['รูป', 'รูปถ่าย', 'รูปภาพ'] },
];

const SKIP_CONNECTORS = ['กับ', 'และ', 'ครับ', 'ค่ะ', 'คับ', 'นะ'];

const FIELD_CUES = [
  ...SKIP_FIELDS.flatMap((f) => f.aliases.map((a) => ({ alias: a, key: f.key }))),
  { alias: 'กลุ่มสินค้า', key: 'category' }, { alias: 'หมวดสินค้า', key: 'category' }, { alias: 'กลุ่ม', key: 'category' }, { alias: 'หมวด', key: 'category' },
].sort((a, b) => b.alias.length - a.alias.length);

export function matchFieldCue(rest: string): { key: string; value: string } | null {
  const r = String(rest || '').trim();
  for (const c of FIELD_CUES) {
    if (r.startsWith(c.alias)) {
      const value = r.slice(c.alias.length).replace(/^[\s:=]+/, '').trim();
      if (value) return { key: c.key, value };
    }
  }
  return null;
}

export function parseSkipFields(rest: string): { keys: string[]; labels: string[]; blocked: string[] } | null {
  const toks = String(rest).trim().split(/[\s,]+/).filter(Boolean);
  if (!toks.length) return null;
  const keys: string[] = []; const labels: string[] = []; const blocked: string[] = [];
  let matched = 0;
  for (const t of toks) {
    if (SKIP_CONNECTORS.includes(t)) continue;
    const f = SKIP_FIELDS.find((x) => x.aliases.includes(t));
    if (!f) return null;
    matched++;
    if (f.required) { if (!blocked.includes(f.label)) blocked.push(f.label); continue; }
    if (!keys.includes(f.key)) { keys.push(f.key); labels.push(f.label); }
    if (f.key === 'dates' && !keys.includes('endDate')) keys.push('endDate');
  }
  return matched ? { keys, labels, blocked } : null;
}

export function wantedMissing(s: Session, round?: number): string[] {
  const critical: { k: string; label: string }[] = [];
  const optional: { k: string; label: string }[] = [];

  // Critical: always ask
  for (const x of missingRequired(s)) critical.push({ k: x.step, label: x.label });
  if (!s.startDate) critical.push({ k: 'dates', label: 'ช่วงวันที่' });
  else if (!s.endDate) critical.push({ k: 'endDate', label: 'วันจบโปร' });
  if (!s.company) critical.push({ k: 'company', label: 'บริษัท' });
  const noBrand = s.items.map((it, i) => ({ it, i })).filter((x) => !x.it.brand && !x.it.rawBrand);
  if (noBrand.length) critical.push({ k: 'brand', label: `ยี่ห้อ (รายการที่ ${noBrand.map((x) => x.i + 1).join(', ')})` });

  const itemField = (k: string, label: string, key: keyof ReportItem, target: typeof critical) => {
    const miss = s.items.map((it, i) => ({ it, i })).filter((x) => !x.it[key] && !x.it.needsReview);
    if (miss.length) {
      const names = miss.slice(0, 2).map((x) => x.it.brand || x.it.rawBrand || `รายการที่ ${x.i + 1}`).join(', ');
      target.push({ k, label: `${label} (${names}${miss.length > 2 ? '...' : ''})` });
    }
  };
  // Optional: only ask in round 2+
  if (s.account && !s.channel) optional.push({ k: 'channel', label: `ช่องทาง (${D.channels.join('/')})` });
  itemField('subCategory', 'ประเภทสินค้า', 'subCategory', optional);
  itemField('size', 'ขนาด', 'size', optional);
  itemField('variant', 'กลิ่น/สี', 'variant', optional);
  itemField('pack', 'แพ็ค', 'pack', optional);
  if ((D.reportTypesByTopic[s.topicCode || ''] || []).length > 1) itemField('reportType', 'รายการที่จะแจ้ง', 'reportType', optional);
  const subMiss = s.items.filter((it) => !it.needsReview && it.reportType && !it.reportSubtype && (D.subtypesByReportType[it.reportType] || []).length > 1);
  if (subMiss.length) {
    const names = subMiss.slice(0, 2).map((it) => it.brand || it.rawBrand || '?').join(', ');
    optional.push({ k: 'reportSubtype', label: `รายการย่อย (${names}${subMiss.length > 2 ? '...' : ''})` });
  }
  if (!s.photoCount) optional.push({ k: 'photo', label: 'รูปถ่ายหน้างาน (ส่งรูปในแชทมาได้เลย)' });

  const skipped = s.skippedFields || [];
  const r = round ?? (s.askRounds || 0);
  // Round 1: critical only. Round 2+: critical + optional
  const pool = r <= 1 ? critical : [...critical, ...optional];
  return pool.filter((x) => !skipped.includes(x.k)).map((x) => x.label);
}

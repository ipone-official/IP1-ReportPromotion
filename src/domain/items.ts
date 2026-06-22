import * as D from '../infra/master';
import { norm, snap, snapStrict, snapExact } from './match';
import { resolveStore } from './store-resolve';
import { Session, ReportItem } from '../shared/types';

const ALL_SUBCATS = () => Object.values(D.subCatsByCategory).flat();
const ALL_BRANDS = () => Array.from(new Set(Object.values(D.brandsBySubCat).flat()));
function catOfSub(sub: string): string | undefined {
  return Object.keys(D.subCatsByCategory).find((c) => D.subCatsByCategory[c].includes(sub));
}

export const isApproxMatch = (raw: any, snapped?: string): boolean => !!snapped && !!raw && norm(raw) !== norm(snapped);
export function addApprox(s: Session, key: string) {
  if (!s.approx) s.approx = [];
  if (!s.approx.includes(key)) s.approx.push(key);
}
export function dropApprox(s: Session, key: string) {
  if (s.approx) s.approx = s.approx.filter((k) => k !== key);
}

export function normalizeDate(d: any): string | undefined {
  if (!d) return undefined;
  const m = String(d).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  let y = parseInt(m[1], 10);
  if (y > 2400) y -= 543;
  const mo = parseInt(m[2], 10), da = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return undefined;
  const iso = `${y}-${m[2]}-${m[3]}`;
  const dt = new Date(iso + 'T00:00:00Z');
  if (isNaN(dt.getTime()) || dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== da) return undefined;
  return iso;
}

function hasDateSignal(raw: string): boolean {
  const r = String(raw || '');
  return /(?:เริ่ม|ตั้งแต่|ถึง|หมด|สิ้นสุด|จบ)\s*(?:วันนี้|พรุ่งนี้|มะรืน)|(?:วันนี้|พรุ่งนี้|มะรืน)\s*(?:ถึง|[-–]|จนถึง|สิ้น)|วันที่\s*\d|เริ่ม\s*\d/.test(r)
    || /\d{1,2}\s*[-–/]\s*\d{1,2}/.test(r)
    || /\d{1,2}\s*(ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค|มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)/.test(r);
}

export function splitVariantItems(items: any[]): any[] {
  return (items || []).flatMap((it: any) => {
    const parts = String(it.variant ?? '').split(',').map((x: string) => x.trim()).filter(Boolean);
    return parts.length > 1 ? parts.map((v: string) => ({ ...it, variant: v })) : [it];
  });
}

export function buildItem(it: any, topicCode: string, srcText = ''): ReportItem {
  const nt = norm(srcText);
  const grounded = (canon: any, rawAI: any) => !nt || nt.includes(norm(canon)) || (!!rawAI && nt.includes(norm(rawAI)));
  let sub = snapStrict(it.subCategory, ALL_SUBCATS()) || snapStrict(it.category, ALL_SUBCATS());
  const brand = snap(it.brand, ALL_BRANDS());
  const needsReview = !brand && !!it.brand;
  if (!sub && it.subCategory) sub = String(it.subCategory).trim();
  if (sub && !grounded(sub, it.subCategory)) sub = undefined;
  let cat = snapStrict(it.category, D.categories) || (it.category ? String(it.category).trim() : undefined);
  if (cat && !grounded(cat, it.category)) cat = undefined;
  let rType = snapStrict(it.reportType, D.reportTypesByTopic[topicCode] || []) || (it.reportType ? String(it.reportType).trim() : undefined);
  if (rType && !grounded(rType, it.reportType)) rType = undefined;
  let rSub = (rType ? snapStrict(it.reportSubtype, D.subtypesByReportType[rType] || []) : undefined) || (it.reportSubtype ? String(it.reportSubtype).trim() : undefined);
  if (rSub && !grounded(rSub, it.reportSubtype)) rSub = undefined;
  let variant = snapStrict(it.variant, D.variants) || (it.variant ? String(it.variant).trim() : undefined);
  if (variant && !grounded(variant, it.variant)) variant = undefined;
  let pack = snapExact(it.pack, D.packs) || snapStrict(it.pack, D.packs) || (it.pack ? String(it.pack).trim() : undefined);
  if (pack && !grounded(pack, it.pack)) pack = undefined;
  const sizeExact = snapExact(it.size, D.sizes);
  let size = sizeExact || (it.size ? String(it.size).trim() : undefined);
  if (size && !grounded(size, it.size)) size = undefined;
  const baseDetail = it.detail ? String(it.detail) : undefined;
  let sizeToDetail: string | undefined;
  if (size && /^\d+(\.\d+)?$/.test(size) && !baseDetail) { sizeToDetail = size; size = undefined; }
  const detail = [baseDetail, sizeToDetail].filter(Boolean).join(' ') || undefined;
  const approx: string[] = [];
  if (isApproxMatch(it.brand, brand)) approx.push('brand');
  if (isApproxMatch(it.variant, variant)) approx.push('variant');
  if (isApproxMatch(it.subCategory, sub)) approx.push('subCategory');
  if (isApproxMatch(it.pack, pack)) approx.push('pack');
  if (sub && !ALL_SUBCATS().includes(sub) && !approx.includes('subCategory')) approx.push('subCategory');
  if (pack && !D.packs.includes(pack) && !approx.includes('pack')) approx.push('pack');
  if (variant && !D.variants.includes(variant) && !approx.includes('variant')) approx.push('variant');
  if (size && !D.sizes.includes(size) && !approx.includes('size')) approx.push('size');
  return {
    category: cat,
    subCategory: sub,
    brand,
    rawBrand: it.brand ? String(it.brand) : undefined,
    needsReview,
    size,
    pack,
    variant,
    reportType: rType,
    reportSubtype: rSub,
    detail,
    approx: approx.length ? approx : undefined,
  };
}

function itemApprox(item: ReportItem, key: string, on: boolean) {
  const set = new Set(item.approx || []);
  if (on) set.add(key); else set.delete(key);
  item.approx = set.size ? [...set] : undefined;
}

export function applyBrand(item: ReportItem, raw: string) {
  const r = String(raw || '').trim();
  item.rawBrand = r;
  const brand = snap(r, ALL_BRANDS());
  if (brand) {
    item.brand = brand;
    item.needsReview = false;
    if (item.subCategory) item.category = catOfSub(item.subCategory) || item.category;
    itemApprox(item, 'brand', isApproxMatch(r, brand));
  } else {
    item.brand = undefined;
    item.needsReview = true;
    itemApprox(item, 'brand', false);
  }
}

export function setItemField(item: ReportItem, field: string, raw: string, topicCode = '') {
  const r = String(raw || '').trim();
  switch (field) {
    case 'detail': item.detail = r; break;
    case 'size': item.size = snapExact(r, D.sizes) || r; break;
    case 'pack': item.pack = snapExact(r, D.packs) || snapStrict(r, D.packs) || r; break;
    case 'variant': {
      const v = snapStrict(r, D.variants);
      item.variant = v || r; itemApprox(item, 'variant', isApproxMatch(r, v || undefined));
      break;
    }
    case 'subCategory': {
      const v = snapStrict(r, ALL_SUBCATS());
      item.subCategory = v || r; itemApprox(item, 'subCategory', isApproxMatch(r, v || undefined));
      if (v) item.category = catOfSub(v) || item.category;
      break;
    }
    case 'category': item.category = snapStrict(r, D.categories) || r; break;
    case 'brand': applyBrand(item, r); break;
    case 'reportType': item.reportType = snapStrict(r, D.reportTypesByTopic[topicCode] || []) || r; break;
    case 'reportSubtype': item.reportSubtype = snapStrict(r, D.subtypesByReportType[item.reportType || ''] || []) || r; break;
  }
}

export function channelOfAccount(account?: string): string | undefined {
  if (!account) return undefined;
  const hits = D.channels.filter((ch) => (D.accountsByChannel[ch] || []).includes(account));
  return hits.length === 1 ? hits[0] : undefined;
}

export function applyStoreChannel(s: Session): void {
  if (s.storeNew) return;
  const ch = channelOfAccount(s.account);
  if (!ch) return;
  if (!s.channel) { s.channel = ch; return; }
  if (s.channel !== ch) { s.channel = ch; addApprox(s, 'channel'); }
}

export function mergeParsed(s: Session, p: any, fillMode = false, currentText?: string) {
  const ntSrc = norm(currentText || s.rawText || '');
  const inSrc = (v: any) => { const nv = norm(v); return !ntSrc || (!!nv && ntSrc.includes(nv)); };
  if (p.account || p.branch) {
    const r = resolveStore([p.account, p.branch].filter(Boolean).join(' '));
    const changing = !!(s.account && r.account && r.account !== s.account);
    let evidence = true;
    if (changing && currentText) {
      const rx = resolveStore(currentText);
      evidence = !!(rx.account || rx.candidates?.length);
    }
    if (r.account && evidence) {
      if (s.account && r.account !== s.account && !r.branch) s.branch = undefined;
      s.account = r.account; s.storeNew = false;
      if (r.branch) s.branch = r.branch;
      // หลักประกันทั่วไป (value-agnostic): resolveStore ไม่เจอสาขาใน master แต่ AI แยกชื่อสาขามา (โผล่ในข้อความจริง) → เก็บตามที่พิมพ์ (≈)
      // จับทุกห้าง รวมห้างที่แมตช์ด้วยชื่อ (ไม่มี alias) เช่น Big C — สาขาที่ AI จับได้ต้องไม่หาย ไม่ว่าจะอยู่ใน master หรือไม่
      else if (p.branch && inSrc(p.branch) && !s.branch) s.branch = String(p.branch).trim();
      s.storeCands = undefined;
      if (r.approx || !r.branch) addApprox(s, 'store'); else dropApprox(s, 'store');
    }
    // ร้านกำกวมหลายห้าง → ไม่ถามเลย ; ตกไปเก็บ "ตามที่พิมพ์ (ร้านใหม่)" ด้านล่าง แล้วแตะแก้บนการ์ด
    // AI จับชื่อร้านได้ แต่ canonicalize ไม่ติด/เจอแค่ candidate อ่อน (ร้านใหม่/โชห่วยนอก master) → รับเป็น "ร้านใหม่" เก็บตามพิมพ์ + flag (ไม่ทิ้งให้ถามซ้ำ — ร้านต้องไม่หาย)
    else if (!r.account && (!r.candidates?.length || r.weak) && p.account && !s.account) {
      const acc = String(p.account).trim();
      if (acc && norm(currentText || '').includes(norm(acc))) { // กัน AI หลอน: ชื่อร้านต้องโผล่ในข้อความจริง
        s.account = acc; if (p.branch) s.branch = String(p.branch).trim();
        s.storeNew = true; addApprox(s, 'store');
      }
    }
  }
  if (!s.account && p.account) {
    const acc = String(p.account).trim();
    const bareProvince = D.provinces.some((pv) => norm(pv) === norm(acc));
    if (acc && !bareProvince && norm(currentText || '').includes(norm(acc))) {
      s.account = acc; if (p.branch && !s.branch) s.branch = String(p.branch).trim();
      s.storeNew = true; s.storeCands = undefined; addApprox(s, 'store');
    }
  }
  if (p.channel && inSrc(p.channel)) {
    const c = snap(p.channel, D.channels);
    if (c) { s.channel = c; if (isApproxMatch(p.channel, c)) addApprox(s, 'channel'); else dropApprox(s, 'channel'); }
  }
  if (s.channel && !D.channels.includes(s.channel)) { s.channel = undefined; dropApprox(s, 'channel'); }
  applyStoreChannel(s);
  const hasCompanyMarker = /บริษัท|บจก|บมจ|ผู้ผลิต/.test(ntSrc);
  const snapC = snap(p.company, D.companies);
  const fuzzyCompanyInSrc = !!snapC && (currentText || s.rawText || '')
    .split(/[\s,\/\n]+/).some((seg) => seg.trim().length >= 3 && snap(seg, [snapC]) === snapC);
  if (p.company && (inSrc(p.company) || hasCompanyMarker || fuzzyCompanyInSrc)) {
    s.company = snapC || String(p.company).trim();
    if (isApproxMatch(p.company, snapC)) addApprox(s, 'company'); else dropApprox(s, 'company');
  }
  if (Array.isArray(p.items) && p.items.length) {
    const newItems = splitVariantItems(p.items).map((it: any) => buildItem(it, s.topicCode || '', currentText || s.rawText || ''));
    if (fillMode && s.items.length) {
      for (const ni of newItems) {
        const brandOnly = ni.brand && !ni.detail && !ni.size && !ni.variant && !ni.pack;
        const exNoBrand = brandOnly ? s.items.find((it) => !it.brand && !it.rawBrand) : undefined;
        if (exNoBrand) {
          exNoBrand.brand = ni.brand; exNoBrand.rawBrand = ni.rawBrand; exNoBrand.needsReview = ni.needsReview;
          if (!exNoBrand.subCategory && ni.subCategory) exNoBrand.subCategory = ni.subCategory;
          if (!exNoBrand.category && ni.category) exNoBrand.category = ni.category;
          if (ni.approx?.includes('brand')) exNoBrand.approx = [...new Set([...(exNoBrand.approx || []), 'brand'])];
          continue;
        }
        const ansFields = (['detail', 'size', 'variant', 'pack'] as const).filter((k) => ni[k]);
        const shortAnswer = !ni.brand && ansFields.length > 0 && !ni.subCategory;
        let ex: any;
        if (shortAnswer) {
          ex = s.items.find((it) => !it.needsReview && ansFields.some((k) => !it[k]));
        } else {
          ex = s.items.find((it) => it.brand && it.brand === ni.brand && (!it.size || !it.pack || !it.variant || !it.detail));
        }
        if (ex) {
          for (const k of ['size', 'pack', 'variant', 'subCategory', 'category', 'detail', 'reportType', 'reportSubtype']) {
            if (!ex[k] && (ni as any)[k]) {
              ex[k] = (ni as any)[k];
              if (ni.approx?.includes(k)) ex.approx = [...new Set([...(ex.approx || []), k])];
            }
          }
        }
        // สินค้าใหม่จริงต้องมียี่ห้ออย่างน้อย raw — เศษคำตอบไร้ยี่ห้อที่หา item เจ้าบ้านไม่ได้
        // (เช่นทุก item เป็น NPD รอยืนยัน เลยถูกกรองออกจากการเป็นเจ้าบ้าน) → ทิ้ง ห้ามสร้าง "item ผี"
        // (เคยเกิดจริง: ตอบ "ไฮยีน 25-30 ไม่มีรูป" แล้วงอกรายการที่ 12 เปล่าๆ — rawText เก็บข้อความครบอยู่แล้ว)
        else if (ni.brand || ni.rawBrand) s.items.push(ni);
      }
    } else {
      s.items = s.items.length ? s.items.concat(newItems) : newItems;
    }
    s.current = {};
  }
  const inExtra: string[] = [];
  const pushEx = (v: any) => { const t = String(v ?? '').trim(); if (t) inExtra.push(t); };
  if (Array.isArray(p.extra)) for (const e of p.extra) {
    if (typeof e === 'string') pushEx(e);
    else if (e && typeof e === 'object') pushEx([e.label, e.value].filter(Boolean).join(' '));
  } else if (typeof p.extra === 'string') pushEx(p.extra);
  else if (p.extra && typeof p.extra === 'object') for (const v of Object.values(p.extra)) pushEx(v);
  if (inExtra.length) {
    s.extra = s.extra || [];
    const seen = new Set(s.extra.map((e) => norm(e)));
    for (const e of inExtra) { const k = norm(e); if (k && !seen.has(k)) { seen.add(k); s.extra.push(e); } }
  }
  let sd = normalizeDate(p.startDate);
  let ed = normalizeDate(p.endDate);
  const today = new Date().toISOString().slice(0, 10);
  if (sd === today && !hasDateSignal(s.rawText || '')) sd = undefined;
  if (ed === today && !hasDateSignal(s.rawText || '')) ed = undefined;
  if (!/\b(20\d{2}|25\d{2})\b|ปีหน้า|ปีที่แล้ว|ปีก่อน/.test(s.rawText || '')) {
    const nowY = new Date().getFullYear();
    if (sd) sd = normalizeDate(`${nowY}${sd.slice(4)}`);
    const baseStart = sd || s.startDate;
    if (ed) {
      const eY = baseStart && `${nowY}${ed.slice(4)}` < baseStart ? nowY + 1 : nowY;
      ed = normalizeDate(`${eY}${ed.slice(4)}`);
    }
  }
  if (sd) s.startDate = sd;
  if (ed) s.endDate = ed;
  // ห้ามเดา: ไม่ default หัวข้อเป็น "เรื่องอื่นๆ" — หัวข้อเอาเฉพาะที่ AI สกัดจากข้อความ ; ว่าง = โชว์ "—" ให้คนเลือกเอง
}

export function itemDesc(p?: ReportItem): string {
  return [p?.brand || p?.rawBrand, p?.subCategory, p?.size, p?.variant].filter(Boolean).join(' ') || '(สินค้า)';
}

export function sessionSnapshot(s: Session): any {
  return {
    topic: s.topicName, channel: s.channel, account: s.account, branch: s.branch,
    storeNew: s.storeNew || undefined, company: s.company,
    startDate: s.startDate, endDate: s.endDate, approx: s.approx?.length ? s.approx : undefined,
    items: s.items.map((it) => ({
      brand: it.brand, rawBrand: it.rawBrand !== it.brand ? it.rawBrand : undefined,
      subCategory: it.subCategory, variant: it.variant, size: it.size, pack: it.pack,
      detail: it.detail, needsReview: it.needsReview || undefined, approx: it.approx,
    })),
  };
}

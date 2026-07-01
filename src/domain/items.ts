import * as D from '../infra/master';
import { norm, snap, snapStrict } from './match';
import { Session, ReportItem } from '../shared/types';
import { soundSimilar } from './soundex';
import { PACK_KEYWORDS_LIST, SIZE_UNITS_LIST } from '../shared/constants';
import {
  normalizeDate,
  hasDateSignal,
  parseRelativeDates
} from './date-parser';
import {
  splitSizePack,
  normalizeSize,
  cleanDetailPrice
} from './item-utils';
import {
  snapSize,
  snapPack,
  snapVariant,
  snapSubCategory
} from './item-snapper';
import {
  disambiguateSubCategory,
  applyBrand,
  setItemField,
  channelOfAccount,
  applyStoreChannel,
  isApproxMatch,
  subCatsOfBrand,
  catOfSub,
  alignReportSubtype
} from './item-classifier';
import { mergeParsed } from './session-merger';

export {
  normalizeDate,
  hasDateSignal,
  parseRelativeDates,
  splitSizePack,
  normalizeSize,
  cleanDetailPrice,
  snapSize,
  snapPack,
  snapVariant,
  snapSubCategory,
  disambiguateSubCategory,
  applyBrand,
  setItemField,
  channelOfAccount,
  applyStoreChannel,
  isApproxMatch,
  mergeParsed,
  alignReportSubtype
};

const ALL_SUBCATS = () => Object.values(D.subCatsByCategory).flat();
const ALL_BRANDS = () => Array.from(new Set(Object.values(D.brandsBySubCat).flat()));

export function addApprox(s: Session, key: string) {
  if (!s.approx) s.approx = [];
  if (!s.approx.includes(key)) s.approx.push(key);
}

export function dropApprox(s: Session, key: string) {
  if (s.approx) s.approx = s.approx.filter((k) => k !== key);
}

export function splitVariantItems(items: any[]): any[] {
  let lastBrand: string | undefined = undefined;
  let lastSize: string | undefined = undefined;
  let lastCategory: string | undefined = undefined;
  let lastSubCategory: string | undefined = undefined;

  const processed = (items || []).map((it: any) => {
    const updated = { ...it };
    // Only inherit from previous item when current looks like a continuation
    // (has variant/detail but no brand — e.g. listing variants of same product)
    const isContinuation = !updated.brand && (updated.variant || updated.detail);
    if (updated.brand) {
      lastBrand = updated.brand;
    } else if (lastBrand && isContinuation) {
      updated.brand = lastBrand;
    }
    if (updated.size) {
      lastSize = updated.size;
    } else if (lastSize && isContinuation) {
      updated.size = lastSize;
    }
    if (updated.category) {
      lastCategory = updated.category;
    } else if (lastCategory && isContinuation) {
      updated.category = lastCategory;
    }
    if (updated.subCategory) {
      lastSubCategory = updated.subCategory;
    } else if (lastSubCategory && isContinuation) {
      updated.subCategory = lastSubCategory;
    }
    return updated;
  });

  return processed.flatMap((it: any) => {
    const parts = String(it.variant ?? '').split(',').map((x: string) => x.trim()).filter(Boolean);
    return parts.length > 1 ? parts.map((v: string) => ({ ...it, variant: v })) : [it];
  });
}

export function buildItem(it: any, topicCode: string, srcText = ''): ReportItem {
  const itemCopy = { ...it };
  let rawSize = itemCopy.size ? String(itemCopy.size).trim() : undefined;
  let rawPack = itemCopy.pack ? String(itemCopy.pack).trim() : undefined;

  if (rawSize && !rawPack) {
    const hasPackKw = PACK_KEYWORDS_LIST.some(kw => rawSize!.includes(kw));
    const hasSizeUnit = SIZE_UNITS_LIST.some(unit => new RegExp(`\\b${unit}\\b|${unit}`, 'i').test(rawSize!));
    if (hasPackKw && !hasSizeUnit) {
      itemCopy.pack = rawSize;
      itemCopy.size = undefined;
    }
  } else if (rawPack && !rawSize) {
    const hasSizeUnit = SIZE_UNITS_LIST.some(unit => new RegExp(`\\b${unit}\\b|${unit}`, 'i').test(rawPack!));
    const hasPackKw = PACK_KEYWORDS_LIST.some(kw => rawPack!.includes(kw));
    if (hasSizeUnit && !hasPackKw) {
      itemCopy.size = rawPack;
      itemCopy.pack = undefined;
    }
  }

  if (itemCopy.size) {
    const split = splitSizePack(String(itemCopy.size));
    if (split.pack) {
      itemCopy.size = split.size;
      if (!itemCopy.pack) {
        itemCopy.pack = split.pack;
      }
    }
  }

  const nt = norm(srcText);
  const grounded = (canon: any, rawAI: any, isClassification = false) => {
    if (isClassification) return true;
    if (!nt) return true;
    const nc = norm(canon);
    const nr = norm(rawAI);
    if (nt.includes(nc) || (!!nr && nt.includes(nr))) return true;
    
    const normCanonSize = normalizeSize(canon);
    const normRawSize = normalizeSize(rawAI);
    const normText = normalizeSize(srcText);
    if (normCanonSize && normText.includes(normCanonSize)) return true;
    if (normRawSize && normText.includes(normRawSize)) return true;

    // Removed soundSimilar check — phonetic similarity is too loose for grounding
    // and allows AI-hallucinated values to pass through unchecked
    return false;
  };

  let variant = snapVariant(itemCopy.variant, D.variants) || (itemCopy.variant ? String(itemCopy.variant).trim() : undefined);
  if (variant && !grounded(variant, itemCopy.variant)) variant = undefined;

  let sub = snapSubCategory(itemCopy.subCategory, ALL_SUBCATS()) || snapSubCategory(itemCopy.category, ALL_SUBCATS());
  const brand = snap(itemCopy.brand, ALL_BRANDS());
  const needsReview = !brand && !!itemCopy.brand;

  const rawVarNorm = itemCopy.variant ? norm(itemCopy.variant) : '';
  const snapVarNorm = variant ? norm(variant) : '';
  let mappedSub: string | undefined = undefined;
  for (const [kw, targetSub] of Object.entries(D.variantToSubcatMap)) {
    if ((rawVarNorm && rawVarNorm.includes(kw)) || (snapVarNorm && snapVarNorm.includes(kw))) {
      mappedSub = targetSub;
      break;
    }
  }

  let isAutoFilledSub = false;
  if (mappedSub) {
    sub = mappedSub;
    isAutoFilledSub = true;
  } else if (brand && !sub) {
    const possibleSubs = subCatsOfBrand(brand);
    if (possibleSubs.length === 1) {
      sub = possibleSubs[0];
      isAutoFilledSub = true;
    } else if (possibleSubs.length > 1) {
      const match = disambiguateSubCategory(possibleSubs, srcText, itemCopy.variant);
      if (match) {
        sub = match;
        isAutoFilledSub = true;
      }
    }
  }

  if (!sub && itemCopy.subCategory) sub = String(itemCopy.subCategory).trim();
  if (sub && !isAutoFilledSub && !grounded(sub, itemCopy.subCategory, true)) sub = undefined;

  if (brand && sub) {
    const brs = D.brandsBySubCat[sub] || [];
    if (!brs.includes(brand)) {
      const possibleSubs = subCatsOfBrand(brand);
      if (possibleSubs.length === 1) {
        sub = possibleSubs[0];
      } else if (possibleSubs.length > 1) {
        const match = disambiguateSubCategory(possibleSubs, srcText, itemCopy.variant);
        if (match) {
          sub = match;
        } else {
          sub = undefined;
        }
      } else {
        sub = undefined;
      }
    }
  }

  let cat = snapStrict(itemCopy.category, D.categories) || (itemCopy.category ? String(itemCopy.category).trim() : undefined);
  if (cat && !grounded(cat, itemCopy.category, true)) cat = undefined;

  if (sub) {
    const canonicalCat = catOfSub(sub);
    if (canonicalCat) cat = canonicalCat;
  }
  let rSub = itemCopy.reportSubtype ? String(itemCopy.reportSubtype).trim() : undefined;
  const allTypes = topicCode ? (D.reportTypesByTopic[topicCode] || []) : Object.values(D.reportTypesByTopic).flat();
  let rType = snapStrict(itemCopy.reportType, allTypes) || snap(itemCopy.reportType, allTypes) || undefined;
  
  if (rSub) {
    const alignment = alignReportSubtype(rSub, topicCode);
    if (alignment.subtype) {
      rSub = alignment.subtype;
      if (alignment.reportType) {
        rType = alignment.reportType;
      }
    } else {
      rSub = undefined;
    }
  }

  if (rType && rSub) {
    const validSubs = D.subtypesByReportType[rType] || [];
    if (!validSubs.includes(rSub)) {
      rSub = undefined;
    }
  }



  
  let pack = snapPack(itemCopy.pack, D.packs) || (itemCopy.pack ? String(itemCopy.pack).trim() : undefined);
  if (pack && !grounded(pack, itemCopy.pack)) pack = undefined;
  
  let size = snapSize(itemCopy.size, D.sizes) || (itemCopy.size ? String(itemCopy.size).trim() : undefined);
  if (size && !grounded(size, itemCopy.size)) size = undefined;
  
  const baseDetail = itemCopy.detail ? String(itemCopy.detail) : undefined;
  let sizeToDetail: string | undefined;
  if (size && /^\d+(\.\d+)?$/.test(size) && !baseDetail) { sizeToDetail = size; size = undefined; }
  const detail = cleanDetailPrice([baseDetail, sizeToDetail].filter(Boolean).join(' ')) || undefined;
  const approx: string[] = [];
  if (isApproxMatch(itemCopy.brand, brand)) approx.push('brand');
  if (isApproxMatch(itemCopy.variant, variant)) approx.push('variant');
  if (isApproxMatch(itemCopy.subCategory, sub)) approx.push('subCategory');
  if (isApproxMatch(itemCopy.pack, pack)) approx.push('pack');
  if (sub && !ALL_SUBCATS().includes(sub) && !approx.includes('subCategory')) approx.push('subCategory');
  if (pack && !D.packs.includes(pack) && !approx.includes('pack')) approx.push('pack');
  if (variant && !D.variants.includes(variant) && !approx.includes('variant')) approx.push('variant');
  if (size && !D.sizes.includes(size) && !approx.includes('size')) approx.push('size');

  const isNpd = itemCopy.isNpd === true || itemCopy.isNpd === 'true' || itemCopy.isNpd === 1 || topicCode?.toLowerCase() === 'npd';

  // Phase 1/3: parse structured promo/competitive fields จาก AI output
  const num = (v: any): number | undefined => {
    if (v == null || v === '') return undefined;
    const n = Number(String(v).replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  };
  const toBool = (v: any): boolean | undefined =>
    (v === true || v === 'true') ? true : (v === false || v === 'false') ? false : undefined;

  // guardrails — บังคับ enum/ช่วง/cross-field ให้ structured fields "ไม่มั่ว" ไม่ว่า AI จะส่งอะไรมา (DESIGN guarantee)
  const PROMO_TYPES = new Set(['discount', 'buy_x_get_y', 'threshold_gift']);
  const priceNormal = num(itemCopy.priceNormal);
  let pricePromo = num(itemCopy.pricePromo);
  if (priceNormal != null && pricePromo != null && pricePromo > priceNormal) pricePromo = undefined; // ราคาโปร>ปกติ = มั่ว → ตัด
  let discountPct = num(itemCopy.discountPct);
  if (discountPct != null && (discountPct <= 0 || discountPct > 100)) discountPct = undefined;
  const promoType = PROMO_TYPES.has(String(itemCopy.promoType || '').trim()) ? String(itemCopy.promoType).trim() : undefined;
  const stockRaw = String(itemCopy.stockStatus || '').trim();
  const stockStatus = stockRaw ? (/หมด|oos|out/i.test(stockRaw) ? 'ของหมด' : stockRaw) : undefined;

  return {
    category: cat,
    subCategory: sub,
    rawSubCategory: itemCopy.subCategory ? String(itemCopy.subCategory) : undefined,
    brand,
    rawBrand: itemCopy.brand ? String(itemCopy.brand) : undefined,
    needsReview,
    isNpd: isNpd || undefined,
    size,
    pack,
    variant,
    rawVariant: itemCopy.variant ? String(itemCopy.variant) : undefined,
    rawReportSubtype: itemCopy.reportSubtype ? String(itemCopy.reportSubtype) : undefined,
    reportType: rType,
    reportSubtype: rSub,
    detail,
    itemNote: itemCopy.itemNote ? String(itemCopy.itemNote).trim() : undefined,
    isCompetitor: toBool(itemCopy.isCompetitor),
    priceNormal,
    pricePromo,
    discountPct,
    promoType,
    buyQty: num(itemCopy.buyQty),
    freeQty: num(itemCopy.freeQty),
    thresholdBaht: num(itemCopy.thresholdBaht),
    stockStatus,
    facings: num(itemCopy.facings),
    approx: approx.length ? approx : undefined,
  };
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
      detail: it.detail, itemNote: it.itemNote || undefined, needsReview: it.needsReview || undefined, approx: it.approx,
    })),
  };
}

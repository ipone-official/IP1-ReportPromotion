import * as D from '../infra/master';
import { norm, snap, snapStrict, containsFuzzySubstring } from './match';
import { Session, ReportItem } from '../shared/types';
import { cleanDetailPrice, splitSizePack } from './item-utils';
import { snapSize, snapPack, snapVariant, snapSubCategory } from './item-snapper';
import { soundexPrefixMatch } from './soundex';

const ALL_SUBCATS = () => Object.values(D.subCatsByCategory).flat();
const ALL_BRANDS = () => Array.from(new Set(Object.values(D.brandsBySubCat).flat()));

export function catOfSub(sub: string): string | undefined {
  return Object.keys(D.subCatsByCategory).find((c) => D.subCatsByCategory[c].includes(sub));
}

export function alignReportSubtype(sub: string, topicCode = ''): { subtype?: string; reportType?: string } {
  const r = String(sub || '').trim();
  if (!r) return {};
  const allowedTypes = topicCode ? (D.reportTypesByTopic[topicCode] || []) : Object.keys(D.subtypesByReportType);
  for (const t of allowedTypes) {
    const subsOfT = D.subtypesByReportType[t] || [];
    let matched = snapStrict(r, subsOfT);
    if (!matched) {
      matched = snap(r, subsOfT);
    }
    if (matched) {
      return { subtype: matched, reportType: t };
    }
  }
  return {};
}

export function subCatsOfBrand(brand: string): string[] {
  const subs: string[] = [];
  for (const [sub, brs] of Object.entries(D.brandsBySubCat)) {
    if (brs.includes(brand)) subs.push(sub);
  }
  return subs;
}

export function disambiguateSubCategory(possibleSubs: string[], rawText: string, variant?: string): string | undefined {
  const nt = norm(rawText + ' ' + (variant || ''));
  for (const sub of possibleSubs) {
    if (containsFuzzySubstring(nt, sub)) return sub;
  }
  for (const sub of possibleSubs) {
    for (const [key, kws] of Object.entries(D.subcatKeywords)) {
      if (sub.includes(key)) {
        if (kws.some(kw => containsFuzzySubstring(nt, kw))) {
          return sub;
        }
      }
    }
  }
  return undefined;
}

export function enforceBrandSubCategoryConsistency(item: ReportItem, rawText = '') {
  if (item.brand && item.subCategory) {
    const brs = D.brandsBySubCat[item.subCategory] || [];
    if (!brs.includes(item.brand)) {
      const possibleSubs = subCatsOfBrand(item.brand);
      if (possibleSubs.length === 1) {
        item.subCategory = possibleSubs[0];
      } else if (possibleSubs.length > 1) {
        const match = disambiguateSubCategory(possibleSubs, rawText || item.variant || '');
        if (match) {
          item.subCategory = match;
        } else {
          item.subCategory = undefined;
        }
      } else {
        item.subCategory = undefined;
      }
    }
    if (item.subCategory) {
      item.category = catOfSub(item.subCategory) || item.category;
    } else {
      item.category = undefined;
    }
  }
}

export const isApproxMatch = (raw: any, snapped?: string): boolean => !!snapped && !!raw && norm(raw) !== norm(snapped);

export function itemApprox(item: ReportItem, key: string, on: boolean) {
  const set = new Set(item.approx || []);
  if (on) set.add(key); else set.delete(key);
  item.approx = set.size ? [...set] : undefined;
}

export function applyBrand(item: ReportItem, raw: string) {
  const r = String(raw || '').trim();
  item.rawBrand = r;
  let brand: string | undefined = undefined;
  let extractedVariant: string | undefined = undefined;
  if (r) {
    const contextBrands = item.subCategory ? (D.brandsBySubCat[item.subCategory] || []) : [];
    const snapBrands = contextBrands.length ? contextBrands : ALL_BRANDS();
    brand = snapStrict(r, snapBrands);
    if (!brand && contextBrands.length) {
      brand = snapStrict(r, ALL_BRANDS());
    }
    if (!brand) {
      const nr = norm(r);
      const sortedSnapBrands = [...snapBrands].sort((a, b) => norm(b).length - norm(a).length);
      for (const b of sortedSnapBrands) {
        const nb = norm(b);
        if (nb.length >= 2 && nr.startsWith(nb)) {
          brand = b;
          const rest = r.substring(b.length).trim();
          if (rest) extractedVariant = rest;
          break;
        }
      }
      if (!brand && contextBrands.length) {
        const sortedAllBrands = [...ALL_BRANDS()].sort((a, b) => norm(b).length - norm(a).length);
        for (const b of sortedAllBrands) {
          const nb = norm(b);
          if (nb.length >= 2 && nr.startsWith(nb)) {
            brand = b;
            const rest = r.substring(b.length).trim();
            if (rest) extractedVariant = rest;
            break;
          }
        }
      }
      if (!brand) {
        const sortedAliases = D.aliasRows
          .filter(row => row.kind === 'brand' || row.kind === 'english')
          .sort((a, b) => norm(b.alias).length - norm(a.alias).length);
        for (const row of sortedAliases) {
          const na = norm(row.alias);
          if (na.length >= 2 && nr.startsWith(na)) {
            brand = row.canonical;
            const rest = r.substring(row.alias.length).trim();
            if (rest) extractedVariant = rest;
            break;
          }
        }
      }
      if (!brand) {
        const sortedSnapBrands = [...snapBrands].sort((a, b) => norm(b).length - norm(a).length);
        for (const b of sortedSnapBrands) {
          const matchLen = soundexPrefixMatch(r, b);
          if (matchLen > 0) {
            brand = b;
            const rest = r.substring(matchLen).trim();
            if (rest) extractedVariant = rest;
            break;
          }
        }
      }
      if (!brand && contextBrands.length) {
        const sortedAllBrands = [...ALL_BRANDS()].sort((a, b) => norm(b).length - norm(a).length);
        for (const b of sortedAllBrands) {
          const matchLen = soundexPrefixMatch(r, b);
          if (matchLen > 0) {
            brand = b;
            const rest = r.substring(matchLen).trim();
            if (rest) extractedVariant = rest;
            break;
          }
        }
      }
      if (!brand) {
        const sortedAliases = D.aliasRows
          .filter(row => row.kind === 'brand' || row.kind === 'english')
          .sort((a, b) => norm(b.alias).length - norm(a.alias).length);
        for (const row of sortedAliases) {
          const matchLen = soundexPrefixMatch(r, row.alias);
          if (matchLen > 0) {
            brand = row.canonical;
            const rest = r.substring(matchLen).trim();
            if (rest) extractedVariant = rest;
            break;
          }
        }
      }
      if (!brand) {
        brand = snap(r, snapBrands);
        if (!brand && contextBrands.length) {
          brand = snap(r, ALL_BRANDS());
        }
      }
    }
  }
  if (brand) {
    item.brand = brand;
    item.needsReview = false;
    if (extractedVariant && !item.variant) {
      const v = snapVariant(extractedVariant, D.variants);
      item.variant = v || extractedVariant;
      itemApprox(item, 'variant', isApproxMatch(extractedVariant, v || undefined));
    }
    if (!item.subCategory) {
      const possibleSubs = subCatsOfBrand(brand);
      if (possibleSubs.length === 1) {
        item.subCategory = possibleSubs[0];
      } else if (possibleSubs.length > 1 && raw) {
        const match = disambiguateSubCategory(possibleSubs, raw, item.variant);
        if (match) item.subCategory = match;
      }
    }
    if (item.subCategory) item.category = catOfSub(item.subCategory) || item.category;
    itemApprox(item, 'brand', isApproxMatch(r, brand));
  } else {
    item.brand = undefined;
    item.needsReview = true;
    itemApprox(item, 'brand', false);
  }
  enforceBrandSubCategoryConsistency(item, raw);
}

export function setItemField(item: ReportItem, field: string, raw: string, topicCode = '') {
  const r = String(raw || '').trim();
  switch (field) {
    case 'detail': item.detail = cleanDetailPrice(r); break;
    case 'size': {
      const split = splitSizePack(r);
      if (split.pack) {
        item.size = snapSize(split.size, D.sizes) || split.size;
        if (!item.pack) {
          item.pack = snapPack(split.pack, D.packs) || split.pack;
        }
      } else {
        item.size = snapSize(r, D.sizes) || r;
      }
      break;
    }
    case 'pack': item.pack = snapPack(r, D.packs) || r; break;
    case 'variant': {
      const v = snapVariant(r, D.variants);
      item.variant = v || r; itemApprox(item, 'variant', isApproxMatch(r, v || undefined));
      break;
    }
    case 'subCategory': {
      const v = snapSubCategory(r, ALL_SUBCATS());
      item.subCategory = v || r; itemApprox(item, 'subCategory', isApproxMatch(r, v || undefined));
      if (v) item.category = catOfSub(v) || item.category;
      break;
    }
    case 'category': item.category = snapStrict(r, D.categories) || snap(r, D.categories) || r; break;
    case 'brand': applyBrand(item, r); break;
    case 'reportType': {
      const allTypes = topicCode ? (D.reportTypesByTopic[topicCode] || []) : Object.values(D.reportTypesByTopic).flat();
      const snappedType = snapStrict(r, allTypes) || snap(r, allTypes) || undefined;
      item.reportType = snappedType;
      if (item.reportSubtype && snappedType) {
        const validSubs = D.subtypesByReportType[snappedType] || [];
        if (!validSubs.includes(item.reportSubtype)) {
          item.reportSubtype = undefined;
        }
      }
      break;
    }
    case 'reportSubtype': {
      const alignment = alignReportSubtype(r, topicCode);
      if (alignment.subtype) {
        item.reportSubtype = alignment.subtype;
        if (alignment.reportType) {
          item.reportType = alignment.reportType;
        }
      } else {
        item.reportSubtype = undefined;
      }
      break;
    }
    case 'itemNote': item.itemNote = r || undefined; break;
  }
  enforceBrandSubCategoryConsistency(item);
}

export function channelOfAccount(account?: string): string | undefined {
  if (!account) return undefined;
  const hits = D.channels.filter((ch) => (D.accountsByChannel[ch] || []).includes(account));
  return hits.length === 1 ? hits[0] : undefined;
}

export function applyStoreChannel(s: Session): void {
  if (s.storeNew) {
    if (!s.channel) {
      s.channel = 'MT';
    }
    return;
  }
  const ch = channelOfAccount(s.account);
  if (ch) {
    s.channel = ch;
    const existing = s.approx || [];
    s.approx = existing.filter((k) => k !== 'channel').length ? existing.filter((k) => k !== 'channel') : undefined;
  } else if (!s.channel) {
    s.channel = 'MT';
    const existing = s.approx || [];
    s.approx = existing.filter((k) => k !== 'channel').length ? existing.filter((k) => k !== 'channel') : undefined;
  }
}

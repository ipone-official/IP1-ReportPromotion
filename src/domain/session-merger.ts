import * as D from '../infra/master';
import { norm, snap, snapStrict } from './match';
import { resolveStore } from './store-resolve';
import { Session } from '../shared/types';
import { COMPANY_MARKER_REGEX, YEAR_SIGNAL_REGEX } from '../shared/constants';
import { normalizeDate, hasDateSignal, parseRelativeDates } from './date-parser';
import { applyStoreChannel, isApproxMatch } from './item-classifier';
import { splitVariantItems, buildItem, addApprox, dropApprox } from './items';

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
      else if (p.branch && inSrc(p.branch) && !s.branch) s.branch = String(p.branch).trim();
      s.storeCands = undefined;
      if (r.approx || !r.branch) addApprox(s, 'store'); else dropApprox(s, 'store');
    }
    else if (!r.account && (!r.candidates?.length || r.weak) && p.account && !s.account) {
      const acc = String(p.account).trim();
      if (acc && norm(currentText || '').includes(norm(acc))) {
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
  const hasCompanyMarker = COMPANY_MARKER_REGEX.test(ntSrc);
  const snapC = snap(p.company, D.companies);
  const fuzzyCompanyInSrc = !!snapC && (currentText || s.rawText || '')
    .split(/[\s,\/\n]+/).some((seg) => seg.trim().length >= 3 && snap(seg, [snapC]) === snapC);
  if (p.company && (inSrc(p.company) || hasCompanyMarker || fuzzyCompanyInSrc)) {
    s.company = snapC || String(p.company).trim();
    if (isApproxMatch(p.company, snapC)) addApprox(s, 'company'); else dropApprox(s, 'company');
  }
  if (Array.isArray(p.items) && p.items.length) {
    const mergedItems = mergeDuplicateOrPriceSplitItems(p.items);
    const newItems = splitVariantItems(mergedItems).map((it: any) => buildItem(it, s.topicCode || '', currentText || s.rawText || ''));
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
          // Apply to ALL items missing this field, not just the first one
          const targets = s.items.filter((it) => !it.needsReview && ansFields.some((k) => !it[k]));
          if (targets.length) {
            for (const target of targets) {
              for (const k of ansFields) {
                if (!target[k] && (ni as any)[k]) {
                  target[k] = (ni as any)[k];
                  if (ni.approx?.includes(k)) target.approx = [...new Set([...(target.approx || []), k])];
                }
              }
            }
            continue;
          }
        } else {
          ex = s.items.find((it) => it.brand && it.brand === ni.brand && (!it.size || !it.pack || !it.variant || !it.detail));
        }
        if (ex) {
          for (const k of ['size', 'pack', 'variant', 'subCategory', 'category', 'detail', 'reportType', 'reportSubtype', 'itemNote']) {
            if (!ex[k] && (ni as any)[k]) {
              ex[k] = (ni as any)[k];
              if (ni.approx?.includes(k)) ex.approx = [...new Set([...(ex.approx || []), k])];
            }
          }
        }
        else if (ni.brand || ni.rawBrand) s.items.push(ni);
      }
    } else {
      // Dedup: merge items with matching brand+size+variant instead of duplicating
      const deduped: typeof newItems = [];
      for (const ni of newItems) {
        const niKey = [ni.brand || ni.rawBrand || '', ni.size || '', ni.variant || ni.rawVariant || ''].join('|');
        const existing = niKey && s.items.find((it) => {
          const itKey = [it.brand || it.rawBrand || '', it.size || '', it.variant || it.rawVariant || ''].join('|');
          return itKey === niKey && itKey !== '||';
        });
        if (existing) {
          // Merge new data into existing item
          for (const k of ['detail', 'pack', 'subCategory', 'category', 'reportType', 'reportSubtype', 'itemNote'] as const) {
            if (!existing[k] && (ni as any)[k]) (existing as any)[k] = (ni as any)[k];
          }
        } else {
          deduped.push(ni);
        }
      }
      if (deduped.length) s.items = s.items.length ? s.items.concat(deduped) : deduped;
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
  
  // Only use relative dates as fallback when AI didn't already provide dates
  // This prevents parseRelativeDates from overriding accurate ISO dates from AI
  const relDates = parseRelativeDates(currentText || s.rawText || '');
  if (relDates) {
    if (!sd && relDates.startDate) sd = relDates.startDate;
    if (!ed && relDates.endDate) ed = relDates.endDate;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (sd === today && !hasDateSignal(s.rawText || '')) sd = undefined;
  if (ed === today && !hasDateSignal(s.rawText || '')) ed = undefined;
  if (!YEAR_SIGNAL_REGEX.test(s.rawText || '')) {
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
}

function mergeDuplicateOrPriceSplitItems(items: any[]): any[] {
  if (!Array.isArray(items) || items.length <= 1) return items;

  const result: any[] = [];
  const groups: Record<string, any[]> = {};
  for (const it of items) {
    const bKey = norm(it.brand || it.rawBrand || '');
    groups[bKey] = groups[bKey] || [];
    groups[bKey].push(it);
  }

  for (const bKey of Object.keys(groups)) {
    const brandItems = groups[bKey];
    const withVariant = brandItems.filter(it => it.variant && String(it.variant).trim());
    const noVariant = brandItems.filter(it => !it.variant || !String(it.variant).trim());

    if (withVariant.length > 0) {
      for (const nv of noVariant) {
        let mergedAny = false;
        for (const v of withVariant) {
          const sizeMatches = !nv.size || !v.size || norm(nv.size) === norm(v.size);
          if (sizeMatches) {
            mergedAny = true;
            if (nv.detail && String(nv.detail).trim()) {
              const nvDet = String(nv.detail).trim();
              if (v.detail && String(v.detail).trim()) {
                const vDet = String(v.detail).trim();
                if (!vDet.includes(nvDet) && !nvDet.includes(vDet)) {
                  v.detail = `${vDet} / ${nvDet}`;
                }
              } else {
                v.detail = nvDet;
              }
            }
            if (nv.pack && !v.pack) v.pack = nv.pack;
            if (nv.isNpd) v.isNpd = true;
            if (nv.category && !v.category) v.category = nv.category;
            if (nv.subCategory && !v.subCategory) v.subCategory = nv.subCategory;
          }
        }
        if (!mergedAny) {
          result.push(nv);
        }
      }
      result.push(...withVariant);
    } else {
      const mergedNoVariant: any[] = [];
      for (const nv of noVariant) {
        const target = mergedNoVariant.find(t => {
          return !nv.size || !t.size || norm(nv.size) === norm(t.size);
        });
        if (target) {
          if (nv.detail && String(nv.detail).trim()) {
            const nvDet = String(nv.detail).trim();
            if (target.detail && String(target.detail).trim()) {
              const tDet = String(target.detail).trim();
              if (!tDet.includes(nvDet) && !nvDet.includes(tDet)) {
                target.detail = `${tDet} / ${nvDet}`;
              }
            } else {
              target.detail = nvDet;
            }
          }
          if (nv.pack && !target.pack) target.pack = nv.pack;
          if (nv.isNpd) target.isNpd = true;
          if (nv.size && !target.size) target.size = nv.size;
          if (nv.category && !target.category) target.category = nv.category;
          if (nv.subCategory && !target.subCategory) target.subCategory = nv.subCategory;
        } else {
          mergedNoVariant.push(nv);
        }
      }
      result.push(...mergedNoVariant);
    }
  }

  return result;
}

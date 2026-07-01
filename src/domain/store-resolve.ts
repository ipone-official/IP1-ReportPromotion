import * as D from '../infra/master';
import { chainMatch, snapExact, cleanLeadingListMarkers, norm } from './match';
import { RESIDUAL_CLEAN_REGEX } from '../shared/constants';
import {
  englishLoaded,
  englishMatch,
  setEnglishAliases
} from './store-normalizer';
import {
  scanBranches,
  byProvince,
  clearWinner,
  candidatesOf,
  isProvinceDriven,
  stripProvinceToken,
  scanAccounts,
  provinceInText,
  withNearby,
  nearbyAccounts
} from './store-search';
import { preMatchStoreAndBrands, PreMatchResult } from './store-prematch';

export type StoreHit = {
  account?: string;
  branch?: string;
  approx?: boolean;
  candidates?: { account: string; branch: string }[];
  weak?: boolean;
};

export {
  setEnglishAliases,
  englishLoaded,
  englishMatch,
  nearbyAccounts,
  preMatchStoreAndBrands,
  PreMatchResult
};

export function resolveStore(x: any): StoreHit {
  let raw = String(x || '').trim();
  if (!raw) return {};
  raw = cleanLeadingListMarkers(raw);
  const pv = provinceInText(raw);

  // Guard for adjective phrases using 'ใหม่' / 'ร้านใหม่'
  const nt = norm(raw);
  if (nt.includes('ใหม่') || nt.includes('ร้านใหม่')) {
    let start = nt.indexOf('ใหม่');
    while (start !== -1) {
      const prevSegment = nt.substring(Math.max(0, start - 10), start);
      const adjectivePrefixes = [
        'สินค้า', 'กลิ่น', 'สูตร', 'แบรนด์', 'ยี่ห้อ', 'ของ',
        'คู่แข่ง', 'ตัว', 'สี', 'รส', 'แบบ', 'แพ็ค', 'แพค', 'สาขา',
        'ปรับปรุง', 'เปิด', 'ร้าน', 'อัพเดท', 'อัพเดต', 'update',
        'แพ็คเกจ', 'แพคเกจ', 'แพ็คเก็จ', 'แพคเก็จ', 'package',
        'ดีไซน์', 'design', 'ฉลาก', 'ป้าย', 'สื่อ',
        'ถุง', 'ขวด', 'กระป๋อง', 'กล่อง', 'ซอง', 'หลอด', 'แกลลอน', 'ลัง',
        'ขนาด', 'ไซส์', 'size', 'รูปแบบ', 'รุ่น', 'เวอร์ชัน', 'เวอร์ชั่น',
        'ผลิตภัณฑ์', 'เปลี่ยน', 'จัด', 'ทำ', 'ปรับ', 'ลด', 'เพิ่ม',
        'ราคา', 'โปรโมชั่น', 'โปร', 'แถม', 'แจก'
      ];
      if (adjectivePrefixes.some(pref => prevSegment.endsWith(pref))) {
        if (!pv) return {};
      }
      start = nt.indexOf('ใหม่', start + 1);
    }
  }

  const full = scanBranches(raw, D.accounts);
  const fullP = byProvince(full, pv);

  if (pv && fullP.length && fullP[0].score >= 0.85 && clearWinner(fullP, 0.1) && !isProvinceDriven(raw, fullP[0])) {
    const clean = stripProvinceToken(raw, pv);
    if (clean && clean !== raw && fullP.length >= 2) {
      const sc = (h: any) => scanBranches(clean, [h.account]).find((x) => x.branch === h.branch)?.score ?? 0;
      if (sc(fullP[1]) > sc(fullP[0])) return candidatesOf(fullP);
    }
    return { account: fullP[0].account, branch: fullP[0].branch, approx: fullP[0].score < 1 };
  }

  if (full.length && full[0].score >= 0.92 && clearWinner(full) && !isProvinceDriven(raw, full[0])) {
    return { account: full[0].account, branch: full[0].branch, approx: full[0].score < 1 };
  }

  const accHits = scanAccounts(raw);
  if (accHits.length && (accHits.length === 1 || accHits[0].score - accHits[1].score >= 0.08)) {
    const acc = accHits[0].account;
    let within = byProvince(scanBranches(raw, [acc]), pv);
    if (!within.length) {
      const cm = chainMatch(raw);
      const cmRe = cm && cm.account === acc ? new RegExp(cm.alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') : null;
      const resid = cmRe && cmRe.test(raw) ? raw.replace(cmRe, '').trim() : '';
      if (resid && resid !== raw) {
        within = byProvince(scanBranches(resid, [acc]), pv);
        if (!within.length) {
          const typedBr = resid.replace(RESIDUAL_CLEAN_REGEX, '').trim();
          if (typedBr && typedBr.toLowerCase().trim().length >= 2) return { account: acc, branch: typedBr, approx: true };
        }
      }
    }
    if (within.length && clearWinner(within)) {
      return { account: acc, branch: within[0].branch, approx: accHits[0].score < 1 || within[0].score < 1 };
    }
    return { account: acc, approx: accHits[0].score < 1 };
  }

  const asciiLen = (raw.match(/[a-z]/gi) || []).length;
  if (englishLoaded() && asciiLen >= 2) {
    const em = englishMatch(raw);
    if (em.account) {
      if (!em.branch) {
        const within = byProvince(scanBranches(raw, [em.account]), pv);
        if (within.length && clearWinner(within)) {
          return { account: em.account, branch: within[0].branch, approx: true };
        }
      }
      return em;
    }
    if (em.candidates && em.candidates.length > 0) return em;
  }

  const chain = chainMatch(raw);
  if (chain && D.accounts.includes(chain.account)) {
    const re = new RegExp(chain.alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    const residual = re.test(raw) ? raw.replace(re, '').trim() : raw;
    const within = byProvince(scanBranches(residual || raw, [chain.account]), pv);
    if (within.length && clearWinner(within)) return { account: chain.account, branch: within[0].branch, approx: within[0].score < 1 };
    const ambig = within.filter((h) => h.score >= 0.85);
    if (ambig.length >= 2) return { account: chain.account, ...candidatesOf(ambig) };
    const typedBr = residual && residual !== raw ? residual.replace(RESIDUAL_CLEAN_REGEX, '').trim() : '';
    if (typedBr && typedBr.toLowerCase().trim().length >= 2) return { account: chain.account, branch: typedBr, approx: true };
    return { account: chain.account };
  }

  const strong = fullP.filter((h) => h.score >= 0.8 && !isProvinceDriven(raw, h));
  if (strong.length) return withNearby(candidatesOf(strong), raw);

  const exact = snapExact(raw, D.accounts);
  if (exact) {
    const within = byProvince(scanBranches(raw, [exact]), pv);
    if (within.length && clearWinner(within)) return { account: exact, branch: within[0].branch, approx: within[0].score < 1 };
    return { account: exact };
  }

  const weakHits = fullP.filter((h) => !isProvinceDriven(raw, h));
  if (weakHits.length) return withNearby({ ...candidatesOf(weakHits), weak: true }, raw);
  return {};
}

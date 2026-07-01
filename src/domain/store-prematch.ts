import * as D from '../infra/master';
import { norm } from './match';
import { enList, accCore, accCoreWithTones } from './store-normalizer';

export type PreMatchResult = {
  account?: string;
  branch?: string;
  brands: string[];
  hasSecondStore?: boolean;
  secondStoreName?: string;
};

type ScannedEntity = {
  value: string;
  matchedText: string;
  start: number;
  end: number;
};

function scanEntities(
  nt: string,
  terms: { key: string; canonical: string }[]
): ScannedEntity[] {
  const sorted = [...terms].sort((a, b) => b.key.length - a.key.length);
  const matches: ScannedEntity[] = [];
  const matchedRanges: { start: number; end: number }[] = [];

  for (const term of sorted) {
    const isAlphanumeric2 = term.key.length === 2 && /^[a-z0-9]+$/i.test(term.key);
    if (term.key.length < 3 && !isAlphanumeric2) continue;
    let index = nt.indexOf(term.key);
    while (index !== -1) {
      const start = index;
      const end = index + term.key.length;
      const overlaps = matchedRanges.some(r => !(end <= r.start || start >= r.end));
      
      let isFalseStoreMatch = false;
      if (isAlphanumeric2) {
        const charBefore = start > 0 ? nt[start - 1] : '';
        const charAfter = end < nt.length ? nt[end] : '';
        if (/^[a-z0-9]$/i.test(charBefore) || /^[a-z0-9]$/i.test(charAfter)) {
          isFalseStoreMatch = true;
        }
      }

      if (term.canonical === 'ใหม่' || term.canonical === 'ร้านใหม่') {
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
          isFalseStoreMatch = true;
        }
      }
      if (!overlaps && !isFalseStoreMatch) {
        matches.push({
          value: term.canonical,
          matchedText: term.key,
          start,
          end
        });
        matchedRanges.push({ start, end });
      }
      index = nt.indexOf(term.key, index + 1);
    }
  }
  return matches;
}

export function preMatchStoreAndBrands(rawText: string): PreMatchResult {
  const nt = norm(rawText);
  const brandTerms: { key: string; canonical: string }[] = [];
  for (const b of D.brands) {
    brandTerms.push({ key: norm(b), canonical: b });
  }
  for (const alias of D.aliasRows) {
    if (alias.kind === 'brand') {
      brandTerms.push({ key: norm(alias.alias), canonical: alias.canonical });
    }
  }

  const scannedBrands = scanEntities(nt, brandTerms);
  const storeTerms: { key: string; canonical: string }[] = [];
  for (const acc of D.accounts) {
    storeTerms.push({ key: norm(acc), canonical: acc });
    const core = accCore(acc);
    if (core && core.length >= 4) {
      storeTerms.push({ key: core, canonical: acc });
    }
    const coreWT = accCoreWithTones(acc);
    if (coreWT && coreWT.length >= 4 && coreWT !== core && coreWT !== norm(acc)) {
      storeTerms.push({ key: coreWT, canonical: acc });
    }
  }
  for (const alias of D.aliasRows) {
    if (alias.kind === 'store') {
      storeTerms.push({ key: norm(alias.alias), canonical: alias.canonical });
    }
  }
  for (const item of enList) {
    storeTerms.push({ key: norm(item.n), canonical: item.account });
  }


  const scannedAccounts = scanEntities(nt, storeTerms);

  type TempStore = {
    account: string;
    branch?: string;
    start: number;
    end: number;
  };
  const matchedStores: TempStore[] = [];

  for (const accEnt of scannedAccounts) {
    const branches = D.branchesByAccount[accEnt.value] || [];
    const branchTerms = branches.map(br => ({ key: norm(br), canonical: br }));
    const scannedBranches = scanEntities(nt, branchTerms);

    if (scannedBranches.length > 0) {
      for (const brEnt of scannedBranches) {
        matchedStores.push({
          account: accEnt.value,
          branch: brEnt.value,
          start: Math.min(accEnt.start, brEnt.start),
          end: Math.max(accEnt.end, brEnt.end),
        });
      }
    } else {
      matchedStores.push({
        account: accEnt.value,
        start: accEnt.start,
        end: accEnt.end,
      });
    }
  }

  if (matchedStores.length === 0) {
    return {
      brands: scannedBrands.map(b => b.value),
    };
  }

  matchedStores.sort((a, b) => a.start - b.start);

  if (matchedStores.length === 1) {
    return {
      account: matchedStores[0].account,
      branch: matchedStores[0].branch,
      brands: scannedBrands.map(b => b.value),
      hasSecondStore: false,
    };
  }

  const primaryStore = matchedStores[0];
  const secondStore = matchedStores[1];
  const secondStoreName = [secondStore.account, secondStore.branch].filter(Boolean).join(' ');
  const boundary = secondStore.start;
  const primaryBrands: string[] = [];

  for (const b of scannedBrands) {
    if (b.start < boundary) {
      primaryBrands.push(b.value);
    }
  }

  return {
    account: primaryStore.account,
    branch: primaryStore.branch,
    brands: primaryBrands,
    hasSecondStore: true,
    secondStoreName,
  };
}

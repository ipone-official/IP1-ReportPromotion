import * as D from '../infra/master';
import { norm, matchMaster, thaiNum, editDist } from './match';
import {
  ESCAPE_RE_REGEX,
  CORE_NORM_STRIP_1,
  CORE_NORM_STRIP_2,
  CORE_NORM_STRIP_3,
  CORE_NORM_STRIP_4,
  ACC_CORE_STRIP_REGEX,
  NORM_ENG_REGEX
} from '../shared/constants';
export type StoreHit = { account?: string; branch?: string; approx?: boolean; candidates?: { account: string; branch: string }[]; weak?: boolean };

export function escapeRe(s: string): string {
  return s.replace(ESCAPE_RE_REGEX, '\\$&');
}

export function coreNorm(s: any): string {
  return thaiNum(String(s || '').toLowerCase())
    .replace(CORE_NORM_STRIP_1, ' ')
    .replace(CORE_NORM_STRIP_2, ' ')
    .replace(CORE_NORM_STRIP_3, '')
    .replace(CORE_NORM_STRIP_4, '')
    .trim();
}

export function accCore(s: any): string {
  return coreNorm(String(s || '').replace(ACC_CORE_STRIP_REGEX, ' '));
}

export function accCoreWithTones(s: any): string {
  return norm(String(s || '').replace(ACC_CORE_STRIP_REGEX, ' '));
}

export function locExpand(text: string): string[] {
  const out = [text];
  const v = norm(text);
  for (const r of D.aliasRows) {
    if (r.kind !== 'location' || !r.alias) continue;
    const na = norm(r.alias);
    if (na && v.includes(na)) {
      out.push(new RegExp(escapeRe(r.alias), 'i').test(text) ? text.replace(new RegExp(escapeRe(r.alias), 'i'), r.canonical) : r.canonical);
    }
  }
  return [...new Set(out)];
}

export function normEng(s: any): string {
  return String(s || '').toLowerCase().replace(NORM_ENG_REGEX, '');
}

const enExact = new Map<string, string[]>();
export let enList: { n: string; account: string }[] = [];

export function setEnglishAliases(map: Record<string, string[]>): void {
  enExact.clear();
  enList = [];
  const seen = new Set<string>();
  for (const [acc, arr] of Object.entries(map || {})) {
    if (!Array.isArray(arr) || !D.accounts.includes(acc)) continue;
    for (const al of arr) {
      const n = normEng(al);
      if (n.length < 2) continue;
      const accs = enExact.get(n) || [];
      if (!accs.includes(acc)) accs.push(acc);
      enExact.set(n, accs);
      const key = n + '|' + acc;
      if (!seen.has(key)) { seen.add(key); enList.push({ n, account: acc }); }
    }
  }
}

export function englishLoaded(): number {
  return enList.length;
}

export function englishMatch(raw: any): StoreHit {
  const v = normEng(raw);
  if (v.length < 2 || !enList.length) return {};
  const ex = enExact.get(v);
  if (ex) return ex.length === 1 ? { account: ex[0], approx: true } : { candidates: ex.map((a) => ({ account: a, branch: '' })) };
  if (v.length < 3) return {};
  const pool = new Map<string, number>();
  const bump = (acc: string, sc: number) => { const cur = pool.get(acc) || 0; if (sc > cur) pool.set(acc, sc); };
  for (const cb of matchMaster(v, enList.map((e) => e.n), 0.62).candidates) {
    for (const e of enList) {
      if (e.n === cb.value) bump(e.account, cb.score);
    }
  }
  const maxD = v.length <= 8 ? 1 : 2;
  for (const e of enList) {
    const d = editDist(v, e.n);
    if (d <= maxD) bump(e.account, 1 - d / Math.max(v.length, e.n.length));
  }
  const ranked = [...pool.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return {};
  const clear = ranked.length === 1 || ranked[0][1] - ranked[1][1] >= 0.08;
  if (clear && ranked[0][1] >= 0.84) return { account: ranked[0][0], approx: true };
  return { candidates: ranked.slice(0, 6).map(([a]) => ({ account: a, branch: '' })) };
}

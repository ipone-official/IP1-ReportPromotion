import { soundSimilar } from './soundex';
import {
  THAI_DIGITS_STR,
  NORM_CHAR_MAP_REGEX,
  NORM_WHITESPACE_REGEX,
  TONE_STRIP_REGEX,
  LIST_MARKERS_REGEX,
  CHAIN_PREFIX_STRIP_REGEX,
  DEFAULT_SYNONYM_GROUPS
} from '../shared/constants';

let activeSynonymGroups: string[][] = DEFAULT_SYNONYM_GROUPS;

export function setSynonymGroups(groups: string[][]): void {
  activeSynonymGroups = groups;
}

export function thaiNum(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS_STR.indexOf(d)));
}

export function norm(s: any): string {
  return thaiNum(String(s || '').toLowerCase())
    .replace(NORM_CHAR_MAP_REGEX, 'x')
    .replace(NORM_WHITESPACE_REGEX, '')
    .trim();
}

export function editDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
      d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

// ยอมรับ candidate (จาก Meili/fuzzy) ว่าใกล้พอกับคำดิบไหม — รองรับชื่อสั้นที่ matchMaster กันด้วย min-length
// เกณฑ์รัด: phonetic เหมือน / editDist<=1 / (editDist<=2 และยาว>=5) / substring (ยาว>=4) — กัน false positive เช่น "เป๊ปซี่"→"เป็ด"
export function fuzzyBrandAccept(raw: string, cand: string): boolean {
  const nr = norm(raw), nc = norm(cand);
  if (!nr || !nc) return false;
  if (nr === nc) return true;
  // ไม่ใช้ soundSimilar — Thai soundex หยาบเกินสำหรับคำสั้น (เช่น "เป๊ปซี่"≈"เป็ด" เพราะ ซ/ด รหัสชนกัน)
  const d = editDist(nr, nc);
  if (d <= 1) return true;
  if (d <= 2 && Math.min(nr.length, nc.length) >= 5) return true;
  if (Math.min(nr.length, nc.length) >= 4 && (nc.includes(nr) || nr.includes(nc))) return true;
  return false;
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    out.push(s.slice(i, i + 2));
  }
  return out.length ? out : s ? [s] : [];
}

const stripTone = (s: string): string => s.replace(TONE_STRIP_REGEX, '');

function diceRaw(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const cnt = new Map<string, number>();
  for (const g of B) {
    cnt.set(g, (cnt.get(g) || 0) + 1);
  }
  let inter = 0;
  for (const g of A) {
    const c = cnt.get(g) || 0;
    if (c > 0) {
      inter++;
      cnt.set(g, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

function dice(a: string, b: string): number {
  const base = diceRaw(a, b);
  const sa = stripTone(a), sb = stripTone(b);
  return (sa !== a || sb !== b) ? Math.max(base, diceRaw(sa, sb)) : base;
}

export type MatchResult = {
  best?: string;
  score: number;
  candidates: { value: string; score: number }[];
};

const aliases = new Map<string, string>();
let storeAliasList: [string, string][] = [];

export function addAlias(alias: string, canonical: string, kind = 'store') {
  aliases.set(norm(alias), canonical);
  if (kind === 'store') {
    storeAliasList.push([alias, canonical]);
  }
}

export function areSemanticSynonyms(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  for (const group of activeSynonymGroups) {
    const normGroup = group.map(x => norm(x));
    if (normGroup.includes(na) && normGroup.includes(nb)) return true;
    for (const syn1 of normGroup) {
      for (const syn2 of normGroup) {
        if (syn1 === syn2) continue;
        if (na.endsWith(syn1) && nb.endsWith(syn2)) {
          const numA = na.slice(0, -syn1.length);
          const numB = nb.slice(0, -syn2.length);
          if (numA === numB && numA !== '') return true;
        }
      }
    }
  }
  return false;
}

export function matchMaster(value: any, list: string[], threshold = 0.6): MatchResult {
  if (!value || !list.length) return { score: 0, candidates: [] };
  const v = norm(value);

  const al = aliases.get(v);
  if (al && list.includes(al)) return { best: al, score: 1, candidates: [] };

  const exact = list.find((o) => norm(o) === v);
  if (exact) return { best: exact, score: 1, candidates: [] };

  if (v.length < 4) {
    return { score: 0, candidates: [] };
  }

  const scored = list.map((o) => {
    const no = norm(o);
    let sc = dice(v, no);
    if (v.length >= 3 && (no.includes(v) || v.includes(no)) && Math.min(v.length, no.length) / Math.max(v.length, no.length) >= 0.5) {
      sc = Math.max(sc, 0.85);
    }
    // Phonetic similarity is a hint, not a guarantee — only boost moderately
    // and require similar string lengths to prevent "ดาว" matching "ดาวน์นี่"
    const lenRatio = Math.min(v.length, no.length) / Math.max(v.length, no.length);
    if (soundSimilar(v, no) && lenRatio >= 0.7) {
      sc = Math.max(sc, 0.75);
    }
    if (areSemanticSynonyms(v, no)) {
      sc = Math.max(sc, 0.98);
    }
    const editSim = 1 - editDist(v, no) / Math.max(v.length, no.length);
    sc = Math.max(sc, editSim);
    return { value: o, score: Math.round(sc * 100) / 100 };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const candidates = scored.filter((s) => s.score >= threshold).slice(0, 5);
  if (top && top.score >= threshold) {
    const second = scored[1];
    const ambiguous = !!second && second.score >= threshold && top.score - second.score < 0.1;
    return { best: ambiguous ? undefined : top.value, score: top.score, candidates };
  }
  return { score: top ? top.score : 0, candidates };
}

export function snap(value: any, list: string[]): string | undefined {
  return matchMaster(value, list).best;
}

export function snapStrict(value: any, list: string[]): string | undefined {
  if (!value) return undefined;
  const nv = norm(value);
  const ex = list.find((o) => norm(o) === nv);
  if (ex) return ex;

  const m = matchMaster(value, list, 0.85);
  if (m.best) {
    const nb = norm(m.best);
    const lenRatio = Math.min(nb.length, nv.length) / Math.max(nb.length, nv.length);
    if (soundSimilar(nv, nb) && lenRatio >= 0.7) return m.best;
    if (lenRatio >= 0.72) return m.best;
  }

  const fallback = list.find((o) => {
    const no = norm(o);
    const lenRatio = Math.min(nv.length, no.length) / Math.max(nv.length, no.length);
    return soundSimilar(nv, no) && lenRatio >= 0.7;
  });
  if (fallback) return fallback;

  return undefined;
}

export function snapExact(value: any, list: string[]): string | undefined {
  if (!value) return undefined;
  const v = String(value).trim();
  return list.find((o) => o === v) || list.find((o) => o.toLowerCase() === v.toLowerCase());
}

export function cleanLeadingListMarkers(text: string): string {
  return text.replace(LIST_MARKERS_REGEX, '').trim();
}

export function setAliases(rows: { kind: string; alias: string; canonical: string }[]): void {
  aliases.clear();
  storeAliasList = [];
  for (const r of rows) addAlias(r.alias, r.canonical, r.kind);
}

export function chainMatch(text: any): { account: string; alias: string } | undefined {
  const rawClean = cleanLeadingListMarkers(String(text || ''));
  const v = norm(rawClean).replace(/\./g, '');
  if (v.length < 2) return undefined;

  const cleanV = v.replace(CHAIN_PREFIX_STRIP_REGEX, '');
  let best: { account: string; alias: string } | undefined;

  for (const [a, c] of storeAliasList) {
    const na = norm(a).replace(/\./g, '');
    if (na.length < 2) continue;
    const cleanNa = na.replace(CHAIN_PREFIX_STRIP_REGEX, '');

    const matchCandidate = (cleanNa.length >= 2 && cleanV.startsWith(cleanNa)) || (na.length >= 2 && v.startsWith(na));
    if (matchCandidate && (!best || na.length > norm(best.alias).length)) {
      best = { account: c, alias: a };
    }
  }
  return best;
}

export function containsFuzzySubstring(text: string, pattern: string, threshold = 0.75): boolean {
  const nt = norm(text);
  const np = norm(pattern);
  if (!nt || !np) return false;
  if (nt.includes(np)) return true;
  if (np.length < 4) return false;
  const minLen = Math.max(1, np.length - 2);
  const maxLen = np.length + 2;
  for (let i = 0; i < nt.length; i++) {
    for (let len = minLen; len <= maxLen; len++) {
      if (i + len > nt.length) continue;
      const sub = nt.substring(i, i + len);
      const sim = 1 - editDist(sub, np) / Math.max(sub.length, np.length);
      if (sim >= threshold) return true;
    }
  }
  return false;
}



const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
export function thaiNum(s: string): string { return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d))); }

export function norm(s: any): string {
  return thaiNum(String(s || '').toLowerCase()).replace(/[×✕*]/g, 'x').replace(/\s+/g, '').trim();
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
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out.length ? out : s ? [s] : [];
}

const stripTone = (s: string): string => s.replace(/[็-๎]/g, '');

function diceRaw(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const cnt = new Map<string, number>();
  for (const g of B) cnt.set(g, (cnt.get(g) || 0) + 1);
  let inter = 0;
  for (const g of A) { const c = cnt.get(g) || 0; if (c > 0) { inter++; cnt.set(g, c - 1); } }
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
export function addAlias(alias: string, canonical: string) { aliases.set(norm(alias), canonical); }

export function matchMaster(value: any, list: string[], threshold = 0.6): MatchResult {
  if (!value || !list.length) return { score: 0, candidates: [] };
  const v = norm(value);

  const al = aliases.get(v);
  if (al && list.includes(al)) return { best: al, score: 1, candidates: [] };

  const exact = list.find((o) => norm(o) === v);
  if (exact) return { best: exact, score: 1, candidates: [] };

  const scored = list.map((o) => {
    const no = norm(o);
    let sc = dice(v, no);
    if (v.length >= 3 && (no.includes(v) || v.includes(no)) && Math.min(v.length, no.length) / Math.max(v.length, no.length) >= 0.5) sc = Math.max(sc, 0.85);
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
  if (!m.best) return undefined;
  const nb = norm(m.best);
  return Math.min(nb.length, nv.length) / Math.max(nb.length, nv.length) >= 0.72 ? m.best : undefined;
}

export function snapExact(value: any, list: string[]): string | undefined {
  if (!value) return undefined;
  const v = String(value).trim();
  return list.find((o) => o === v) || list.find((o) => o.toLowerCase() === v.toLowerCase());
}

let storeAliasList: [string, string][] = [];
export function setAliases(rows: { kind: string; alias: string; canonical: string }[]): void {
  aliases.clear();
  storeAliasList = rows.filter((r) => r.kind === 'store').map((r) => [r.alias, r.canonical] as [string, string]);
  for (const r of rows) addAlias(r.alias, r.canonical);
}

export function chainMatch(text: any): { account: string; alias: string } | undefined {
  const v = norm(text);
  if (v.length < 3) return undefined;
  let best: { account: string; alias: string } | undefined;
  for (const [a, c] of storeAliasList) {
    const na = norm(a);

    if (na.length >= 2 && v.startsWith(na) && (!best || na.length > norm(best.alias).length)) best = { account: c, alias: a };
  }
  return best;
}


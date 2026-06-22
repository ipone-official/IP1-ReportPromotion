import * as D from '../infra/master';
import { matchMaster, chainMatch, norm, snapExact, thaiNum, editDist } from './match';

export type StoreHit = { account?: string; branch?: string; approx?: boolean; candidates?: { account: string; branch: string }[]; weak?: boolean };
type BrHit = { account: string; branch: string; score: number };

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function coreNorm(s: any): string {
  return thaiNum(String(s || '').toLowerCase())
    .replace(/[()]/g, ' ')
    .replace(/สาขา|จังหวัด|จ\.|อ\.|ต\.|ม\.|\bm\s*\d+\b/gi, ' ')
    .replace(/[็-๎]/g, '')
    .replace(/[.\s\-]/g, '')
    .trim();
}

function locExpand(text: string): string[] {
  const out = [text];
  const v = norm(text);
  for (const r of D.aliasRows) {
    if (r.kind !== 'location' || !r.alias) continue;
    const na = norm(r.alias);
    if (na && v.includes(na)) out.push(new RegExp(escapeRe(r.alias), 'i').test(text) ? text.replace(new RegExp(escapeRe(r.alias), 'i'), r.canonical) : r.canonical);
  }
  return [...new Set(out)];
}

function scanBranches(q: string, accounts: string[]): BrHit[] {
  const queries = locExpand(q);
  const dqs = queries.map(coreNorm);
  const hits: BrHit[] = [];
  for (const acc of accounts) {
    for (const br of (D.branchesByAccount[acc] || [])) {
      const dbr = coreNorm(br);
      let best = 0;
      for (let i = 0; i < queries.length; i++) {
        const m = matchMaster(queries[i], [br]);
        let sc = m.best === br ? m.score : (m.candidates[0]?.score || 0);
        const dq = dqs[i];
        if (dq.length >= 3 && dbr) {
          if (dq === dbr) sc = Math.max(sc, 1);
          else if (dbr.includes(dq) || dq.includes(dbr)) sc = Math.max(sc, 0.88);
        }
        if (sc > best) best = sc;
      }
      if (best >= 0.6) hits.push({ account: acc, branch: br, score: best });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}
function clearWinner(hits: BrHit[], gap = 0.12): boolean {
  return hits.length === 1 || (hits.length > 1 && hits[0].score - hits[1].score >= gap);
}

function candidatesOf(hits: BrHit[]): StoreHit {
  const seen = new Set<string>();
  const cand = hits.filter((h) => { const k = h.account + '|' + h.branch; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  return { candidates: cand.map((h) => ({ account: h.account, branch: h.branch })) };
}

function withNearby(hit: StoreHit, raw: string): StoreHit {
  const existing = new Set((hit.candidates || []).map((c) => c.account));
  const fresh = nearbyAccounts(raw, 5).filter((a) => !existing.has(a));
  if (!fresh.length) return hit;
  return { ...hit, candidates: [...fresh.map((a) => ({ account: a, branch: '' })), ...(hit.candidates || [])].slice(0, 10) };
}

function accCore(s: any): string {
  return coreNorm(String(s || '').replace(/บริษัท|มหาชน|ห้างหุ้นส่วนจำกัด|ห้างหุ้นส่วน|หจก\.?|จำกัด|จก\.?|ร้าน|ค้าส่ง/gi, ' '));
}
function isProvinceLike(coreT: string): boolean {
  if (coreT.length < 4) return false;
  const seen = new Set<string>();
  for (const acc of D.accounts) {
    const brs = D.branchesByAccount[acc] || [];
    if (brs.some((br) => { const cb = coreNorm(br); return cb === coreT || cb.startsWith(coreT); })) {
      seen.add(acc); if (seen.size >= 2) return true;
    }
  }
  return false;
}

function scanAccounts(q: string): { account: string; score: number }[] {
  const dqFull = accCore(q);
  if (dqFull.length < 5) return [];
  const toks = String(q).trim().split(/\s+/).filter(Boolean);
  const head = toks.length >= 2 ? accCore(toks.slice(0, -1).join(' ')) : '';
  const headOk = head.length >= 4 && !isProvinceLike(head);
  const singleOk = toks.length < 2 && !isProvinceLike(dqFull);
  const hits: { account: string; score: number }[] = [];
  for (const acc of D.accounts) {
    const da = accCore(acc);
    if (da.length < 5) continue;
    let sc = 0;
    if (dqFull === da) sc = 1;
    else if (headOk && (da === head || da.startsWith(head) || head.startsWith(da))) sc = 0.9;
    else if (singleOk && da.includes(dqFull)) sc = 0.85;
    if (sc >= 0.85) hits.push({ account: acc, score: sc });
  }
  return hits.sort((a, b) => b.score - a.score);
}

function provinceInText(raw: string): string | undefined {
  const toks = String(raw).split(/\s+/).map(coreNorm).filter(Boolean);
  if (!toks.length) return undefined;
  for (const pv of D.provinces) { const dp = coreNorm(pv); if (dp && toks.includes(dp)) return pv; }
  return undefined;
}
function byProvince(hits: BrHit[], pv?: string): BrHit[] {
  if (!pv) return hits;
  const dp = coreNorm(pv);
  const m = hits.filter((h) => coreNorm(D.provinceOf[h.account + '|' + h.branch] || '') === dp);
  return m.length ? m : hits;
}
function stripProvinceToken(q: string, pv: string): string {
  const dp = coreNorm(pv);
  return String(q).split(/\s+/).filter((t) => coreNorm(t) !== dp).join(' ').trim();
}

function matchesAccount(text: string, account: string): boolean {
  if (!text) return false;
  const cm = chainMatch(text);
  if (cm && cm.account === account) return true;
  const tc = accCore(text), ac = accCore(account);
  if (tc.length >= 3 && (ac.includes(tc) || tc.includes(ac))) return true;
  return tc.length >= 4 && ac.length >= 4 && editDist(tc, ac) <= (Math.max(tc.length, ac.length) <= 8 ? 2 : 3);
}
function isProvinceDriven(raw: string, hit: BrHit): boolean {
  const pv = provinceInText(raw);
  if (!pv || coreNorm(hit.branch) !== coreNorm(pv)) return false;
  const clean = stripProvinceToken(raw, pv);
  if (!clean || clean === raw) return false;
  return !matchesAccount(clean, hit.account);
}

export function resolveStore(x: any): StoreHit {
  const raw = String(x || '').trim();
  if (!raw) return {};
  const pv = provinceInText(raw);
  const full = scanBranches(raw, D.accounts);
  const fullP = byProvince(full, pv);

  if (pv && fullP.length && fullP[0].score >= 0.85 && clearWinner(fullP, 0.1) && !isProvinceDriven(raw, fullP[0])) {
    const clean = stripProvinceToken(raw, pv);
    if (clean && clean !== raw && fullP.length >= 2) {
      const sc = (h: BrHit) => scanBranches(clean, [h.account]).find((x) => x.branch === h.branch)?.score ?? 0;
      if (sc(fullP[1]) > sc(fullP[0])) return candidatesOf(fullP);
    }
    return { account: fullP[0].account, branch: fullP[0].branch, approx: fullP[0].score < 1 };
  }

  if (full.length && full[0].score >= 0.92 && clearWinner(full) && !isProvinceDriven(raw, full[0])) return { account: full[0].account, branch: full[0].branch, approx: full[0].score < 1 };

  const accHits = scanAccounts(raw);
  if (accHits.length && (accHits.length === 1 || accHits[0].score - accHits[1].score >= 0.08)) {
    const acc = accHits[0].account;
    let within = byProvince(scanBranches(raw, [acc]), pv);
    if (!within.length) {
      const cm = chainMatch(raw);
      const cmRe = cm && cm.account === acc ? new RegExp(escapeRe(cm.alias), 'i') : null;
      const resid = cmRe && cmRe.test(raw) ? raw.replace(cmRe, '').trim() : '';
      if (resid && resid !== raw) {
        within = byProvince(scanBranches(resid, [acc]), pv);
        if (!within.length) {
          const typedBr = resid.replace(/^[-–—.,\s]+|[-–—.,\s]+$/g, '').trim();
          if (typedBr && coreNorm(typedBr).length >= 2) return { account: acc, branch: typedBr, approx: true };
        }
      }
    }
    if (within.length && clearWinner(within)) return { account: acc, branch: within[0].branch, approx: accHits[0].score < 1 || within[0].score < 1 };
    return { account: acc, approx: accHits[0].score < 1 };
  }

  const asciiLen = (raw.match(/[a-z]/gi) || []).length;
  const thaiLen = (raw.match(/[฀-๿]/g) || []).length;
  if (enList.length && asciiLen >= 2 && asciiLen >= thaiLen) {
    const em = englishMatch(raw);
    if (em.account || em.candidates) return em;
  }

  const chain = chainMatch(raw);
  if (chain && D.accounts.includes(chain.account)) {
    const re = new RegExp(escapeRe(chain.alias), 'i');
    const residual = re.test(raw) ? raw.replace(re, '').trim() : raw;
    const within = byProvince(scanBranches(residual || raw, [chain.account]), pv);
    if (within.length && clearWinner(within)) return { account: chain.account, branch: within[0].branch, approx: within[0].score < 1 };
    const ambig = within.filter((h) => h.score >= 0.85);
    if (ambig.length >= 2) return { account: chain.account, ...candidatesOf(ambig) };
    const typedBr = residual && residual !== raw ? residual.replace(/^[-–—.,\s]+|[-–—.,\s]+$/g, '').trim() : '';
    if (typedBr && coreNorm(typedBr).length >= 2) return { account: chain.account, branch: typedBr, approx: true };
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

export function nearbyAccounts(x: any, limit = 5): string[] {
  const dq = accCore(x);
  if (dq.length < 4) return [];
  const coreToAcc = new Map<string, string>();
  const cores: string[] = [];
  for (const acc of D.accounts) {
    const c = accCore(acc);
    if (c.length >= 4 && !coreToAcc.has(c)) { coreToAcc.set(c, acc); cores.push(c); }
  }
  for (const r of D.aliasRows) {
    if ((r.kind !== 'store' && r.kind !== 'chain') || !D.accounts.includes(r.canonical)) continue;
    const c = accCore(r.alias);
    if (c.length >= 4 && !coreToAcc.has(c)) { coreToAcc.set(c, r.canonical); cores.push(c); }
  }
  const out: string[] = [];
  const push = (core: string) => { const acc = coreToAcc.get(core); if (acc && !out.includes(acc)) out.push(acc); };
  for (const cand of matchMaster(dq, cores, 0.55).candidates) { push(cand.value); if (out.length >= limit) break; }
  if (out.length < limit) {
    const ed = cores
      .map((c) => ({ c, d: editDist(dq, c) }))
      .filter((e) => e.d <= (Math.max(dq.length, e.c.length) <= 6 ? 1 : 2))
      .sort((a, b) => a.d - b.d);
    for (const e of ed) { push(e.c); if (out.length >= limit) break; }
  }
  return out.slice(0, limit);
}

function normEng(s: any): string { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
const enExact = new Map<string, string[]>();
let enList: { n: string; account: string }[] = [];
export function setEnglishAliases(map: Record<string, string[]>): void {
  enExact.clear(); enList = [];
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
export function englishLoaded(): number { return enList.length; }
export function englishMatch(raw: any): StoreHit {
  const v = normEng(raw);
  if (v.length < 2 || !enList.length) return {};
  const ex = enExact.get(v);
  if (ex) return ex.length === 1 ? { account: ex[0], approx: true } : { candidates: ex.map((a) => ({ account: a, branch: '' })) };
  if (v.length < 3) return {};
  const pool = new Map<string, number>();
  const bump = (acc: string, sc: number) => { const cur = pool.get(acc) || 0; if (sc > cur) pool.set(acc, sc); };
  for (const c of matchMaster(v, enList.map((e) => e.n), 0.62).candidates) for (const e of enList) if (e.n === c.value) bump(e.account, c.score);
  const maxD = v.length <= 8 ? 1 : 2;
  for (const e of enList) { const d = editDist(v, e.n); if (d <= maxD) bump(e.account, 1 - d / Math.max(v.length, e.n.length)); }
  const ranked = [...pool.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return {};
  const clear = ranked.length === 1 || ranked[0][1] - ranked[1][1] >= 0.08;
  if (clear && ranked[0][1] >= 0.84) return { account: ranked[0][0], approx: true };
  return { candidates: ranked.slice(0, 6).map(([a]) => ({ account: a, branch: '' })) };
}

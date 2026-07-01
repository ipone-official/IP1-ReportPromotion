import * as D from '../infra/master';
import { matchMaster, chainMatch, norm, editDist, cleanLeadingListMarkers } from './match';
import {
  escapeRe,
  coreNorm,
  accCore,
  locExpand
} from './store-normalizer';
import {
  BRANCH_REPLACE_PREFIX_REGEX
} from '../shared/constants';
import { StoreHit } from './store-normalizer';

export type BrHit = { account: string; branch: string; score: number };

export function scanBranches(q: string, accounts: string[]): BrHit[] {
  const cleanQ = cleanLeadingListMarkers(q);
  const queries = locExpand(cleanQ);
  const dqs = queries.map(coreNorm);
  const hits: BrHit[] = [];
  for (const acc of accounts) {
    for (const br of (D.branchesByAccount[acc] || [])) {
      const dbr = coreNorm(br);
      const cleanDbr = dbr.replace(BRANCH_REPLACE_PREFIX_REGEX, '');
      let best = 0;
      for (let i = 0; i < queries.length; i++) {
        const m = matchMaster(queries[i], [br]);
        let sc = m.best === br ? m.score : (m.candidates[0]?.score || 0);
        const dq = dqs[i];
        const cleanDq = dq.replace(BRANCH_REPLACE_PREFIX_REGEX, '');
        
        if (dq.length >= 3 && dbr) {
          if (dq === dbr) sc = Math.max(sc, 1);
          else if (dbr.includes(dq) || dq.includes(dbr)) {
            const isShortDbr = dbr.length < 4;
            const ratio = dbr.length / dq.length;
            if (dq.includes(dbr) && isShortDbr && ratio < 0.35) {
              sc = Math.max(sc, 0.3);
            } else {
              sc = Math.max(sc, 0.88);
            }
          }
        }
        if (cleanDbr && cleanDq && cleanDq.length >= 2) {
          if (cleanDq === cleanDbr) sc = Math.max(sc, 1);
          else if (cleanDbr.includes(cleanDq) || cleanDq.includes(cleanDbr)) {
            const isShortDbr = cleanDbr.length < 4;
            const ratio = cleanDbr.length / cleanDq.length;
            if (cleanDq.includes(cleanDbr) && isShortDbr && ratio < 0.35) {
              sc = Math.max(sc, 0.3);
            } else {
              sc = Math.max(sc, 0.95);
            }
          }
        }
        if (sc > best) best = sc;
      }
      if (best >= 0.6) hits.push({ account: acc, branch: br, score: best });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

export function clearWinner(hits: BrHit[], gap = 0.12): boolean {
  if (hits.length && hits[0].score >= 1) return true;
  return hits.length === 1 || (hits.length > 1 && hits[0].score - hits[1].score >= gap);
}

export function candidatesOf(hits: BrHit[]): StoreHit {
  const seen = new Set<string>();
  const cand = hits.filter((h) => { const k = h.account + '|' + h.branch; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  return { candidates: cand.map((h) => ({ account: h.account, branch: h.branch })) };
}

export function withNearby(hit: StoreHit, raw: string): StoreHit {
  const existing = new Set((hit.candidates || []).map((c) => c.account));
  const fresh = nearbyAccounts(raw, 5).filter((a) => !existing.has(a));
  if (!fresh.length) return hit;
  return { ...hit, candidates: [...fresh.map((a) => ({ account: a, branch: '' })), ...(hit.candidates || [])].slice(0, 10) };
}

export function isProvinceLike(coreT: string): boolean {
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

export function scanAccounts(q: string): { account: string; score: number }[] {
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

export function provinceInText(raw: string): string | undefined {
  const toks = String(raw).split(/\s+/).map(coreNorm).filter(Boolean);
  if (!toks.length) return undefined;
  for (const pv of D.provinces) { const dp = coreNorm(pv); if (dp && toks.includes(dp)) return pv; }
  return undefined;
}

export function byProvince(hits: BrHit[], pv?: string): BrHit[] {
  if (!pv) return hits;
  const dp = coreNorm(pv);
  const m = hits.filter((h) => coreNorm(D.provinceOf[h.account + '|' + h.branch] || '') === dp);
  return m.length ? m : hits;
}

export function stripProvinceToken(q: string, pv: string): string {
  const dp = coreNorm(pv);
  return String(q).split(/\s+/).filter((t) => coreNorm(t) !== dp).join(' ').trim();
}

export function matchesAccount(text: string, account: string): boolean {
  if (!text) return false;
  const cm = chainMatch(text);
  if (cm && cm.account === account) return true;
  const tc = accCore(text), ac = accCore(account);
  if (tc.length >= 3 && (ac.includes(tc) || tc.includes(ac))) return true;
  return tc.length >= 4 && ac.length >= 4 && editDist(tc, ac) <= (Math.max(tc.length, ac.length) <= 8 ? 2 : 3);
}

export function isProvinceDriven(raw: string, hit: BrHit): boolean {
  const pv = provinceInText(raw);
  if (!pv || coreNorm(hit.branch) !== coreNorm(pv)) return false;
  const clean = stripProvinceToken(raw, pv);
  if (!clean || clean === raw) return false;
  return !matchesAccount(clean, hit.account);
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
  for (const cb of matchMaster(dq, cores, 0.55).candidates) { push(cb.value); if (out.length >= limit) break; }
  if (out.length < limit) {
    const ed = cores
      .map((c) => ({ c, d: editDist(dq, c) }))
      .filter((e) => e.d <= (Math.max(dq.length, e.c.length) <= 6 ? 1 : 2))
      .sort((a, b) => a.d - b.d);
    for (const e of ed) { push(e.c); if (out.length >= limit) break; }
  }
  return out.slice(0, limit);
}

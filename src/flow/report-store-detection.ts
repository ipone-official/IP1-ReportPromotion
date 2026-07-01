import { norm } from '../domain/match';
import { resolveStore } from '../domain/store-resolve';
import { REPORT_KW_REGEX } from '../shared/constants';

function reportTextCandidates(text: string, minLength: number, limit?: number): string[] {
  const parts = text.split(/[\/\n]+/).map((t) => t.trim()).filter((t) => t.length >= minLength);
  return typeof limit === 'number' ? parts.slice(0, limit) : parts;
}

function stripReportKeywords(text: string): string {
  return text.replace(REPORT_KW_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

export function detectReportStore(parsed: any, rawText: string): string | undefined {
  const aiCands: string[] = [];
  if (parsed.account) aiCands.push(String(parsed.account));
  if (parsed.branch) aiCands.push(String(parsed.branch));
  for (const e of (Array.isArray(parsed.extra) ? parsed.extra : [])) {
    const v = typeof e === 'string' ? e : String(e?.value || '');
    if (v) aiCands.push(v);
  }
  for (const candidate of aiCands) {
    for (const text of [candidate, stripReportKeywords(candidate)]) {
      if (text.length < 3) continue;
      const r = resolveStore(text);
      if (r.account) return r.account;
    }
  }

  for (const segment of reportTextCandidates(rawText, 4, 4)) {
    for (const text of [segment, stripReportKeywords(segment)]) {
      if (text.length < 4) continue;
      const r = resolveStore(text);
      if (r.account && !r.approx) return r.account;
    }
  }
  if (parsed.account && String(parsed.account).trim().length >= 3) return String(parsed.account).trim();
  return undefined;
}

export function detectSecondStore(rawText: string, account?: string): string | undefined {
  if (!account) return undefined;
  const current = norm(account);
  for (const segment of reportTextCandidates(rawText, 4)) {
    const r = resolveStore(segment);
    if (r.account && norm(r.account) !== current && !r.approx) {
      return [r.account, r.branch].filter(Boolean).join(' ');
    }
  }
  return undefined;
}

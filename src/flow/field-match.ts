import * as D from '../infra/master';
import { matchMaster, norm } from '../domain/match';
import { Session } from '../shared/types';
import { resolveStore, nearbyAccounts } from '../domain/store-resolve';
import { addApprox, dropApprox, applyStoreChannel } from '../domain/items';
import {
  text,
  selectCard,
  storeSelectCard,
  didYouMeanCard,
  notFoundCard,
  branchDidYouMeanCard,
} from '../view/cards';
import { optionsFor, afterField, splitMultiValue } from './nav';

export function matchFieldText(
  s: Session,
  f: string,
  x: string,
  onSelectCb: (s: Session, step: string, value: string) => any[]
): any[] {
  if (f === 'detail') {
    s.current.detail = x;
    return afterField(s, 'detail');
  }
  if (f === 'reportSubtype') {
    const values = splitMultiValue(x);
    if (values.length > 1) {
      const opts = (optionsFor(f, s) || []).filter((o) => o !== 'อื่นๆ');
      const picked = values.map((v) => matchMaster(v, opts).best || v);
      s.current.reportSubtype = picked.join(', ');
      s.reportSubtypeSelections = undefined;
      return afterField(s, 'reportSubtype');
    }
  }
  if (f === 'account') return matchAccountText(s, x);
  if (f === 'branch') return matchBranchText(s, x, onSelectCb);
  const opts = (optionsFor(f, s) || []).filter((o) => o !== 'อื่นๆ');
  if (opts.length) {
    const m = matchMaster(x, opts);
    if (m.best) return onSelectCb(s, f, m.best);
    if (m.candidates.length) {
      s.step = f;
      if (f === 'brand') s.typedBrand = x;
      else if (f === 'variant') s.typedVariant = x;
      else if (f === 'subCategory') s.typedSubCategory = x;
      else if (f === 'company') s.typedCompany = x;
      else if (f === 'reportSubtype') s.typedReportSubtype = x;
      return [
        text('กรุณาเลือกตัวเลือกที่ถูกต้อง หรือพิมพ์ใหม่อีกครั้งครับ'),
        selectCard(f, s, m.candidates.map((c) => c.value).slice(0, 12)),
      ];
    }
  }
  if (['size', 'variant', 'pack', 'category', 'subCategory', 'reportType', 'reportSubtype'].includes(f)) {
    (s.current as any)[f] = x;
    return afterField(s, f);
  }
  if (f === 'company') {
    s.company = x;
    dropApprox(s, 'company');
    return afterField(s, 'company');
  }
  s.awaitingText = f;
  return [text(`ไม่พบ "${x}" ในระบบครับ กรุณาพิมพ์ใหม่ หรือพิมพ์เพียงบางส่วนของชื่อ`)];
}

export function matchAccountText(s: Session, x: string): any[] {
  const r = resolveStore(x);
  if (r.account) {
    s.storeNew = false;
    s.account = r.account;
    if (r.approx) addApprox(s, 'store'); else dropApprox(s, 'store');
    applyStoreChannel(s);
    if (r.branch) {
      s.branch = r.branch;
      return afterField(s, 'branch');
    }
    s.branch = undefined;
    return afterField(s, 'account');
  }
  if (r.candidates?.length) {
    s.step = 'account';
    s.awaitingText = 'account';
    s.typedStore = x;
    return [storeSelectCard(r.candidates, x)];
  }
  const near = nearbyAccounts(x);
  s.awaitingText = 'account';
  if (near.length) {
    s.step = 'account';
    s.typedStore = x;
    return [didYouMeanCard(x, near)];
  }
  return [notFoundCard(x, 'account')];
}

export function matchBranchText(
  s: Session,
  x: string,
  onSelectCb: (s: Session, step: string, value: string) => any[]
): any[] {
  const opts = D.branchesByAccount[s.account || ''] || [];
  if (opts.length) {
    const m = matchMaster(x, opts);
    const nx = norm(x);
    if (m.best && (norm(m.best) === nx || norm(m.best).includes(nx))) {
      return onSelectCb(s, 'branch', m.best);
    }
    const near = [...new Set([...(m.best ? [m.best] : []), ...m.candidates.map((c) => c.value)])].slice(0, 5);
    if (near.length) {
      s.step = 'branch';
      s.awaitingText = 'branch';
      s.typedStore = x;
      return [branchDidYouMeanCard(x, near, s.account || '')];
    }
  }
  s.branch = x;
  dropApprox(s, 'store');
  return afterField(s, 'branch');
}

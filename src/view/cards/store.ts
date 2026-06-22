import { G } from '../theme';
import { cardHeader, navFooter, optionRow } from './base';

export function didYouMeanCard(typed: string, accounts: string[]): any {
  const rows: any[] = [];
  accounts.forEach((acc, i) => {
    if (i) rows.push({ type: 'separator', color: G.line });
    rows.push(optionRow(acc, { s: 'account', v: acc }));
  });
  return {
    type: 'flex', altText: `ไม่พบ ${typed}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader(`ไม่พบ "${typed}"`, 'ใช่ร้านนี้มั้ย? หรือใช้เป็นร้านใหม่'),
      body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: rows },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingStart: '6px', paddingEnd: '6px', paddingTop: '6px', paddingBottom: '4px',
        contents: [
          { type: 'button', style: 'secondary', height: 'sm', color: G.warn, action: { type: 'postback', label: 'ใช้ชื่อที่พิมพ์เป็นร้านใหม่', data: JSON.stringify({ s: 'usestore', v: typed, f: 'account' }) } },
          navFooter(undefined, true),
        ],
      },
      styles: { footer: { separator: true } },
    },
  };
}

export function branchDidYouMeanCard(typed: string, branches: string[], account: string): any {
  const rows: any[] = [];
  branches.forEach((br, i) => {
    if (i) rows.push({ type: 'separator', color: G.line });
    rows.push(optionRow(br, { s: 'storepick', a: account, b: br }));
  });
  rows.push({ type: 'separator', color: G.line });
  rows.push(optionRow('➕ ใช้ที่พิมพ์เป็นสาขาใหม่', { s: 'usebranch', v: typed }));
  return {
    type: 'flex', altText: `ยืนยันสาขา ${typed}`,
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader(`สาขา "${typed}"`, 'ใช่สาขานี้มั้ย? หรือเป็นสาขาใหม่'),
      body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: rows },
      footer: navFooter(undefined, true),
    },
  };
}

export function storeSelectCard(cands: { account: string; branch: string }[], typed?: string): any {
  const body: any[] = [];
  cands.forEach((c, i) => {
    if (i) body.push({ type: 'separator', color: G.line });
    const main = c.branch || c.account;
    const contents: any[] = [{ type: 'text', text: main, size: 'md', color: G.text, weight: 'bold', wrap: true }];
    if (c.branch) contents.push({ type: 'text', text: c.account, size: 'xxs', color: G.sub, wrap: true });
    body.push({
      type: 'box', layout: 'vertical', paddingAll: '12px', spacing: 'xs',
      action: { type: 'postback', data: JSON.stringify({ s: 'storepick', a: c.account, b: c.branch }), displayText: main },
      contents,
    });
  });
  if (typed) {
    body.push({ type: 'separator', color: G.line });
    body.push({
      type: 'box', layout: 'vertical', paddingAll: '12px',
      action: { type: 'postback', data: JSON.stringify({ s: 'usestore', v: typed, f: 'account' }), displayText: 'ใช้ร้านใหม่' },
      contents: [{ type: 'text', text: `ใช้ "${typed}" เป็นร้านใหม่`, size: 'sm', weight: 'bold', color: G.warn, wrap: true }],
    });
  }
  const subtitle = typed ? 'เลือกสาขาที่ใช่ หรือใช้เป็นร้านใหม่ — หรือพิมพ์ชื่อใหม่' : 'กรุณาเลือกสาขาที่ถูกต้อง';
  return { type: 'flex', altText: 'เลือกร้าน/สาขา', contents: { type: 'bubble', size: 'kilo', header: cardHeader('ห้าง / ร้านค้า', subtitle), body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: body }, footer: navFooter(undefined, true) } };
}

export function notFoundCard(x: string, field: 'account' | 'branch'): any {
  return {
    type: 'flex', altText: `ไม่เจอ ${x} ในระบบ`,
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: `ไม่พบ "${x}" ในระบบครับ`, weight: 'bold', size: 'sm', color: G.warnText, wrap: true },
          { type: 'text', text: 'หากหน้างานมีร้านนี้จริง สามารถใช้ตามที่พิมพ์ได้ (ระบบจะระบุเป็น "ร้านใหม่" ให้ทีมงานเพิ่มเข้าระบบ) หรือพิมพ์ชื่อใหม่อีกครั้ง', size: 'xs', color: G.sub, wrap: true },
          { type: 'button', style: 'primary', color: G.warn, height: 'sm', action: { type: 'postback', label: 'ใช้ตามที่พิมพ์ (ร้านใหม่)', data: JSON.stringify({ s: 'usestore', v: x, f: field }) } },
        ],
      },
    },
  };
}

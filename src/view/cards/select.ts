import { G } from '../theme';
import { FIELD_TITLE } from '../../shared/steps';
import { Session } from '../../shared/types';
import { cardHeader, optionRow, navFooter, fieldSubtitle, stepProgress } from './base';

function paginate<T>(items: T[], maxPerPage: number): T[][] {
  if (items.length <= maxPerPage) return [items];
  const nPages = Math.ceil(items.length / maxPerPage);
  const base = Math.floor(items.length / nPages);
  const extra = items.length % nPages;
  const pages: T[][] = [];
  let idx = 0;
  for (let p = 0; p < nPages; p++) {
    const size = base + (p >= nPages - extra ? 1 : 0);
    pages.push(items.slice(idx, idx + size));
    idx += size;
  }
  return pages;
}

export function selectCard(step: string, s: Session, opts: string[], subtitle?: string, clearData?: any, editMode?: boolean): any {
  const title = FIELD_TITLE[step] || step;
  const maxPerPage = step === 'pack' ? 5 : 6;
  const mkRows = (page: string[]): any[] => {
    const rows: any[] = [];
    page.forEach((o, i) => {
      if (i > 0) rows.push({ type: 'separator', color: G.line });
      rows.push(optionRow(o, { s: step, v: o }));
    });
    return rows;
  };
  const mkBubble = (page: string[], progress?: string): any => ({
    type: 'bubble', size: 'kilo',
    header: cardHeader(title, subtitle ?? fieldSubtitle(step, s), progress),
    body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: mkRows(page) },
    footer: navFooter(clearData, editMode ?? (subtitle != null)),
    styles: { footer: { separator: true } },
  });
  const pages = paginate(opts, maxPerPage);
  if (pages.length === 1) {
    const bubble = mkBubble(pages[0], stepProgress(step));
    if (step === 'pack') return { type: 'flex', altText: title, contents: { type: 'carousel', contents: [bubble] } };
    return { type: 'flex', altText: title, contents: bubble };
  }
  const bubbles = pages.map((page, p) => mkBubble(page, `${p + 1}/${pages.length}`));
  return { type: 'flex', altText: title, contents: { type: 'carousel', contents: bubbles } };
}

export function multiSelectCard(step: string, s: Session, opts: string[], selected: string[], subtitle?: string): any {
  const title = FIELD_TITLE[step] || step;
  const selectedSet = new Set(selected);
  const maxPerPage = 6;
  const mkRows = (page: string[]): any[] => {
    const rows: any[] = [];
    page.forEach((o, i) => {
      const picked = selectedSet.has(o);
      if (i > 0) rows.push({ type: 'separator', color: G.line });
      rows.push({
        type: 'box', layout: 'horizontal', paddingTop: '6px', paddingBottom: '6px', paddingStart: '14px', paddingEnd: '14px', spacing: 'sm', alignItems: 'center',
        action: { type: 'postback', data: JSON.stringify({ s: 'togglesubtype', v: o }), displayText: o },
        contents: [
          { type: 'text', text: picked ? '✓' : '+', size: 'sm', color: picked ? G.green : G.faint, weight: 'bold', flex: 0, gravity: 'center' },
          { type: 'text', text: o, size: 'sm', color: G.text, weight: 'bold', flex: 1, wrap: true, gravity: 'center' },
        ],
      });
    });
    return rows;
  };
  const selectedText = selected.length ? `เลือกแล้ว: ${selected.join(', ')}` : 'กดเลือกได้หลายรายการ หรือพิมพ์หลายรายการคั่นด้วย comma/ขึ้นบรรทัดใหม่';
  const mkBubble = (page: string[], progress?: string): any => ({
    type: 'bubble', size: 'kilo',
    header: cardHeader(title, subtitle || selectedText, progress),
    body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: mkRows(page) },
    footer: {
      type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '8px',
      contents: [
        { type: 'button', style: 'primary', color: G.green, height: 'sm', action: { type: 'postback', label: 'เสร็จแล้ว', data: JSON.stringify({ s: 'subtypedone' }), displayText: 'เสร็จแล้ว' } },
        {
          type: 'box', layout: 'horizontal', spacing: 'sm',
          contents: [
            { type: 'button', style: 'link', height: 'sm', color: G.warn, action: { type: 'postback', label: 'ล้าง', data: JSON.stringify({ s: 'subtypeclear' }), displayText: 'ล้างรายการย่อย' } },
            { type: 'button', style: 'link', height: 'sm', color: G.sub, action: { type: 'postback', label: 'ย้อนกลับ', data: JSON.stringify({ s: 'back' }), displayText: 'ย้อนกลับ' } },
          ],
        },
      ],
    },
    styles: { footer: { separator: true } },
  });
  const pages = paginate(opts, maxPerPage);
  if (pages.length === 1) return { type: 'flex', altText: title, contents: mkBubble(pages[0], stepProgress(step)) };
  const bubbles = pages.map((page, p) => mkBubble(page, `${p + 1}/${pages.length}`));
  return { type: 'flex', altText: title, contents: { type: 'carousel', contents: bubbles } };
}

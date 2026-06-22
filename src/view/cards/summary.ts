import { G } from '../theme';
import { Session } from '../../shared/types';
import { getBaseUrl } from '../../infra/photoStore';
import { fmtDate } from './base';
import { itemBubbleBody, itemLine, productsHeader, emptyProductTemplate } from './item';

function storeDisplay(account?: string): string | undefined {
  let acc = (account || '').replace(/\([^)]*\)/g, ' ').replace(/บริษัท|ห้างหุ้นส่วนจำกัด|ห้างหุ้นส่วน|หจก\.?|จำกัด|มหาชน/g, ' ').replace(/\s+/g, ' ').trim();
  if (!acc) acc = (account || '').trim();
  return acc || undefined;
}

function tag(text: string, bg: string, fg: string): any {
  return {
    type: 'box', layout: 'baseline', flex: 0, backgroundColor: bg, cornerRadius: '6px',
    paddingStart: '7px', paddingEnd: '7px', paddingTop: '2px', paddingBottom: '2px',
    contents: [{ type: 'text', text, size: 'xxs', color: fg, weight: 'bold' }],
  };
}

function reportRow(label: string, value: string | undefined, editStep?: string, opts: { approx?: boolean; badge?: any } = {}): any {
  const has = !!(value && String(value).trim());
  const right: any[] = [{ type: 'text', text: has ? String(value) : '—', size: 'sm', weight: has ? 'bold' : 'regular', color: has ? G.text : G.green, align: 'end', wrap: true, maxLines: 3, flex: 1, gravity: 'center' }];
  if (opts.approx && has) right.push({ type: 'text', text: '≈', size: 'sm', color: G.warn, weight: 'bold', flex: 0, gravity: 'center' });
  if (opts.badge) right.push(opts.badge);
  const rowBox: any = {
    type: 'box', layout: 'horizontal', spacing: 'sm', paddingTop: '9px', paddingBottom: '9px', alignItems: 'center',
    contents: [
      { type: 'text', text: label, size: 'sm', color: G.sub, flex: 4, gravity: 'center', wrap: true },
      { type: 'box', layout: 'horizontal', flex: 6, spacing: 'xs', alignItems: 'center', contents: right },
    ],
  };
  if (editStep) rowBox.action = { type: 'postback', data: JSON.stringify({ s: 'editfield', v: editStep }) };
  return { type: 'box', layout: 'vertical', spacing: 'none', contents: [rowBox, { type: 'separator', color: G.line }] };
}

function photoBubble(s: Session): any {
  const keys = s.photoKeys || [];
  const n = keys.length;
  const base = getBaseUrl();
  const perRow = n <= 1 ? 1 : n === 2 ? 2 : 3;
  const grid: any[] = [];
  for (let i = 0; i < n; i += perRow) {
    const cells: any[] = keys.slice(i, i + perRow).map((k, j) => ({
      type: 'image', url: `${base}/photo/${k}`, flex: 1, aspectRatio: '1:1', aspectMode: 'cover', size: 'full',
      action: { type: 'postback', label: 'ลบรูป', data: JSON.stringify({ s: 'delphoto', ki: i + j }) },
    }));
    while (cells.length < perRow) cells.push({ type: 'box', layout: 'vertical', flex: 1, contents: [{ type: 'filler' }] });
    grid.push({ type: 'box', layout: 'horizontal', spacing: 'xs', margin: i ? 'xs' : 'md', contents: cells });
  }
  const body: any[] = [
    {
      type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center', paddingTop: '12px', paddingBottom: '8px',
      contents: [
        { type: 'box', layout: 'vertical', width: '5px', height: '22px', backgroundColor: G.accent, cornerRadius: '3px', flex: 0, contents: [{ type: 'filler' }] },
        { type: 'text', text: 'รูปประกอบการแจ้ง', size: 'lg', weight: 'bold', color: G.text, flex: 1 },
        { type: 'text', text: `${n} รูป`, size: 'xs', color: G.green, align: 'end', flex: 0, gravity: 'center' },
      ],
    },
    { type: 'separator', color: G.line },
  ];
  if (n) {
    body.push(...grid);
    body.push({ type: 'text', text: 'แตะรูปเพื่อลบ', size: 'xxs', color: G.faint, margin: 'sm' });
  } else {
    body.push({ type: 'text', text: 'ยังไม่มีรูป — ส่งรูปในแชทได้เลย หรือกดปุ่มด้านล่าง', size: 'xs', color: G.sub, wrap: true, margin: 'md' });
  }
  return {
    type: 'bubble', size: 'mega',
    body: { type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '8px', paddingBottom: '12px', contents: body },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '12px',
      contents: [{ type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: 'แนบรูป', data: JSON.stringify({ s: 'addphoto' }) } }],
    },
  };
}

function reportCardBody(s: Session): any[] {
  const body: any[] = [];
  body.push({
    type: 'box', layout: 'horizontal', paddingTop: '12px', paddingBottom: '10px', spacing: 'sm', alignItems: 'center',
    contents: [
      { type: 'box', layout: 'vertical', width: '5px', height: '22px', backgroundColor: G.accent, cornerRadius: '3px', flex: 0, contents: [{ type: 'filler' }] },
      { type: 'text', text: 'สรุปรายการแจ้ง', size: 'xl', weight: 'bold', color: G.text, flex: 1 },
      tag('รอยืนยัน', G.chipBg, G.chipText),
    ],
  });
  const dateText = s.startDate && !s.endDate
    ? `${fmtDate(s.startDate)} เป็นต้นไป`
    : [s.startDate, s.endDate].map(fmtDate).filter(Boolean).join(' – ');
  body.push(
    reportRow('หัวข้อ', s.topicName, 'topic', { approx: s.approx?.includes('topic') }),
    reportRow('ช่องทาง', s.channel, 'channel', { approx: s.approx?.includes('channel') }),
    reportRow('ร้าน / ห้าง', storeDisplay(s.account), 'account', { approx: s.approx?.includes('store'), badge: s.storeNew ? tag('ร้านใหม่', G.green, G.greenSoft) : undefined }),
    reportRow('สาขา', s.branch, 'branch'),
    reportRow('บริษัท', s.company, 'company', { approx: s.approx?.includes('company') }),
    reportRow('ช่วงวันที่', dateText || undefined, 'startDate'),
    reportRow('ข้อมูลเพิ่มเติม', s.extra?.length ? s.extra.join(' · ') : undefined, s.extra?.length ? 'extra' : undefined),
  );
  return body;
}

function summaryFooter(): any {
  return {
    type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
    contents: [
      {
        type: 'box', layout: 'horizontal', spacing: 'sm',
        contents: [
          { type: 'button', style: 'secondary', height: 'sm', flex: 1, action: { type: 'postback', label: 'เริ่มใหม่', data: JSON.stringify({ s: 'restart' }) } },
          { type: 'button', style: 'secondary', height: 'sm', flex: 1, action: { type: 'postback', label: '+ เพิ่มสินค้า', data: JSON.stringify({ s: 'additem' }) } },
          { type: 'button', style: 'primary', color: G.green, height: 'sm', flex: 1, action: { type: 'postback', label: 'บันทึก', data: JSON.stringify({ s: 'save' }) } },
        ],
      },
    ],
  };
}

const MAX_PRODUCT_BUBBLES = 10;

function summaryCarousel(s: Session): any {
  const reportBubble = {
    type: 'bubble', size: 'mega',
    body: { type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '8px', paddingBottom: '8px', contents: reportCardBody(s) },
    footer: summaryFooter(),
  };
  const bubbles: any[] = [reportBubble];
  if (!s.items.length) {
    bubbles.push({
      type: 'bubble', size: 'mega', header: productsHeader(0, 0, 1),
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: '16px',
        contents: [
          { type: 'text', text: 'แตะแต่ละช่องเพื่อกรอก หรือกด "+ เพิ่มสินค้า" ด้านบนเพื่อพิมพ์', size: 'xs', color: G.sub, margin: 'sm', wrap: true },
          ...emptyProductTemplate(),
        ],
      },
    });
  } else {
    const total = s.items.length;
    const chunk = Math.ceil(total / MAX_PRODUCT_BUBBLES);
    const pages = Math.ceil(total / chunk);
    for (let p = 0; p < pages; p++) {
      const start = p * chunk;
      const rows: any[] = [];
      s.items.slice(start, start + chunk).forEach((it, li) => {
        const gi = start + li;
        if (li > 0) rows.push({ type: 'separator', margin: 'xl', color: G.line });
        rows.push(...itemBubbleBody(it, gi));
      });
      bubbles.push({
        type: 'bubble', size: 'mega', header: productsHeader(total, p, pages),
        body: { type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '2px', paddingBottom: '12px', contents: rows },
      });
    }
  }
  bubbles.push(photoBubble(s));
  let card: any = { type: 'flex', altText: 'สรุปรายการที่จะแจ้ง', contents: { type: 'carousel', contents: bubbles } };
  if (s.items.length && JSON.stringify(card).length > 48000) {
    const compact = {
      type: 'bubble', size: 'mega', header: productsHeader(s.items.length, 0, 1),
      body: { type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '8px', paddingBottom: '12px', contents: s.items.map((it, i) => itemLine(it, i)) },
    };
    card = { type: 'flex', altText: 'สรุปรายการที่จะแจ้ง', contents: { type: 'carousel', contents: [reportBubble, compact, photoBubble(s)] } };
  }
  return card;
}

export function summaryFlex(s: Session): any {
  return summaryCarousel(s);
}

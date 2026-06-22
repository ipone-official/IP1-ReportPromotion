import { G } from '../theme';
import { FIELD_TITLE } from '../../shared/steps';
import { Session } from '../../shared/types';
import { cardHeader, optionRow, navFooter, fieldSubtitle, stepProgress, fmtDate } from './base';

export function promptText(step: string, s: Session): string {
  const n = s.items.length + 1;
  const map: Record<string, string> = {
    topic: 'จะแจ้งเรื่องอะไรดีครับ?',
    channel: 'ช่องทางไหนครับ?',
    account: 'ห้าง/ร้านค้าไหนครับ?',
    branch: 'สาขาไหนครับ?',
    company: 'บริษัทอะไรครับ?',
    category: `── สินค้าตัวที่ ${n} ──\nกลุ่มสินค้า (Cat.)?`,
    subCategory: 'ประเภทสินค้า (Sub.Cat)?',
    brand: `ยี่ห้อ (ประเภท: ${s.current.subCategory || '-'})?`,
    size: 'ไซส์?',
    pack: 'แพ็ค?',
    variant: 'กลิ่น/สี/รสชาติ?',
    addMore: 'เพิ่มสินค้าอีกไหมครับ?',
    reportType: 'รายการที่จะแจ้ง?',
    reportSubtype: 'รายการย่อย?',
  };
  return map[step] || step;
}

export function selectCard(step: string, s: Session, opts: string[], subtitle?: string, clearData?: any, editMode?: boolean): any {
  const title = FIELD_TITLE[step] || step;
  const MAX_PER = 6;
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
  if (opts.length <= MAX_PER) {
    return { type: 'flex', altText: title, contents: mkBubble(opts, stepProgress(step)) };
  }
  const nPages = Math.ceil(opts.length / MAX_PER);
  const base = Math.floor(opts.length / nPages);
  const extra = opts.length % nPages;
  const pages: string[][] = [];
  let idx = 0;
  for (let p = 0; p < nPages; p++) {
    const size = base + (p >= nPages - extra ? 1 : 0);
    pages.push(opts.slice(idx, idx + size));
    idx += size;
  }
  const bubbles = pages.map((page, p) => mkBubble(page, `${p + 1}/${nPages}`));
  return { type: 'flex', altText: title, contents: { type: 'carousel', contents: bubbles } };
}

export function topicPickCard(topicNames: string[], current?: string): any {
  const rows: any[] = [];
  topicNames.forEach((name, i) => {
    if (i > 0) rows.push({ type: 'separator', color: G.line });
    rows.push({
      type: 'box', layout: 'horizontal', paddingTop: '8px', paddingBottom: '8px', spacing: 'sm', alignItems: 'center',
      action: { type: 'postback', data: JSON.stringify({ s: 'picktopic', v: name }), displayText: name },
      contents: [
        { type: 'text', text: name, size: 'sm', weight: 'bold', color: G.text, flex: 1, wrap: true, gravity: 'center' },
        { type: 'text', text: '›', size: 'sm', color: G.green, align: 'end', flex: 0, gravity: 'center' },
      ],
    });
  });
  return {
    type: 'flex', altText: 'เลือกหัวข้อที่จะแจ้ง',
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '14px', paddingEnd: '14px', paddingTop: '10px', paddingBottom: '4px',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', width: '4px', height: '16px', backgroundColor: G.accent, cornerRadius: '2px', flex: 0, contents: [{ type: 'filler' }] },
              { type: 'text', text: 'เลือกหัวข้อที่จะแจ้ง', size: 'md', weight: 'bold', color: G.text, flex: 1 },
            ],
          },
          { type: 'text', text: current ? `หัวข้อเดิม: ${current}` : 'แตะเลือกหัวข้อ แล้วพิมพ์รายละเอียดได้เลย', size: 'xxs', color: current ? G.green : G.sub, wrap: true, margin: 'xs' },
          { type: 'separator', color: G.line, margin: 'sm' },
          ...rows,
        ],
      },
    },
  };
}

export function topicReadyCard(topicName: string): any {
  return {
    type: 'flex', altText: `หัวข้อ ${topicName}`,
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '14px', paddingEnd: '14px', paddingTop: '10px', paddingBottom: '10px',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', width: '4px', height: '13px', backgroundColor: G.accent, cornerRadius: '2px', flex: 0, contents: [{ type: 'filler' }] },
              { type: 'text', text: 'หัวข้อที่จะแจ้ง', size: 'xxs', color: G.sub, flex: 1, gravity: 'center' },
            ],
          },
          { type: 'text', text: topicName, size: 'md', weight: 'bold', color: G.text, wrap: true, margin: 'xs' },
          { type: 'separator', color: G.line, margin: 'sm' },
          { type: 'text', text: 'พิมพ์รายละเอียดรายงานได้เลยครับ', size: 'sm', color: G.sub, wrap: true, margin: 'sm' },
        ],
      },
    },
  };
}

export function promptCard(title: string, body: string, clearData?: any): any {
  const contents: any[] = [
    {
      type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
      contents: [
        { type: 'box', layout: 'vertical', width: '4px', height: '15px', backgroundColor: G.accent, cornerRadius: '2px', flex: 0, contents: [{ type: 'filler' }] },
        { type: 'text', text: title, size: 'md', weight: 'bold', color: G.text, flex: 1, wrap: true },
      ],
    },
    { type: 'separator', color: G.line, margin: 'sm' },
    { type: 'text', text: body, size: 'sm', color: G.sub, wrap: true, margin: 'sm' },
  ];
  if (clearData) contents.push({
    type: 'box', layout: 'horizontal', margin: 'md', cornerRadius: '6px', borderColor: G.line, borderWidth: '1px', paddingAll: '6px',
    action: { type: 'postback', data: JSON.stringify(clearData), displayText: 'ลบค่านี้' },
    contents: [{ type: 'text', text: 'ลบค่าช่องนี้', size: 'xs', weight: 'bold', color: G.warn, align: 'center' }],
  });
  return {
    type: 'flex', altText: title,
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '14px', paddingEnd: '14px', paddingTop: '10px', paddingBottom: '10px',
        contents,
      },
    },
  };
}

export function searchCard(step: string, s: Session, count: number, subtitle?: string, clearData?: any, editMode?: boolean): any {
  const title = FIELD_TITLE[step] || step;
  return {
    type: 'flex', altText: title,
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader(title, subtitle ?? fieldSubtitle(step, s), stepProgress(step)),
      body: {
        type: 'box', layout: 'vertical', paddingStart: '14px', paddingEnd: '14px', paddingTop: '10px', paddingBottom: '12px',
        contents: [
          { type: 'text', text: count > 0 ? `พิมพ์ชื่อ${title}เพื่อค้นหา (พิมพ์บางส่วนได้)` : `พิมพ์ชื่อ${title}ได้เลยครับ`, size: 'sm', color: G.text, wrap: true },
        ],
      },
      footer: navFooter(clearData, editMode ?? (subtitle != null)),
      styles: { footer: { separator: true } },
    },
  };
}

export function dateCard(_step: 'startDate' | 'endDate', s?: Session): any {
  const start = s?.startDate;
  const end = s?.endDate;
  const startPicker: any = { type: 'datetimepicker', label: 'เลือกวันเริ่ม', data: JSON.stringify({ s: 'startDate' }), mode: 'date' };
  if (start) startPicker.initial = start;
  const endPicker: any = { type: 'datetimepicker', label: 'เลือกวันจบ', data: JSON.stringify({ s: 'endDate' }), mode: 'date' };
  if (end) endPicker.initial = end; else if (start) endPicker.initial = start;
  if (start) endPicker.min = start;
  const dateRow = (label: string, val?: string): any => ({
    type: 'box', layout: 'horizontal', paddingTop: '3px', paddingBottom: '3px', alignItems: 'center',
    contents: [
      { type: 'text', text: label, size: 'xs', color: G.sub, flex: 0 },
      { type: 'text', text: val ? fmtDate(val) : 'ยังไม่เลือก', size: 'xs', weight: val ? 'bold' : 'regular', color: val ? G.text : G.faint, align: 'end', flex: 1, gravity: 'center' },
    ],
  });
  const chip = (label: string, action: any, primary: boolean): any => {
    const box: any = {
      type: 'box', layout: 'vertical', flex: 1, action, cornerRadius: '6px',
      backgroundColor: primary ? G.green : G.surfLow, paddingTop: '6px', paddingBottom: '6px',
      contents: [{ type: 'text', text: label, size: 'xs', weight: 'bold', align: 'center', color: primary ? '#FFFFFF' : G.green }],
    };
    if (!primary) { box.borderWidth = '1px'; box.borderColor = G.line; }
    return box;
  };
  return {
    type: 'flex', altText: 'ช่วงวันที่',
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '14px', paddingEnd: '14px', paddingTop: '10px', paddingBottom: '6px',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', width: '4px', height: '15px', backgroundColor: G.accent, cornerRadius: '2px', flex: 0, contents: [{ type: 'filler' }] },
              { type: 'text', text: 'ช่วงวันที่', size: 'sm', weight: 'bold', color: G.text, flex: 1 },
            ],
          },
          { type: 'separator', color: G.line, margin: 'sm' },
          dateRow('วันเริ่ม', start),
          dateRow('วันจบ', end),
          {
            type: 'box', layout: 'horizontal', spacing: 'xs', margin: 'sm',
            contents: [chip('เลือกวันเริ่ม', startPicker, true), chip('เลือกวันจบ', endPicker, false)],
          },
        ],
      },
      footer: navFooter(s?.editing && (s?.startDate || s?.endDate) ? { s: 'clrfield', f: 'date' } : undefined, s?.editing),
    },
  };
}

export function photoCard(): any {
  return {
    type: 'flex', altText: 'แนบรูป',
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader('แนบรูปหน้างาน', 'ถ่าย/เลือกรูป หรือส่งรูปในแชท', stepProgress('photo')),
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        contents: [
          { type: 'text', text: 'กรุณากดปุ่มด้านล่าง (ถ่ายรูป / เลือกรูป) หรือส่งรูปในแชทได้เลย', size: 'sm', color: G.text, wrap: true },
        ],
      },
    },
    quickReply: {
      items: [
        { type: 'action', action: { type: 'camera', label: 'ถ่ายรูป' } },
        { type: 'action', action: { type: 'cameraRoll', label: 'เลือกรูป' } },
        { type: 'action', action: { type: 'postback', label: 'ข้าม', data: JSON.stringify({ s: 'photo', v: 'skip' }), displayText: 'ข้าม' } },
      ],
    },
  };
}

export function detailCard(s: Session): any {
  return {
    type: 'flex', altText: 'กรอกรายละเอียด',
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader('กรอกรายละเอียด', s.current.brand ? `โปรของ: ${s.current.brand}` : undefined, stepProgress('detail')),
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
        contents: [
          { type: 'text', text: 'กรุณาพิมพ์รายละเอียดในช่องแชทด้านล่าง', size: 'sm', color: G.text, wrap: true },
          { type: 'text', text: 'เช่น “ซื้อครบ 259 บ. รับตะกร้า 1 ใบ”', size: 'sm', color: G.sub, wrap: true, margin: 'sm' },
        ],
      },
      footer: navFooter(undefined, true),
      styles: { footer: { separator: true } },
    },
  };
}

import { G } from '../theme';
import { ReportItem } from '../../shared/types';

function npdChip(): any {
  return {
    type: 'box', layout: 'baseline', flex: 0, backgroundColor: G.npdBg, cornerRadius: '6px',
    paddingStart: '8px', paddingEnd: '8px', paddingTop: '3px', paddingBottom: '3px',
    contents: [{ type: 'text', text: '🆕 NPD', size: 'xxs', color: '#FFFFFF', weight: 'bold' }],
  };
}

function priceBox(detail: string | undefined, i: number): any {
  const has = !!(detail && String(detail).trim());
  return {
    type: 'box', layout: 'vertical', backgroundColor: G.chipBg, borderColor: G.line, borderWidth: '1px',
    cornerRadius: '12px', paddingAll: '14px', margin: 'md', spacing: 'xs',
    action: { type: 'postback', data: JSON.stringify({ s: 'edititemfield', i, f: 'detail' }) },
    contents: [
      { type: 'text', text: 'ราคา / โปรโมชั่น', size: 'xxs', color: G.sub },
      { type: 'text', text: has ? String(detail) : 'แตะใส่ราคา/โปร', size: 'md', weight: 'bold', color: has ? G.greenDeep : G.faint, wrap: true },
    ],
  };
}

function specCell(i: number, field: string, label: string, value?: string, approx?: boolean): any {
  const has = !!(value && String(value).trim());
  return {
    type: 'box', layout: 'vertical', flex: 1, spacing: 'none', paddingTop: '4px', paddingBottom: '4px', paddingEnd: '6px',
    action: { type: 'postback', data: JSON.stringify({ s: 'edititemfield', i, f: field }) },
    contents: [
      { type: 'text', text: label, size: 'xxs', color: G.sub },
      { type: 'text', text: (has ? String(value) : '+ เพิ่ม') + (approx && has ? '  ≈' : ''), size: 'sm', weight: 'bold', color: has ? G.text : G.green, wrap: true, maxLines: 3 },
    ],
  };
}

export function itemLine(p: ReportItem, i: number): any {
  const parts = [p.brand || p.rawBrand || '(ยังไม่ระบุยี่ห้อ)', p.size, p.variant, p.pack, p.detail].filter(Boolean).join('  ·  ');
  return {
    type: 'box', layout: 'baseline', paddingTop: '6px', paddingBottom: '6px',
    action: { type: 'postback', data: JSON.stringify({ s: 'edititem', v: String(i) }) },
    contents: [{ type: 'text', text: `${i + 1}.  ${parts}${p.needsReview ? '  🆕' : ''}`, size: 'sm', color: G.text, wrap: true, maxLines: 2 }],
  };
}

function specGrid(left: any, right?: any): any {
  return { type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm', contents: [left, right || { type: 'box', layout: 'vertical', flex: 1, contents: [{ type: 'filler' }] }] };
}

export function itemBubbleBody(p: ReportItem, i: number): any[] {
  const brand = p.brand || p.rawBrand || '(ยังไม่ระบุยี่ห้อ)';
  const rows: any[] = [];
  rows.push({
    type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'none', alignItems: 'center',
    contents: [
      { type: 'text', text: `${i + 1}. ${brand}`, size: 'xl', weight: 'bold', color: G.text, flex: 1, wrap: true, maxLines: 2, action: { type: 'postback', data: JSON.stringify({ s: 'edititemfield', i, f: 'brand' }) } },
      ...(p.needsReview ? [npdChip()] : []),
      { type: 'box', layout: 'vertical', flex: 0, paddingStart: '14px', paddingEnd: '4px', paddingTop: '4px', paddingBottom: '4px', action: { type: 'postback', data: JSON.stringify({ s: 'delitem', v: String(i) }) }, contents: [{ type: 'text', text: '✕', size: 'lg', color: G.faint, align: 'end', gravity: 'center' }] },
    ],
  });
  rows.push(priceBox(p.detail, i));
  const cells = [
    specCell(i, 'category', 'กลุ่มสินค้า', p.category),
    specCell(i, 'subCategory', 'ประเภทสินค้า', p.subCategory, p.approx?.includes('subCategory')),
    specCell(i, 'size', 'ไซส์', p.size),
    specCell(i, 'pack', 'แพ็ค', p.pack),
    specCell(i, 'variant', 'กลิ่น/สี/รสชาติ', p.variant, p.approx?.includes('variant')),
    specCell(i, 'reportType', 'รายการที่จะแจ้ง', p.reportType),
    specCell(i, 'reportSubtype', 'รายการย่อย', p.reportSubtype),
  ];
  for (let k = 0; k < cells.length; k += 2) rows.push(specGrid(cells[k], cells[k + 1]));
  return rows;
}

export function productsHeader(total: number, page: number, totalPages: number): any {
  const right = total ? [{ type: 'text', text: totalPages > 1 ? `${page + 1}/${totalPages}` : `${total} รายการ`, size: 'xs', color: G.sub, align: 'end', flex: 0, gravity: 'center' }] : [];
  return {
    type: 'box', layout: 'vertical', backgroundColor: G.card, paddingStart: '16px', paddingEnd: '16px', paddingTop: '14px', paddingBottom: '2px',
    contents: [
      { type: 'box', layout: 'horizontal', alignItems: 'center', contents: [{ type: 'text', text: 'รายการสินค้า', size: 'lg', weight: 'bold', color: G.text, flex: 1 }, ...right] },
      { type: 'text', text: 'แตะที่ช่องเพื่อแก้ไขได้เลย', size: 'xxs', color: G.green, margin: 'xs' },
    ],
  };
}

export function emptyProductTemplate(): any[] {
  const F = (field: string, label: string): any => ({
    type: 'box', layout: 'vertical', flex: 1, spacing: 'none', paddingTop: '4px', paddingBottom: '4px',
    action: { type: 'postback', data: JSON.stringify({ s: 'addfield', f: field }) },
    contents: [
      { type: 'text', text: label, size: 'xxs', color: G.sub },
      { type: 'text', text: '—', size: 'sm', color: G.green, weight: 'bold' },
    ],
  });
  const fields = [
    F('brand', 'ยี่ห้อ'), F('category', 'กลุ่มสินค้า'), F('subCategory', 'ประเภท'),
    F('size', 'ไซส์'), F('pack', 'แพ็ค'), F('variant', 'กลิ่น/สี'),
    F('reportType', 'รายการที่จะแจ้ง'), F('reportSubtype', 'รายการย่อย'), F('detail', 'ราคา/โปร'),
  ];
  const rows: any[] = [];
  for (let k = 0; k < fields.length; k += 2) rows.push({ type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm', contents: [fields[k], fields[k + 1] || { type: 'box', layout: 'vertical', flex: 1, contents: [{ type: 'filler' }] }] });
  return rows;
}

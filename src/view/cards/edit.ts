import { G } from '../theme';
import { FIELD_TITLE, EDITABLE_STEPS } from '../../shared/steps';
import { itemDesc } from '../../domain/items';
import { Session } from '../../shared/types';
import { cardHeader, optionRow } from './base';

export function editPicker(): any {
  const rows: any[] = [];
  EDITABLE_STEPS.forEach((step, i) => {
    if (i > 0) rows.push({ type: 'separator', color: G.line });
    rows.push(optionRow(FIELD_TITLE[step], { s: 'editfield', v: step }));
  });
  return {
    type: 'flex', altText: 'แก้ไขข้อมูล',
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader('แก้ไขข้อมูล', 'กรุณาเลือกช่องที่ต้องการแก้ไข'),
      body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: rows },
      footer: {
        type: 'box', layout: 'horizontal', paddingAll: '6px',
        contents: [{ type: 'button', style: 'link', height: 'sm', color: G.sub, action: { type: 'postback', label: 'กลับไปสรุป', data: JSON.stringify({ s: 'tosummary' }) } }],
      },
      styles: { footer: { separator: true } },
    },
  };
}

export function productEditPicker(s: Session): any {
  const rows: any[] = [];
  s.items.forEach((p, i) => {
    if (i > 0) rows.push({ type: 'separator', color: G.line });
    rows.push(optionRow(`${i + 1}.   ${itemDesc(p)}`, { s: 'edititem', v: String(i) }));
  });
  rows.push({ type: 'separator', color: G.line });
  rows.push(optionRow('+ เพิ่มรายการสินค้า', { s: 'additem' }));
  return {
    type: 'flex', altText: 'แก้ไขสินค้า',
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader('แก้ไขสินค้า', 'แตะที่รายการเพื่อแก้ไขหรือลบ'),
      body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: rows },
      footer: { type: 'box', layout: 'horizontal', paddingAll: '6px', contents: [{ type: 'button', style: 'link', height: 'sm', color: G.sub, action: { type: 'postback', label: 'กลับไปสรุป', data: JSON.stringify({ s: 'tosummary' }) } }] },
      styles: { footer: { separator: true } },
    },
  };
}

export function extraEditCard(s: Session): any {
  const rows: any[] = [];
  (s.extra || []).forEach((e, i) => {
    if (i > 0) rows.push({ type: 'separator', color: G.line });
    rows.push({
      type: 'box', layout: 'horizontal', paddingAll: '12px', spacing: 'md', alignItems: 'center',
      contents: [
        { type: 'text', text: e, size: 'sm', color: G.text, flex: 1, wrap: true, action: { type: 'postback', data: JSON.stringify({ s: 'editextra', i }), displayText: 'แก้' } },
        { type: 'text', text: 'ลบ', size: 'sm', color: G.warn, weight: 'bold', flex: 0, align: 'end', gravity: 'center', action: { type: 'postback', data: JSON.stringify({ s: 'delextra', i }), displayText: 'ลบ' } },
      ],
    });
  });
  if (!rows.length) rows.push({ type: 'box', layout: 'vertical', paddingAll: '14px', contents: [{ type: 'text', text: 'ยังไม่มีข้อมูลเพิ่มเติม', size: 'sm', color: G.faint }] });
  rows.push({ type: 'separator', color: G.line });
  rows.push(optionRow('+ เพิ่มข้อมูลเพิ่มเติม', { s: 'addextra' }));
  return {
    type: 'flex', altText: 'แก้ข้อมูลเพิ่มเติม',
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader('ข้อมูลเพิ่มเติม', 'แตะข้อความเพื่อแก้ · กด "ลบ" เพื่อลบ'),
      body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: rows },
      footer: { type: 'box', layout: 'horizontal', paddingAll: '6px', contents: [{ type: 'button', style: 'link', height: 'sm', color: G.sub, action: { type: 'postback', label: 'กลับไปสรุป', data: JSON.stringify({ s: 'tosummary' }) } }] },
      styles: { footer: { separator: true } },
    },
  };
}

function itemFieldButton(i: number, field: string, label: string, value?: string): any {
  const cur = (value || '').trim();
  let txt = cur ? `${label}: ${cur}` : `${label} (ยังไม่ระบุ)`;
  if (txt.length > 38) txt = txt.slice(0, 37) + '…';
  return {
    type: 'button', style: 'secondary', height: 'sm',
    action: { type: 'postback', label: txt, data: JSON.stringify({ s: 'edititemfield', i, f: field }) },
  };
}

export function itemActionCard(s: Session, i: number): any {
  const p = s.items[i] || {};
  return {
    type: 'flex', altText: 'จัดการรายการ',
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader(`รายการที่ ${i + 1}`, itemDesc(p)),
      body: {
        type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm',
        contents: [
          { type: 'text', text: 'กรุณาแตะช่องที่ต้องการแก้ไข', size: 'xs', color: G.sub },
          itemFieldButton(i, 'detail', 'ราคา/โปร', p.detail),
          itemFieldButton(i, 'size', 'ขนาด', p.size),
          itemFieldButton(i, 'variant', 'กลิ่น/สี', p.variant),
          itemFieldButton(i, 'brand', 'ยี่ห้อ', p.brand || p.rawBrand),
          { type: 'button', style: 'link', height: 'sm', action: { type: 'postback', label: 'ช่องอื่นๆ (แพ็ค/ประเภท/รายการ)', data: JSON.stringify({ s: 'edititemmore', i }) } },
          { type: 'separator', margin: 'sm', color: G.line },
          { type: 'button', style: 'link', height: 'sm', action: { type: 'postback', label: 'พิมพ์ใหม่ทั้งรายการ', data: JSON.stringify({ s: 'edititemtype', v: String(i) }) } },
          { type: 'button', style: 'secondary', color: G.warn, height: 'sm', action: { type: 'postback', label: 'ลบรายการนี้', data: JSON.stringify({ s: 'delitem', v: String(i) }) } },
          { type: 'button', style: 'link', height: 'sm', action: { type: 'postback', label: 'กลับ', data: JSON.stringify({ s: 'editproducts' }) } },
        ],
      },
    },
  };
}

export function itemFieldPicker(s: Session, i: number): any {
  const p = s.items[i] || {};
  const fields: { f: string; label: string; val?: string }[] = [
    { f: 'pack', label: 'แพ็ค', val: p.pack },
    { f: 'subCategory', label: 'ประเภทสินค้า', val: p.subCategory },
    { f: 'category', label: 'กลุ่มสินค้า', val: p.category },
    { f: 'reportType', label: 'รายการที่จะแจ้ง', val: p.reportType },
    { f: 'reportSubtype', label: 'รายการย่อย', val: p.reportSubtype },
  ];
  const rows: any[] = [];
  fields.forEach((fl, idx) => {
    if (idx > 0) rows.push({ type: 'separator', color: G.line });
    rows.push(optionRow(fl.val ? `${fl.label} · ${fl.val}` : fl.label, { s: 'edititemfield', i, f: fl.f }));
  });
  return {
    type: 'flex', altText: 'แก้ช่องอื่นๆ',
    contents: {
      type: 'bubble', size: 'kilo',
      header: cardHeader(`แก้รายการที่ ${i + 1}`, itemDesc(p)),
      body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: rows },
      footer: { type: 'box', layout: 'horizontal', paddingAll: '6px', contents: [{ type: 'button', style: 'link', height: 'sm', color: G.sub, action: { type: 'postback', label: 'กลับ', data: JSON.stringify({ s: 'edititem', v: String(i) }) } }] },
      styles: { footer: { separator: true } },
    },
  };
}

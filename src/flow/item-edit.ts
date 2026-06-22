import * as AI from '../infra/ai';
import { Session, ReportItem } from '../shared/types';
import { buildItem, setItemField, itemDesc, splitVariantItems } from '../domain/items';
import { ask, afterField, optionsForItem, MAX_BUTTONS } from './nav';
import { summaryFlex, productEditPicker, itemActionCard, itemFieldPicker, editPicker, selectCard, searchCard, promptCard, text, extraEditCard } from '../view/cards';

export function onEdit(): any[] {
  return [editPicker()];
}

export function onEditField(s: Session, field: string): any[] {
  if (field === 'product') return onEditProducts(s);
  if (field === 'extra') return onEditExtraList(s);
  s.editing = true;
  if (field === 'account') s.branch = undefined;
  return ask(s, field);
}

export function onEditProducts(s: Session): any[] {
  if (!s.items.length) return onAddItem(s);
  return [productEditPicker(s)];
}

export function onEditItem(s: Session, i: number): any[] {
  if (i < 0 || i >= s.items.length) return [productEditPicker(s)];
  return [itemActionCard(s, i)];
}

export function onDelItem(s: Session, i: number): any[] {
  if (i >= 0 && i < s.items.length) s.items.splice(i, 1);
  s.step = 'summary';
  return [summaryFlex(s)];
}

export function onEditExtraList(s: Session): any[] {
  return [extraEditCard(s)];
}

export function onDelExtra(s: Session, i: number): any[] {
  s.awaitingText = undefined; s.editExtraIndex = undefined;
  if (s.extra && i >= 0 && i < s.extra.length) s.extra.splice(i, 1);
  if (!s.extra?.length) { s.step = 'summary'; return [summaryFlex(s)]; }
  return [extraEditCard(s)];
}

export function onEditExtra(s: Session, i: number): any[] {
  if (!s.extra || i < 0 || i >= s.extra.length) return [extraEditCard(s)];
  s.editExtraIndex = i; s.awaitingText = 'extra';
  return [promptCard('แก้ข้อมูลเพิ่มเติม', `เดิม: ${s.extra[i]}\nพิมพ์ข้อความใหม่ได้เลยครับ`, { s: 'delextra', i })];
}

export function onAddExtra(s: Session): any[] {
  s.editExtraIndex = -1; s.awaitingText = 'extra';
  return [promptCard('เพิ่มข้อมูลเพิ่มเติม', 'พิมพ์ข้อความที่ต้องการเพิ่มได้เลยครับ')];
}

export function onExtraText(s: Session, x: string): any[] {
  const v = (x || '').trim();
  const idx = s.editExtraIndex; s.editExtraIndex = undefined; s.awaitingText = undefined;
  s.extra = s.extra || [];
  if (typeof idx === 'number' && idx >= 0 && idx < s.extra.length) { if (v) s.extra[idx] = v; }
  else if (v) s.extra.push(v);
  s.step = 'summary';
  return [summaryFlex(s)];
}

export function onEditItemType(s: Session, i: number): any[] {
  if (i < 0 || i >= s.items.length) return [productEditPicker(s)];
  s.editItemIndex = i; s.awaitingText = 'edititem';
  return [text(`กรุณาพิมพ์รายการที่ ${i + 1} ใหม่ครับ\n(ข้อมูลเดิม: ${itemDesc(s.items[i])})\nเช่น "[ยี่ห้อ] [ขนาด] [ราคา/โปร]"`)];
}

export function onAddItem(s: Session): any[] {
  s.editItemIndex = -1; s.awaitingText = 'edititem';
  return [promptCard('เพิ่มสินค้า', 'พิมพ์ ยี่ห้อ ขนาด ราคา/โปร ได้เลย — หลายตัว/หลายกลิ่นก็ได้')];
}

export function onAddItemField(s: Session, field: string): any[] {
  s.items.push({});
  return onEditItemField(s, s.items.length - 1, field);
}

export async function editItemFromText(s: Session, x: string): Promise<any[]> {
  s.rawText = (s.rawText ? s.rawText + '\n' : '') + x;
  let p: any;
  try { p = await AI.parseReport(x); } catch { return [text('ขออภัยครับ ระบบประมวลผลขัดข้องชั่วคราว กรุณาพิมพ์ใหม่อีกครั้ง')]; }
  const newItems = splitVariantItems(p.items || []).map((it: any) => buildItem(it, s.topicCode || '', x));
  const idx = s.editItemIndex; s.editItemIndex = undefined;
  if (!newItems.length) return [text('ไม่พบรายการสินค้าในข้อความครับ กรุณาพิมพ์ใหม่อีกครั้ง เช่น "[ยี่ห้อ] [ขนาด] [ราคา/โปร]"')];
  if (typeof idx === 'number' && idx >= 0 && idx < s.items.length) {
    s.items.splice(idx, 1, ...newItems);
    return [text(`แก้ไขรายการที่ ${idx + 1} แล้วครับ`), summaryFlex(s)];
  }
  s.items.push(...newItems);
  return [text('เพิ่มรายการสินค้าแล้วครับ'), summaryFlex(s)];
}

export const ITEM_FIELD_LABEL: Record<string, string> = {
  detail: 'ราคา/โปร', size: 'ขนาด', variant: 'กลิ่น/สี', brand: 'ยี่ห้อ', pack: 'แพ็ค',
  subCategory: 'ประเภทสินค้า', category: 'กลุ่มสินค้า', reportType: 'รายการที่จะแจ้ง', reportSubtype: 'รายการย่อย',
};

export function clearEditTarget(s: Session) {
  s.editTarget = undefined;
  if (s.awaitingText === 'itemfield') s.awaitingText = undefined;
}

export function onEditItemField(s: Session, i: number, field: string, value?: string): any[] {
  if (i < 0 || i >= s.items.length) return [productEditPicker(s)];
  if (value !== undefined && value !== '') return applyItemFieldValue(s, i, field, value);
  s.editTarget = { i, field };
  const item = s.items[i];
  const cur = (item as any)[field];
  const label = ITEM_FIELD_LABEL[field] || field;
  const clr = cur ? { s: 'clritem', i, f: field } : undefined;
  if (field === 'detail') {
    s.awaitingText = 'itemfield';
    return [promptCard(`แก้ราคา/โปร`, `${itemDesc(item)}${cur ? `\nเดิม: ${cur}` : ''}\nพิมพ์ราคา/โปรใหม่ได้เลยครับ`, clr)];
  }
  const opts = optionsForItem(field, s, item);
  if (!opts || opts.length === 0) { // ไม่มีตัวเลือก (ลิสต์แม่ยังว่าง) → พิมพ์เอง
    s.awaitingText = 'itemfield';
    return [promptCard(`แก้${label}`, `${itemDesc(item)}${cur ? `\nเดิม: ${cur}` : ''}\nพิมพ์${label}ใหม่ได้เลยครับ`, clr)];
  }
  const sub = `${itemDesc(item)}${cur ? ` · เดิม: ${cur}` : ''}`;
  if (opts.length > MAX_BUTTONS) { // ลิสต์ใหญ่ (เช่นยี่ห้อ) → ค้นด้วยพิมพ์
    s.awaitingText = 'itemfield';
    return [searchCard(field, s, opts.length, sub, clr)];
  }
  s.step = field;
  return [selectCard(field, s, opts, sub, clr)];
}

export function onEditItemMore(s: Session, i: number): any[] {
  if (i < 0 || i >= s.items.length) return [productEditPicker(s)];
  return [itemFieldPicker(s, i)];
}

export function applyItemFieldValue(s: Session, i: number, field: string, value: string): any[] {
  const item = s.items[i];
  if (!item) { clearEditTarget(s); return [productEditPicker(s)]; }
  setItemField(item, field, value, s.topicCode || '');
  clearEditTarget(s);
  s.step = 'summary';
  return [summaryFlex(s)];
}

export function applyItemFieldText(s: Session, x: string): any[] {
  const t = s.editTarget;
  if (!t) { clearEditTarget(s); return [summaryFlex(s)]; }
  return applyItemFieldValue(s, t.i, t.field, x);
}

export function onClearItemField(s: Session, i: number, field: string): any[] {
  const item = s.items[i];
  if (item) {
    (item as any)[field] = undefined;
    if (item.approx) { item.approx = item.approx.filter((k) => k !== field); if (!item.approx.length) item.approx = undefined; }
    if (field === 'brand') { (item as any).rawBrand = undefined; (item as any).isNpd = false; (item as any).needsReview = false; }
  }
  clearEditTarget(s);
  s.step = 'summary';
  return [summaryFlex(s)];
}

export function onConfirmItemApprox(s: Session, i: number, field: string): any[] {
  const item = s.items[i];
  if (item?.approx) { item.approx = item.approx.filter((k) => k !== field); if (!item.approx.length) item.approx = undefined; }
  return [summaryFlex(s)];
}

import { matchFieldCue } from './completeness';

const ITEM_EDIT_FIELDS = new Set(['detail', 'size', 'variant', 'pack', 'brand', 'subCategory', 'category', 'reportType', 'reportSubtype']);
const REPORT_EDIT_FIELD: Record<string, string> = {
  'ร้าน': 'account', 'ห้าง': 'account', 'สาขา': 'branch', 'บริษัท': 'company', 'หัวข้อ': 'topic',
  'ช่องทาง': 'channel', 'ช่วงวันที่': 'dates', 'วันที่': 'dates', 'วันเริ่ม': 'startDate', 'วันจบ': 'endDate',
};

export type EditCmd =
  | { op: 'delete'; n: number }
  | { op: 'add'; text: string }
  | { op: 'editItem'; n: number; field: string; value: string }
  | { op: 'editReport'; field: string; value: string };

export function parseEditCommand(x: string): EditCmd | null {
  const t = x.trim();
  let m = t.match(/^(?:ลบ|เอาออก|ตัด)\s*(?:รายการ|ข้อ|อัน)?\s*(\d{1,2})\s*$/);
  if (m) return { op: 'delete', n: parseInt(m[1], 10) };
  m = t.match(/^(?:เพิ่ม|แอด|add)\s+(.{2,})$/i);
  if (m) return { op: 'add', text: m[1].trim() };
  m = t.match(/^(?:รายการ|ข้อ|อัน)?\s*(\d{1,2})\s+(.+)$/);
  if (m) {
    const cue = matchFieldCue(m[2]);
    if (cue && ITEM_EDIT_FIELDS.has(cue.key)) return { op: 'editItem', n: parseInt(m[1], 10), field: cue.key, value: cue.value };
  }
  m = t.match(/^(?:แก้|เปลี่ยน|ขอแก้)\s*(ร้าน|ห้าง|สาขา|บริษัท|หัวข้อ|ช่องทาง|ช่วงวันที่|วันเริ่ม|วันจบ|วันที่)\s*(?:เป็น|=|คือ|:)?\s*(.+)$/);
  if (m) { const f = REPORT_EDIT_FIELD[m[1]]; if (f) return { op: 'editReport', field: f, value: m[2].trim() }; }
  return null;
}

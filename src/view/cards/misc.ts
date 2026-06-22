import { G } from '../theme';
import { row, text } from './base';

export function welcomeCard(): any {
  return {
    type: 'flex',
    altText: 'แจ้งโปรโมชั่น/ราคา หน้าร้าน — กรุณาพิมพ์รายละเอียดได้เลย',
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '14px', paddingBottom: '10px',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', width: '5px', height: '22px', backgroundColor: G.accent, cornerRadius: '3px', flex: 0, contents: [{ type: 'filler' }] },
              { type: 'text', text: 'แจ้งโปรโมชั่น · ราคา หน้าร้าน', size: 'lg', weight: 'bold', color: G.text, flex: 1, wrap: true },
            ],
          },
          { type: 'separator', color: G.line, margin: 'md' },
          { type: 'text', text: 'กรุณาพิมพ์รายละเอียดรายงานได้เลยครับ', size: 'md', weight: 'bold', color: G.text, wrap: true, margin: 'md' },
          { type: 'text', text: 'พิมพ์ในรูปแบบใดก็ได้ ไม่ต้องกรอกฟอร์ม หากข้อมูลไม่ครบ ระบบจะสอบถามเพิ่มเติม', size: 'sm', color: G.sub, wrap: true, margin: 'sm' },
          {
            type: 'box', layout: 'vertical', backgroundColor: G.surfLow, cornerRadius: '8px', paddingAll: '10px', margin: 'md',
            contents: [
              { type: 'text', text: 'กรณีใช้งานในกลุ่ม: แท็กบอท (@) แล้วเลือกหัวข้อ จากนั้นพิมพ์รายละเอียดได้เลย', size: 'xs', color: G.sub, wrap: true },
            ],
          },
          { type: 'text', text: 'ระบบจะจัดทำสรุปให้ตรวจสอบก่อนบันทึกทุกครั้ง', size: 'xxs', color: G.faint, wrap: true, margin: 'md' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingStart: '12px', paddingEnd: '12px', paddingTop: '2px', paddingBottom: '8px',
        contents: [
          { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: 'ดูตัวอย่าง', data: JSON.stringify({ s: 'example' }), displayText: 'ขอดูตัวอย่าง' } },
        ],
      },
    },
  };
}

export function exitCard(title = 'ออกจากระบบแล้ว', note = 'แท็กบอท (พิมพ์ @ แล้วเลือกบอท) เพื่อเริ่มรายงานใหม่ได้ตลอดครับ'): any {
  return {
    type: 'flex', altText: title,
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '12px', paddingBottom: '12px',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', width: '5px', height: '18px', backgroundColor: G.sub, cornerRadius: '3px', flex: 0, contents: [{ type: 'filler' }] },
              { type: 'text', text: title, size: 'md', weight: 'bold', color: G.text, flex: 1, wrap: true },
            ],
          },
          { type: 'text', text: note, size: 'xs', color: G.sub, wrap: true, margin: 'sm' },
        ],
      },
    },
  };
}

export function savedCard(recap?: { id?: number; store?: string; nItems?: number; nPhotos?: number }): any {
  const rows: any[] = [];
  if (recap?.store) rows.push(row('ร้าน/สาขา', recap.store));
  if (recap?.nItems) rows.push(row('สินค้า', `${recap.nItems} รายการ`));
  if (recap?.nPhotos) rows.push(row('รูปแนบ', `${recap.nPhotos} รูป`));
  return {
    type: 'flex', altText: recap?.id ? `บันทึกแล้ว · รายงาน #${recap.id}` : 'บันทึกเรียบร้อย',
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '14px', paddingBottom: '12px',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', width: '5px', height: '22px', backgroundColor: G.green, cornerRadius: '3px', flex: 0, contents: [{ type: 'filler' }] },
              { type: 'text', text: 'บันทึกเรียบร้อย ✓', size: 'lg', weight: 'bold', color: G.green, flex: 1, wrap: true },
            ],
          },
          ...(recap?.id ? [{ type: 'text', text: `เลขที่รายงาน  #${recap.id}`, size: 'sm', color: G.sub, margin: 'sm' }] : []),
          { type: 'separator', color: G.line, margin: 'md' },
          ...(rows.length ? [{ type: 'box', layout: 'vertical', spacing: 'xs', margin: 'md', contents: rows }] : []),
          { type: 'text', text: 'ขอบคุณครับ ข้อมูลเข้าสู่ระบบเรียบร้อยแล้ว', size: 'sm', color: G.sub, wrap: true, margin: 'md' },
        ],
      },
    },
  };
}

export function confirmCard(action: string, message: string, confirmLabel = 'ยืนยัน'): any {
  return {
    type: 'flex', altText: 'ยืนยัน',
    contents: {
      type: 'bubble', size: 'kilo',
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingStart: '16px', paddingEnd: '16px', paddingTop: '12px', paddingBottom: '6px',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'sm', alignItems: 'center',
            contents: [
              { type: 'box', layout: 'vertical', width: '5px', height: '18px', backgroundColor: G.warn, cornerRadius: '3px', flex: 0, contents: [{ type: 'filler' }] },
              { type: 'text', text: 'ยืนยัน', size: 'md', weight: 'bold', color: G.text, flex: 1 },
            ],
          },
          { type: 'text', text: message, size: 'xs', color: G.sub, wrap: true, margin: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: 'horizontal', spacing: 'sm', paddingStart: '12px', paddingEnd: '12px', paddingTop: '2px', paddingBottom: '10px',
        contents: [
          { type: 'button', style: 'secondary', height: 'sm', flex: 1, action: { type: 'postback', label: 'ทำต่อ', data: JSON.stringify({ s: 'resume' }) } },
          { type: 'button', style: 'primary', color: G.warn, height: 'sm', flex: 1, action: { type: 'postback', label: confirmLabel, data: JSON.stringify({ s: action }) } },
        ],
      },
    },
  };
}

export function askMoreText(miss: string[]): any {
  const examples: string[] = [];
  if (miss.some((x) => x.includes('วันที่') || x.includes('วันจบ'))) examples.push('1-30 มิย');
  if (miss.some((x) => x.includes('บริษัท'))) examples.push('ยูนิลีเวอร์');
  if (miss.some((x) => x.startsWith('ยี่ห้อ'))) examples.push('บรีส');
  if (miss.some((x) => x.includes('ราคา/โปร'))) examples.push('ลด10%');
  if (miss.some((x) => x.includes('ขนาด'))) examples.push('900มล');
  if (miss.some((x) => x.includes('กลิ่น'))) examples.push('เขียว');
  const hint = examples.length ? `เช่น  "${examples.join(' ')}"` : 'พิมพ์รวดเดียวได้เลย';
  const multiItem = miss.some((x) => /\(.+, .+\)/.test(x));
  const multiHint = multiItem ? '\nขาดข้อมูลหลายรายการ แนะนำให้ระบุยี่ห้อพ่วงไปด้วยเพื่อความแม่นยำ เช่น "บรีส ลด10% / ดาวนี่ 1+1"' : '';
  const list = miss.map((x) => `   - ${x}`).join('\n');
  return text(`ขอข้อมูลเพิ่มเติมครับ ยังขาดอีก ${miss.length} รายการ:\n${list}\n\nกรุณาพิมพ์เพิ่มมาในครั้งเดียว ${hint}${multiHint}\nหากไม่มีข้อมูลช่องใด พิมพ์ข้ามได้ เช่น "ข้ามบริษัท" · พิมพ์ "ข้าม" เพื่อข้ามทั้งหมด`);
}

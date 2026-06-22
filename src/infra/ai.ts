import * as D from './master';

const USE_DEEPSEEK = !!process.env.DEEPSEEK_API_KEY;
const KEY = USE_DEEPSEEK ? (process.env.DEEPSEEK_API_KEY as string) : (process.env.OPENAI_API_KEY || '');
const BASE = USE_DEEPSEEK
  ? 'https://api.deepseek.com/chat/completions'
  : 'https://api.openai.com/v1/chat/completions';

const MODEL = USE_DEEPSEEK
  ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
  : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

async function fetchJson(url: string, opts: any, timeoutMs: number, retries = 2): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429 || res.status >= 500) throw new Error('retryable ' + res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return await res.json();
    } catch (e: any) {
      lastErr = e;
      const retryable = e?.name === 'TimeoutError' || /retryable|fetch failed|network|ECONN/i.test(e?.message || '');
      if (attempt >= retries || !retryable) break;
    }
  }
  throw lastErr;
}

export async function parseReport(input: string, expectFields?: string[]): Promise<any> {
  const today = new Date().toISOString().slice(0, 10);
  const opts = D.aiOptions();

  let sys = `คุณคือนักวิเคราะห์รายงานหน้างาน FMCG ที่เก่งที่สุด — หน้างานพิมพ์มายังไงก็ได้ (ติดกัน/ย่อ/สะกดผิด/ไม่มีฟอร์ม/เล่าเรื่อง) งานคุณ: อ่านให้เข้าใจ แล้วจับทุกอย่างเข้า "ฟิลด์ที่ตรง" ให้ครบ ไม่ให้มีอะไรหาย → คืน JSON ตาม schema

## หลักการ (ยึดเป๊ะทุกข้อ)
1. ห้ามหาย — ทุกชื่อยี่ห้อ/ร้าน/ราคา/ข้อเท็จจริง ต้องไปอยู่ฟิลด์ที่ตรง ; อะไรไม่มีช่องรองรับ → extra (ข้อความตามที่พิมพ์ ไม่มี label) ; แยก extra เป็นคนละรายการตามแต่ละประเด็น (อุปกรณ์/ค่าใช้จ่าย/เวลา/สถานะ/เงื่อนไข ฯลฯ แยกกัน) ไม่รวมเป็นก้อนเดียว ; **ห้ามเอาบรรทัดดิบ/สิ่งที่จับเข้าฟิลด์แล้วมาใส่ extra ซ้ำ** (ร้าน/สาขา/วันที่/ยี่ห้อ/ราคา ที่อยู่ในฟิลด์แล้ว = ห้ามลง extra อีก) — extra เก็บเฉพาะส่วนที่ "ไม่มีฟิลด์รองรับจริงๆ" เท่านั้น (จับเข้าฟิลด์ครบ → extra ว่างได้)
2. ห้ามเดา — ไม่มีในข้อความ = null ; คงชื่อยี่ห้อ/ร้านตามที่พิมพ์ (ระบบจับคู่ master เอง) ; ตัวเลขราคาห้ามสลับ
3. 1 item = 1 สินค้าจริง — ยี่ห้อ/กลิ่นต่างกัน = คนละ item ; **ต่างชนิด/รูปแบบสินค้าแม้ยี่ห้อเดียวกัน = คนละ item** (ลิสต์สินค้าหลายตัวต้องแตกให้ครบทุกตัว ห้ามรวบ) ; **แต่ "หลายขนาดของสินค้าเดียวกัน" = item เดียวเสมอ ห้ามแยกตามขนาด** (ทุกขนาด-ราคาลง detail) ; วงเล็บ/หมายเหตุ/เล่าเรื่อง = รวมลง detail ของ item ก่อนหน้า ไม่ใช่ item ใหม่ ; **สินค้าที่มียี่ห้อจริง แม้เป็นของแถม/รับฟรี ก็จับเป็น item ตามปกติ (field-first)** ; เงื่อนไข/โปร/ข้อความที่ไม่ใช่ตัวสินค้า (ซื้อครบ.../หมุนวงล้อ/แจกตะกร้า ฯลฯ) → ลง detail หรือ extra ไม่ใช่ item
4. **มีชื่อยี่ห้อที่พิมพ์ → ต้องจับเป็น item เสมอ** (แม้ไม่มีราคา/เป็นรายงานติดตั้ง/ตู้/สถานี/อยู่ในประโยคบรรยาย) — ยี่ห้อหลายตัวที่คั่นจุลภาคหรืออยู่ในประโยค = แตกเป็น item แต่ละยี่ห้อ **ห้ามทิ้งทั้งประโยคลง extra** ; เฉพาะ "ไม่มีชื่อยี่ห้อเลยจริงๆ" (เหตุการณ์/คู่แข่งไม่ระบุยี่ห้อ) → items:[] แล้วใส่รายละเอียดลง extra
5. detail = ราคา/ส่วนลด/โปร/ของแถม/เงื่อนไขซื้อ เท่านั้น ; คำอธิบายสเปค/เครื่อง/เหตุการณ์ ที่ไม่ใช่ราคา → extra
6. วันที่ YYYY-MM-DD ; เดือนไทยย่อ มค กพ มีค เมย พค มิย กค สค กย ตค พย ธค = 01-12 (ตามลำดับ) ; มีแต่วันไม่มีเดือน ("1-15"/"25-30") → ช่วงวันในเดือนปัจจุบัน ; พ.ศ.2หลักใส่ปีตามที่พิมพ์ (โค้ดแปลงเอง) ; ช่วงคร่อมปี endDate=ปีถัดไป ; ไม่มี=null ห้ามแต่ง
7. ขอแก้ ("พิมพ์ผิด/ที่ถูกคือ X/แก้เป็น X") → คืนเฉพาะค่าที่แก้ในรูป items:[{<field>:"X"}] (เช่น ราคาผิด→items:[{detail:"129บ"}]) ห้ามสร้างสินค้า/ร้านใหม่
8. **ตรวจซ้ำก่อนส่ง (บังคับ)** — อ่านข้อความอีกรอบ ไล่ทีละช่องครบทั้ง 17 ฟิลด์:
   (ก) **ห้ามหาย แต่ห้ามซ้ำ** — มีข้อมูลที่พิมพ์มาแต่ "ยังไม่อยู่ฟิลด์ไหนเลย และไม่อยู่ extra" ไหม → ใส่ extra เฉพาะ "ส่วนที่ขาด" (ไม่ใช่ยกบรรทัดดิบมาทั้งบรรทัด, ไม่ใส่ซ้ำสิ่งที่อยู่ในฟิลด์แล้ว) ; ถ้าจับเข้าฟิลด์ครบแล้ว extra ปล่อยว่างได้
   (ข) **ห้ามเดา** — ฟิลด์ไหนที่ใส่ค่าทั้งที่ "คำนั้นไม่ปรากฏในข้อความ" (เดา/อนุมานจากยี่ห้อ/บริบท/ความรู้คุณ) → เปลี่ยนเป็น null ทันที ; ทุกค่าที่เหลือต้องชี้ได้ว่ามาจากคำไหนในข้อความ
   (ค) **extra = ทางเลือกสุดท้าย (ห้ามขี้เกียจ)** — ทุกข้อความที่จะใส่ extra ต้องเช็คก่อนว่า "เข้าฟิลด์ได้ไหม": ยี่ห้อ→item · ขนาด→size · แพ็ค→pack · กลิ่น/สี→variant · ร้าน/ห้าง/สาขา→account/branch · บริษัท→company · วันที่→startDate/endDate · ราคา/โปร→detail (แม้คำเหล่านี้อยู่ในประโยคบรรยาย/ลิสต์ ก็ต้องดึงเข้าฟิลด์) ; extra เก็บได้เฉพาะข้อความที่ "ไม่มีฟิลด์ไหนรองรับจริงๆ" (คำอธิบายเครื่อง/เงื่อนไขกิจกรรม/สถานะ) เท่านั้น

Schema: { channel, account, branch, company, items:[{category,subCategory,brand,size,pack,variant,reportType,reportSubtype,detail}], startDate:"YYYY-MM-DD", endDate, extra:["ข้อความนอก 17 ฟิลด์ ตามที่พิมพ์"] }
- **ห้ามคืน topic/หัวข้อ — ผู้ใช้เลือกหัวข้อเองก่อนแล้ว (ไม่ใช่งานของ AI)**
- brand=ยี่ห้อเต็มตามพิมพ์ (กลิ่น/สีแยกไป variant) · size=ขนาด/ปริมาตร · pack=จำนวน/ลักษณะแพ็ค (ไม่ใช่ size)
- category/subCategory/reportType/reportSubtype = เลือกจาก "ตัวเลือกในระบบ" ด้านล่าง **เฉพาะที่ข้อความระบุชัด** ; **ห้ามอนุมานจากยี่ห้อ/บริบท** (ต่อให้รู้ว่ายี่ห้อนั้นอยู่หมวด/ประเภทอะไรจากความรู้ ก็ห้ามเดา ถ้าข้อความไม่ได้พิมพ์คำนั้น) ; ไม่ระบุ=null
- company=บริษัทเจ้าของสินค้าถ้าพิมพ์มา · account/branch=ร้าน/ห้าง/สาขา (บรรทัด/คำขึ้นต้น "ร้าน" หรือชื่อห้าง = account)

## ตัวเลือกในระบบ
${opts}
วันนี้ ${today}`;
  if (expectFields?.length) {
    sys += `\n\n## โหมดถามกลับ — สำคัญสุด: ข้อความนี้คือ "คำตอบกลับ" ของฟิลด์ที่บอทเพิ่งถาม = [${expectFields.join(', ')}] → แตกค่าที่พิมพ์เข้าฟิลด์เหล่านี้เท่านั้น ห้ามเดาเป็นฟิลด์อื่นเด็ดขาด
- ถาม "บริษัท" → ค่าที่พิมพ์ = company เสมอ (แม้ไม่มีคำว่า "บริษัท" หรือพิมพ์อังกฤษ-ไทยปนกัน) ห้ามใส่เป็น account/brand
  **แม้คำตอบบังเอิญตรงกับ "ยี่ห้อในระบบ" ก็ตาม** — ถามบริษัทแล้วตอบอะไรมา = company ห้ามสร้างเป็น items เด็ดขาด
- ถาม "ช่วงวันที่" → ตัวเลข/เดือน = startDate/endDate
- ถาม "วันจบโปร" → ค่าที่พิมพ์ = endDate เท่านั้น **ห้ามใส่ startDate**
- ถาม "ห้าง/ร้าน"/"สาขา" → account/branch
- ฟิลด์ที่ถามมีคำว่า "ราคา/โปร" → คำตอบใส่ items[0].detail
- ฟิลด์ที่ถามมีคำว่า "ขนาด" → items[0].size
- ฟิลด์ที่ถามมีคำว่า "กลิ่น" → items[0].variant
- ฟิลด์ที่ถามมีคำว่า "แพ็ค" → items[0].pack
- ฟิลด์ที่ถามมีคำว่า "ประเภทสินค้า" → items[0].subCategory
- ฟิลด์ที่ถามมีคำว่า "ช่องทาง" → channel
- ฟิลด์ที่ถามมีคำว่า "รายการที่จะแจ้ง" → items[0].reportType ; "รายการย่อย" → items[0].reportSubtype
- ฟิลด์ที่ถามขึ้นต้น "ยี่ห้อ" → คำตอบใส่ items[0].brand — ข้อยกเว้นเดียวของกฎ "ไม่ต้องใส่ brand" ข้อถัดไป
- ใส่ทุกค่าที่ตอบลง items[0] โดย "ไม่ต้องใส่ brand" — วงเล็บหลังชื่อฟิลด์ที่ถาม เป็นแค่ชื่อยี่ห้ออ้างอิง ไม่ใช่ค่าที่ต้องแตกเป็น brand
- ตอบพ่วงหลายยี่ห้อในประโยคเดียว → แยกเป็นหลาย items ตามยี่ห้อ (ยี่ห้อใช้จับคู่รายการเดิม)
- ตอบหลายฟิลด์รวดเดียว → แยกแต่ละฟิลด์ให้ถูก (เช่น ตอบวันที่ + ชื่อบริษัทมาด้วย → startDate/endDate + company)`;
  }

  const reqBody = JSON.stringify({
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: input },
    ],
  });
  let lastErr = 'AI ไม่มีคำตอบ';
  for (let attempt = 0; attempt < 2; attempt++) {
    const data: any = await fetchJson(BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: reqBody,
    }, 35000, 1);
    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      try { return JSON.parse(content); } catch {}
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch {} }
      lastErr = 'AI ตอบไม่เป็น JSON';
    }
  }
  throw new Error(lastErr);
}


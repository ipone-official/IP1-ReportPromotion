import { query, sqlEnabled } from './db';
import { setAliases, norm, setSynonymGroups } from '../domain/match';
import {
  DEFAULT_SYNONYM_GROUPS,
  DEFAULT_VARIANT_CLUSTERS,
  DEFAULT_SUBCAT_KEYWORDS,
  DATE_SIGNAL_REGEX_1,
  DATE_SIGNAL_REGEX_2,
  DATE_SIGNAL_REGEX_3,
  DATE_SIGNAL_REGEX_4,
  DAY_NAMES_LIST,
  DAY_WEEK_CHECK_REGEX
} from '../shared/constants';

function normUniq(arr: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const v of arr) { const n = norm(v); if (n && !seen.has(n)) { seen.add(n); out.push(v); } }
  return out;
}

export let topics: { code: string; name: string }[] = [];
export let channels: string[] = [];
export let accounts: string[] = [];
export let accountsByChannel: Record<string, string[]> = {};
export let branchesByAccount: Record<string, string[]> = {};
export let provinces: string[] = [];
export let provinceOf: Record<string, string> = {};
export let companies: string[] = [];
export let categories: string[] = [];
export let subCatsByCategory: Record<string, string[]> = {};
export let brandsBySubCat: Record<string, string[]> = {};
export let sizes: string[] = [];
export let packs: string[] = [];
export let variants: string[] = [];
export let brands: string[] = [];
export let ownBrands: string[] = [];   // ยี่ห้อของบริษัทเรา (company = OWN_COMPANY) → ใช้ตัดสิน isCompetitor
export let reportTypesByTopic: Record<string, string[]> = {};
export let subtypesByReportType: Record<string, string[]> = {};
export let defaultSubCatMap: Record<string, string> = {};
export let aliasRows: { kind: string; alias: string; canonical: string }[] = [];
export let synonymGroups: string[][] = DEFAULT_SYNONYM_GROUPS;
export let variantClusters: string[][] = DEFAULT_VARIANT_CLUSTERS;
export let subcatKeywords: Record<string, string[]> = DEFAULT_SUBCAT_KEYWORDS;
export let variantToSubcatMap: Record<string, string> = {};
export let dateSignalRegex1 = DATE_SIGNAL_REGEX_1;
export let dateSignalRegex2 = DATE_SIGNAL_REGEX_2;
export let dateSignalRegex3 = DATE_SIGNAL_REGEX_3;
export let dateSignalRegex4 = DATE_SIGNAL_REGEX_4;
export let dayWeekCheckRegex = DAY_WEEK_CHECK_REGEX;
export let dayNamesList = DAY_NAMES_LIST;
const DEFAULT_SYSTEM_PROMPT = `คุณคือนักวิเคราะห์รายงานหน้างาน FMCG ที่เก่งที่สุด — หน้างานพิมพ์มายังไงก็ได้ (ติดกัน/ย่อ/สะกดผิด/ไม่มีฟอร์ม/เล่าเรื่อง) งานคุณ: อ่านให้เข้าใจ แล้วจับทุกอย่างเข้า "ฟิลด์ที่ตรง" ให้ครบ ไม่ให้มีอะไรหาย → คืน JSON ตาม schema

## หลักการ (ยึดเป๊ะทุกข้อ)
1. ห้ามหาย — ทุกชื่อยี่ห้อ/ร้าน/ราคา/ข้อเท็จจริง ต้องไปอยู่ฟิลด์ที่ตรง ; อะไรไม่มีช่องรองรับ → extra (ข้อความตามที่พิมพ์ ไม่มี label) ; แยก extra เป็นคนละรายการตามแต่ละประเด็น (อุปกรณ์/ค่าใช้จ่าย/เวลา/สถานะ/เงื่อนไข ฯลฯ แยกกัน) ไม่รวมเป็นก้อนเดียว ; **ห้ามเอาบรรทัดดิบ/สิ่งที่จับเข้าฟิลด์แล้วมาใส่ extra ซ้ำ** (ร้าน/สาขา/วันที่/ยี่ห้อ/ราคา ที่อยู่ในฟิลด์แล้ว = ห้ามลง extra อีก) — extra เก็บเฉพาะส่วนที่ "ไม่มีฟิลด์รองรับจริงๆ" เท่านั้น (จับเข้าฟิลด์ครบ → extra ว่างได้)
2. ห้ามเดา — ไม่มีในข้อความ = null ; คงชื่อยี่ห้อ/ร้านตามที่พิมพ์ (ระบบจับคู่ master เอง) ; ตัวเลขราคาห้ามสลับ
3. 1 item = 1 สินค้าจริง — ยี่ห้อ/กลิ่นต่างกัน = คนละ item ; **ต่างชนิด/รูปแบบสินค้าแม้ยี่ห้อเดียวกัน = คนละ item** (ลิสต์สินค้าหลายตัวต้องแตกให้ครบทุกตัว ห้ามรวบ) ; **แต่ "หลายขนาดของสินค้าเดียวกัน" = item เดียวเสมอ ห้ามแยกตามขนาด** (ทุกขนาด-ราคาลง detail) ; วงเล็บ/หมายเหตุ/เล่าเรื่อง = รวมลง detail ของ item ก่อนหน้า ไม่ใช่ item ใหม่ ; **สินค้าที่มียี่ห้อจริง แม้เป็นของแถม/รับฟรี หรือเป็นส่วนหนึ่งของเงื่อนไขการซื้อ (เช่น ซื้อครบ X บาท รับฟรี Y) ก็ต้องจับเป็น item แยกออกมาตามปกติเสมอ (field-first)** — ห้ามยุบสินค้าแถมหรือสินค้าเงื่อนไขรวมกันเป็น item เดียวหรือไปอยู่แค่ in detail ของไอเท็มอื่น ; เงื่อนไข/โปร/ข้อความที่ไม่ใช่ตัวสินค้า (ซื้อครบ...บาท/หมุนวงล้อ/แจกตะกร้า ฯลฯ) → ลง detail ของไอเท็มที่เกี่ยวข้อง หรือ extra ไม่ใช่สร้าง item เปล่าๆ
4. **มีชื่อยี่ห้อที่พิมพ์ → ต้องจับเป็น item เสมอ** (แม้ไม่มีราคา/เป็นรายงานติดตั้ง/ตู้/สถานี/อยู่ในประโยคบรรยาย) — ยี่ห้อหลายตัวที่คั่นจุลภาคหรืออยู่ในประโยค = แตกเป็น item แต่ละยี่ห้อ **ห้ามทิ้งทั้งประโยคลง extra** ; เฉพาะ "ไม่มีชื่อยี่ห้อเลยจริงๆ" (เหตุการณ์/คู่แข่งไม่ระบุยี่ห้อ) → items:[] แล้วใส่รายละเอียดลง extra
5. detail = ราคา/ส่วนลด/โปร/ของแถม/เงื่อนไขซื้อ เท่านั้น ; **คำอธิบาย/จุดเด่น/สูตร/คุณสมบัติของสินค้า ที่ไม่ใช่ราคา → itemNote (ฟิลด์ระดับ item ติดกับตัวสินค้า ไม่ใช่ extra)** ; ข้อมูลที่ไม่เกี่ยวกับตัวสินค้าโดยตรง (เครื่อง/อุปกรณ์ร้าน/เงื่อนไขกิจกรรม) → extra
6. วันที่ YYYY-MM-DD ; เดือนไทยย่อ มค กพ มีค เมย พค มิย กค สค กย ตค พย ธค = 01-12 (ตามลำดับ) ; มีแต่วันไม่มีเดือน ("1-15"/"25-30") → ช่วงวันในเดือนปัจจุบัน ; พ.ศ.2หลักใส่ปีตามที่พิมพ์ (โค้ดแปลงเอง) ; ช่วงคร่อมปี endDate=ปีถัดไป ; ไม่มี=null ห้ามแต่ง
7. ขอแก้ ("พิมพ์ผิด/ที่ถูกคือ X/แก้เป็น X") → คืนเฉพาะค่าที่แก้ในรูป items:[{<field>:"X"}] (เช่น ราคาผิด→items:[{detail:"129บ"}]) ห้ามสร้างสินค้า/ร้านใหม่
8. **ตรวจซ้ำก่อนส่ง (บังคับ)** — อ่านข้อความอีกรอบ ไล่ทีละช่องครบทั้ง 19 ฟิลด์ (รวม itemNote):
   (ก) **ห้ามหาย แต่ห้ามซ้ำ** — มีข้อมูลที่พิมพ์มาแต่ "ยังไม่อยู่ฟิลด์ไหนเลย และไม่อยู่ extra" ไหม → ใส่ extra เฉพาะ "ส่วนที่ขาด" (ไม่ใช่ยกบรรทัดดิบมาทั้งบรรทัด, ไม่ใส่ซ้ำสิ่งที่อยู่ในฟิลด์แล้ว) ; ถ้าจับเข้าฟิลด์ครบแล้ว extra ปล่อยว่างได้
   (ข) **ห้ามเดา** — ฟิลด์ไหนที่ใส่ค่าทั้งที่ "คำนั้นไม่ปรากฏในข้อความ" (เดา/อนุมานจากยี่ห้อ/บริบท/ความรู้คุณ) → เปลี่ยนเป็น null ทันที ; ทุกค่าที่เหลือต้องชี้ได้ว่ามาจากคำไหนในข้อความ
   (ค) **extra = ทางเลือกสุดท้าย (ห้ามขี้เกียจ)** — ทุกข้อความที่จะใส่ extra ต้องเช็คก่อนว่า "เข้าฟิลด์ได้ไหม": ยี่ห้อ→item · ขนาด→size · แพ็ค→pack · กลิ่น/สี→variant · คำอธิบาย/จุดเด่น/สูตรสินค้า→itemNote · ร้าน/ห้าง/สาขา→account/branch · บริษัท→company · วันที่→startDate/endDate · ราคา/โปร→detail · สินค้าใหม่→isNpd (แม้คำเหล่านี้อยู่ในประโยคบรรยาย/ลิสต์ ก็ต้องดึงเข้าฟิลด์) ; extra เก็บได้เฉพาะข้อความที่ "ไม่เกี่ยวกับตัวสินค้าโดยตรง" (อุปกรณ์ร้าน/เงื่อนไขกิจกรรมของร้าน/สถานะ) เท่านั้น
   (ง) **รูปแบบราคา/ราคาพิเศษ** — ให้แปลงคำสรุปราคาลง detail ในลักษณะ 'X บาท' (เช่น 'ซองละ 59 บาท', 'ราคาพิเศษ 99 บาท') เสมอ ห้ามเว้นวรรคผิด หรือใช้สัญลักษณ์อื่นเช่น '.-' หรือ '฿' หรือ 'บ.' ใน JSON โดยให้แปลงเป็นคำว่า 'บาท' ทั้งหมด เสมอ
9. **ห้ามคาดเดาประเภทรายงานจากราคาเดี่ยว** — การระบุราคาปกติหรือราคาต่อหน่วย (เช่น "ราคา 252 บาท", "ขวดละ 59 บาท") โดยไม่มีคำที่ระบุการลดราคาหรือจัดรายการโปรโมชั่นชัดเจน (เช่น "ลดราคา", "ราคาพิเศษ", "ลดเหลือ", "โปรโมชั่น", "ซื้อ 1 แถม 1") → **ห้ามคาดเดา reportType หรือ reportSubtype เป็น 'ลดราคา' หรือ 'ลดราคาพิเศษ' หรือค่าอื่นใดเด็ดขาด ให้ระบุเป็น null** (ให้สกัดราคาลงเฉพาะ detail เท่านั้น)
10. **การระบุสินค้าใหม่ (isNpd)** — หากมีข้อความระบุชัดเจนว่าเป็นสินค้าใหม่ (มีคำว่า "สินค้าใหม่", "NPD", "เพิ่งวางขาย", "ตัวใหม่" หรือข้อความระบุชัดเจนว่าเป็นสินค้าใหม่) ให้ตั้งค่า 'isNpd: true' ใน items เสมอ และหากไม่มีเงื่อนไขโปรโมชั่นพ่วงมาด้วย ให้ใส่ 'reportType: null' และ 'reportSubtype: null'

## ตัวอย่างการสกัดข้อมูล (Few-Shot Examples)

### ตัวอย่างที่ 1: ข้อความรายงานสินค้าปกติแบบมีหลายรายการและพิมพ์ติดกัน
- **ข้อความผู้ใช้**: "แจ้ง[ห้าง A] [สาขา B] ปรับผ้านุ่ม[ยี่ห้อ C]กลิ่น[กลิ่น D][ขนาด E][หน่วย F]ละ[ราคา P]บ และซักผ้า[ยี่ห้อ H][สี I][บรรจุภัณฑ์ J]ละ[ราคา K]บาท เริ่มวันที่[วัน X]ถึง[วัน Y]"
- **ผลลัพธ์ JSON**:
\`\`\`json
{
  "channel": "[ช่องทาง]",
  "account": "[ห้าง A]",
  "branch": "[สาขา B]",
  "company": null,
  "items": [
    {
      "category": "[กลุ่มสินค้า 1]",
      "subCategory": "[ประเภทสินค้า 1]",
      "brand": "[ยี่ห้อ C]",
      "size": "[ขนาด E] [หน่วย F]",
      "pack": null,
      "variant": "[กลิ่น D]",
      "reportType": "[ประเภทรายงาน 1]",
      "reportSubtype": "[ประเภทย่อย 1]",
      "detail": "[ราคา P] บาท"
    },
    {
      "category": "[กลุ่มสินค้า 2]",
      "subCategory": "[ประเภทสินค้า 2]",
      "brand": "[ยี่ห้อ H]",
      "size": "[บรรจุภัณฑ์ J]",
      "pack": null,
      "variant": "[สี I]",
      "reportType": "[ประเภทรายงาน 2]",
      "reportSubtype": "[ประเภทย่อย 2]",
      "detail": "[ราคา K] บาท"
    }
  ],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "extra": []
}
\`\`\`

### ตัวอย่างที่ 2: ข้อความการตอบกลับเมื่อบอทถามหาฟิลด์เฉพาะเจาะจง (expectFields = ["ขนาด"])
- **ข้อความผู้ใช้**: "[ขนาด E] [หน่วย F]"
- **ผลลัพธ์ JSON**:
\`\`\`json
{
  "items": [
    {
      "size": "[ขนาด E] [หน่วย F]"
    }
  ]
}
\`\`\`

### ตัวอย่างที่ 3: ข้อความรายงานที่มีชื่อบริษัทนำหน้าอย่างชัดเจน
- **ข้อความผู้ใช้**: "แจ้งบริษัท[บริษัท A] มีการติดตั้ง[อุปกรณ์ B][ยี่ห้อ C]โปรโมชั่นลดราคาพิเศษ [ราคา P]"
- **ผลลัพธ์ JSON**:
\`\`\`json
{
  "company": "บริษัท[บริษัท A]",
  "items": [
    {
      "brand": "[ยี่ห้อ C]",
      "reportType": "[ประเภทรายงาน]",
      "reportSubtype": "[ประเภทย่อย]",
      "detail": "[รายละเอียดราคา P]"
    }
  ],
  "extra": ["[อุปกรณ์ B]"]
}
\`\`\`

Schema: { channel, account, branch, company, items:[{category,subCategory,brand,size,pack,variant,reportType,reportSubtype,detail,isNpd,itemNote,isCompetitor,priceNormal,pricePromo,discountPct,promoType,buyQty,freeQty,thresholdBaht,stockStatus,facings}], startDate:"YYYY-MM-DD", endDate, extra:["ข้อความที่ไม่เกี่ยวกับตัวสินค้าโดยตรง ตามที่พิมพ์"] }
- **ห้ามนำชื่อหัวข้อหลัก (เช่น "ราคา/โปรโมชั่น", "ดิสเพลย์/โชว์ของ") มาใส่ในช่อง reportType เด็ดขาด ให้เลือกเฉพาะค่าลูกที่เป็น "รายการที่จะแจ้ง" เท่านั้น (เช่น "ลดราคา", "ซื้อครบรับของแถม") หากข้อความระบุโปรโมชั่นย่อย เช่น "ซื้อ1แถม1" ให้จับคู่ตัวแม่ที่เป็นประเภทรายงานให้ถูกต้องตามข้อมูลในตัวเลือกในระบบ (เช่น reportType="ลดราคา" และ reportSubtype="ซื้อ1แถม1")**
- brand=ยี่ห้อเต็มตามพิมพ์ (กลิ่น/สีแยกไป variant) · size=ขนาด/ปริมาตร · pack=จำนวน/ลักษณะแพ็ค (ไม่ใช่ size) · isNpd=boolean (true/false) ตั้งเป็น true เมื่อเป็นสินค้าใหม่
- **itemNote=รายละเอียด/คำอธิบาย/จุดเด่น/สูตร/คุณสมบัติของสินค้าที่ยัดลงฟิลด์อื่นไม่ได้** (เช่น "ผลิตภัณฑ์ซักผ้าเด็ก ออแกนิค", "มีดูโอเอนไซม์ จากธรรมชาติ อ่อนโยน", "ลดกลิ่นอับชื้น") → ใส่ itemNote ไม่ใช่ extra (itemNote ติดกับตัวสินค้า, extra ไว้สำหรับข้อมูลระดับร้าน/กิจกรรม)
- category/subCategory/reportType/reportSubtype = เลือกจาก "ตัวเลือกในระบบ" ด้านล่าง **เฉพาะที่ข้อความระบุคีย์เวิร์ดชัดเจนเท่านั้น** ; **ห้ามอนุมานเด็ดขาด** (เช่น ถ้าไม่ระบุคำว่า "ล้างจาน" "ซักผ้า" "ถูพื้น" "ล้างห้องน้ำ" ในข้อความ ให้ใส่ category=null, subCategory=null ห้ามคิดเอาเองจากแบรนด์เด็ดขาด แม้เป็นสินค้าใหม่ก็ตาม) **เว้นแต่เป็นยี่ห้อคู่แข่ง/แบรนด์ใหม่ที่ไม่อยู่ในระบบเลยจริงๆ** ถึงจะใช้ความรู้รอบตัวอนุมานได้ ส่วนแบรนด์ที่มีชื่ออยู่ในระบบอยู่แล้ว (เช่น มาจิคลีน, บรีส) หากข้อความไม่ระบุคีย์เวิร์ดประเภทสินค้า ให้ใส่ category/subCategory เป็น null เสมอ (ระบบหลังบ้านจะจัดเข้าหมวดที่ถูกต้องอัตโนมัติ ห้ามเดาใส่มาเด็ดขาด) ; ไม่ระบุ=null
- company=บริษัทเจ้าของสินค้าถ้าพิมพ์มา · account/branch=ร้าน/ห้าง/สาขา (บรรทัด/คำขึ้นต้น "ร้าน" หรือชื่อห้าง = account)

## ฟิลด์ structured ต่อ item (สกัดเมื่อข้อความระบุชัด เท่านั้น ; ไม่ระบุ=null ห้ามเดา ; ตัวเลขให้เป็นเลขล้วนไม่มีหน่วย)
- **isCompetitor** (boolean) = false ถ้ายี่ห้ออยู่ใน "ยี่ห้อของบริษัทเรา" (ดูรายการในตัวเลือก) ; true ถ้ามีคำว่า "คู่แข่ง"/"competitor" หรือเป็นยี่ห้อที่ไม่อยู่ในรายการของเรา ; ไม่มียี่ห้อ/ไม่แน่ใจ=null
- **size**: เก็บพร้อมหน่วยเสมอ (เช่น "500มล", "2.5กก", "150กรัม") ห้ามตัดหน่วยทิ้งเหลือแค่ตัวเลข
- **priceNormal** = ราคาปกติ/ก่อนลด · **pricePromo** = ราคาโปร/หลังลด/ราคาพิเศษ (เช่น "ลดเหลือ 59 จาก 79" → priceNormal:79, pricePromo:59 ; "ราคาพิเศษ 65" → pricePromo:65)
- **discountPct** = %ส่วนลด ถ้าระบุเป็นเปอร์เซ็นต์ (เช่น "ลด 20%" → 20)
- **promoType** = ประเภทกลไกโปร: "discount" (ลดราคา/ลดเหลือ/ราคาพิเศษ) | "buy_x_get_y" (ซื้อ X แถม Y) | "threshold_gift" (ซื้อครบ...บาท รับของแถม) | null
- **buyQty / freeQty** = จำนวนซื้อ/แถม สำหรับ buy_x_get_y (เช่น "ซื้อ 2 แถม 1" → buyQty:2, freeQty:1)
- **thresholdBaht** = ยอดซื้อขั้นต่ำ สำหรับ threshold_gift (เช่น "ซื้อครบ 259 บาท" → 259)
- **stockStatus** = "ของหมด" ถ้าระบุว่าสินค้าหมด/หมดเชลฟ์/OOS ; ปกติ=null
- **facings** = จำนวน facing/หน้าสินค้า สำหรับรายงาน display (เช่น "3 facing" → 3)
- หมายเหตุ: detail (free text) ยังคงใส่ตามเดิมควบคู่กัน (เช่น "159 บาท") — structured fields เป็นส่วนเสริมเพื่อทำ BI`;
export let systemPrompt = DEFAULT_SYSTEM_PROMPT;

let ready = false;
export const masterReady = (): boolean => ready;

export function topicCode(name: string): string {
  return topics.find((t) => t.name === name)?.code || '';
}

export function looksLikeReport(text: string): boolean {
  const v = norm(text);
  if (v.length < 8) return false;
  let signals = 0;
  if (brands.some((b) => { const nb = norm(b); return nb.length >= 3 && v.includes(nb); })) signals++;
  if (accounts.some((a) => { const na = norm(a); return na.length >= 4 && v.includes(na); })) signals++;
  if (/ลด|แถม|โปร|ราคา|บาท|฿|\d\s*\+\s*\d/i.test(text)) signals++;
  if (/\d+\s*(มล|ml|ลิตร|กรัม|กก|g\b|ชิ้น|แพ็ค|ถุง|ขวด|กล่อง)/i.test(text)) signals++;
  return signals >= 2;
}

function normalizeSizeLocal(s: string): string {
  let v = String(s || '').toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  v = v.replace(/ml|มิลลิลิตร/g, 'มล');
  v = v.replace(/kg|กิโลกรัม/g, 'กก');
  v = v.replace(/(?<!ม)[ลl](?!\d|ิตร)/g, 'ลิตร');
  v = v.replace(/g|กรัม/g, 'กรัม');
  return v;
}

function lexicalRagFilter(list: string[], text: string, limit = 20, isSize = false): string[] {
  if (list.length <= limit) return list;
  const nt = norm(text);
  const ntSize = isSize ? normalizeSizeLocal(text) : '';
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const item of list) {
    const ni = norm(item);
    let isMatch = ni && (nt.includes(ni) || ni.includes(nt));

    if (!isMatch && isSize) {
      const nis = normalizeSizeLocal(item);
      if (nis && (ntSize.includes(nis) || nis.includes(ntSize))) {
        isMatch = true;
      } else {
        const digits = item.replace(/\D/g, '');
        if (digits && digits.length >= 2 && nt.includes(digits)) {
          isMatch = true;
        }
      }
    }

    if (!isMatch && !isSize) {
      const hasAliasMatch = aliasRows.some(row =>
        row.canonical === item &&
        (row.kind === 'brand' || row.kind === 'english') &&
        nt.includes(norm(row.alias))
      );
      if (hasAliasMatch) {
        isMatch = true;
      }
    }

    if (isMatch) {
      matched.push(item);
    } else {
      unmatched.push(item);
    }
  }

  return [...matched, ...unmatched].slice(0, limit);
}

export function aiOptions(filterBrands?: string[], rawText = '', topicCode = ''): string {
  const rtLines = Object.entries(reportTypesByTopic)
    .map(([code, types]) => {
      const topicName = topics.find((t) => t.code === code)?.name || code;
      const subLines = (types as string[]).flatMap((rt) => {
        const subs = subtypesByReportType[rt] || [];
        return subs.length ? [`  ${rt} → รายการย่อย: ${subs.join(', ')}`] : [`  ${rt}`];
      });
      return `หัวข้อ "${topicName}" → รายการที่จะแจ้ง:\n${subLines.join('\n')}`;
    })
    .join('\n');
  const subCatLines = Object.entries(subCatsByCategory)
    .map(([cat, subs]) => `  ${cat}: ${(subs as string[]).join(', ')}`)
    .join('\n');

  const brandList = filterBrands?.length
    ? filterBrands
    : (rawText ? lexicalRagFilter(brands, rawText, 50) : brands.slice(0, 50));
  const filteredCompanies = rawText ? lexicalRagFilter(companies, rawText, 15) : companies;
  const filteredSizes = rawText ? lexicalRagFilter(sizes, rawText, 40, true) : sizes.slice(0, 40);
  const filteredPacks = rawText ? lexicalRagFilter(packs, rawText, 15) : packs;

  return [
    `ยี่ห้อในระบบ (ถ้าตรงให้ใช้ชื่อนี้): ${brandList.join(', ')}`,
    `ยี่ห้อของบริษัทเรา (ของเรา ไม่ใช่คู่แข่ง → isCompetitor:false): ${ownBrands.join(', ')}`,
    `บริษัทในระบบ (ตัวเลือกของช่อง company): ${filteredCompanies.join(', ')}`,
    `กลุ่มสินค้า (category) และประเภทสินค้า (subCategory) ในระบบ:\n${subCatLines}`,
    `ไซส์ในระบบ (อ้างอิง — พิมพ์ต่างก็เก็บได้): ${filteredSizes.join(', ')}${sizes.length > filteredSizes.length ? '...' : ''}`,
    `แพ็คในระบบ: ${filteredPacks.join(', ')}`,
    `รายการที่จะแจ้ง/รายการย่อย แยกตามหัวข้อ:\n${rtLines}`,
  ].join('\n');
}

function group(rows: any[], keyCol: string, valCol: string): Record<string, string[]> {
  const m: Record<string, Set<string>> = {};
  for (const r of rows) {
    const k = String(r[keyCol] || '').trim(), v = String(r[valCol] || '').trim();
    if (!k || !v) continue;
    (m[k] = m[k] || new Set()).add(v);
  }
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(m)) out[k] = [...m[k]];
  return out;
}
const col = (rows: any[]) => normUniq(rows.map((r) => String(r.v || '').trim()).filter(Boolean));

// แพ็คที่ "ความหมายเดียวกันแต่พิมพ์ต่างกัน" (เช่น "x1"↔"1", "X24"↔"24", "single"↔"เดี่ยว") ให้เหลือค่าเดียว
function dedupePacks(list: string[]): string[] {
  const keyOf = (v: string): string => {
    let x = v.trim().toLowerCase().replace(/\s+/g, '');
    x = x.replace(/^x(?=\d)/, '');                                   // x1 -> 1, x24 -> 24
    if (['single', 'เดี่ยว', 'แพ็คเดี่ยว', 'แพ็กเดี่ยว'].includes(x)) x = 'เดี่ยว';
    return x;
  };
  const groups = new Map<string, string[]>();
  for (const v of list) {
    const k = keyOf(v);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(v);
  }
  const out: string[] = [];
  for (const arr of groups.values()) {
    // เลือกค่าที่สะอาดสุด: ไม่มี x นำหน้า > ภาษาไทย > สั้นสุด
    const noX = arr.filter((v) => !/^x/i.test(v));
    const pool = noX.length ? noX : arr;
    const thai = pool.filter((v) => /[฀-๿]/.test(v));
    const finalPool = thai.length ? thai : pool;
    out.push([...finalPool].sort((a, b) => a.length - b.length)[0]);
  }
  return out;
}

export async function loadMaster(): Promise<void> {
  if (!sqlEnabled()) throw new Error('ยังไม่ได้ตั้งค่า SQL (ต้องมี DB_SERVER และ DB_PASSWORD ใน .env)');
  try {
    const _topics = (await query('EXEC dbo.SpGetTopics')).map((r) => ({ code: r.code, name: r.name_th }));
    const _reportTypesByTopic = group(await query('EXEC dbo.SpGetReportTypes'), 'k', 'v');
    const _subtypesByReportType = group(await query('EXEC dbo.SpGetReportSubtypes'), 'k', 'v');

    const _channels = col(await query('EXEC dbo.SpGetChannels'));
    const accCh = await query('EXEC dbo.SpGetAccountChannels');
    const _accountsByChannel = group(accCh, 'k', 'v');
    const _accounts = [...new Set(accCh.map((r) => String(r.v || '').trim()).filter(Boolean))];
    const storeRows = await query('EXEC dbo.SpGetStoreRows');
    const _branchesByAccount = group(storeRows.map((r) => ({ k: r.account, v: r.branch })), 'k', 'v');
    const _provinceOf: Record<string, string> = {};
    const pvSet = new Set<string>();
    for (const r of storeRows) {
      const acc = String(r.account || '').trim(), br = String(r.branch || '').trim(), pv = String(r.province || '').trim();
      if (acc && br && pv) _provinceOf[acc + '|' + br] = pv;
      if (pv) pvSet.add(pv);
    }
    const _provinces = [...pvSet];

    const _companies = col(await query('EXEC dbo.SpGetCompanies'));
    const _categories = col(await query('EXEC dbo.SpGetCategories'));
    const _subCatsByCategory = group(await query('EXEC dbo.SpGetSubCats'), 'k', 'v');
    const _brandsBySubCat = group(await query('EXEC dbo.SpGetBrandsBySubCat'), 'k', 'v');
    const _sizes = col(await query('EXEC dbo.SpGetSizes'));
    const _packs = dedupePacks(col(await query('EXEC dbo.SpGetPacks')));
    const vset = new Set<string>();
    for (const r of await query('EXEC dbo.SpGetVariants')) {
      String(r.v).split(/[\/,]/).map((x) => x.trim()).filter((x) => x && x.length <= 60).forEach((x) => vset.add(x));
    }
    const _variants = normUniq([...vset]);
    const _brands = [...new Set(Object.values(_brandsBySubCat).flat())];
    const _ownBrands = col(await query('SELECT DISTINCT brand AS v FROM dbo.M_Product WHERE company = @c AND brand IS NOT NULL AND LEN(LTRIM(RTRIM(brand))) > 0', { c: process.env.OWN_COMPANY || 'นีโอ' }));

    const _defaultSubCatMap: Record<string, string> = {};
    try {
      const rows = await query(`
        SELECT brand, sub_category, COUNT(*) as cnt 
        FROM M_Product 
        WHERE brand IS NOT NULL AND brand <> '' AND sub_category IS NOT NULL AND sub_category <> '' 
        GROUP BY brand, sub_category 
        ORDER BY brand, cnt DESC
      `);
      const processedBrands = new Set<string>();
      for (const r of rows) {
        const br = String(r.brand || '').trim();
        const sub = String(r.sub_category || '').trim();
        if (br && sub && !processedBrands.has(norm(br))) {
          processedBrands.add(norm(br));
          _defaultSubCatMap[norm(br)] = sub;
        }
      }
    } catch (e: any) {
      console.warn('master: SpGetBrands default subcategory load failed —', e.message);
    }

    let _aliasRows: { kind: string; alias: string; canonical: string }[] = [];
    try {
      _aliasRows = (await query('EXEC dbo.SpGetMatchAlias'))
        .map((r) => ({ kind: String(r.kind || '').trim(), alias: String(r.alias || '').trim(), canonical: String(r.canonical || '').trim() }));
    } catch (e: any) {
      _aliasRows = [];
      console.warn('master: SpGetMatchAlias อ่านไม่ได้ —', e.message);
    }

    const synonymsByGroup: Record<string, string[]> = {};
    for (const row of _aliasRows) {
      if (row.kind === 'synonym') {
        const canonical = row.canonical;
        if (!synonymsByGroup[canonical]) {
          synonymsByGroup[canonical] = [];
        }
        synonymsByGroup[canonical].push(row.alias);
      }
    }
    const dynamicSynonyms = Object.values(synonymsByGroup);
    synonymGroups = dynamicSynonyms.length > 0 ? dynamicSynonyms : DEFAULT_SYNONYM_GROUPS;

    const variantsByCluster: Record<string, string[]> = {};
    for (const row of _aliasRows) {
      if (row.kind === 'variant_cluster') {
        const canonical = row.canonical;
        if (!variantsByCluster[canonical]) {
          variantsByCluster[canonical] = [];
        }
        variantsByCluster[canonical].push(row.alias);
      }
    }
    const dynamicVariants = Object.values(variantsByCluster);
    variantClusters = dynamicVariants.length > 0 ? dynamicVariants : DEFAULT_VARIANT_CLUSTERS;

    const subcatKws: Record<string, string[]> = {};
    for (const row of _aliasRows) {
      if (row.kind === 'subcat_keyword') {
        const canonical = row.canonical;
        if (!subcatKws[canonical]) {
          subcatKws[canonical] = [];
        }
        subcatKws[canonical].push(row.alias);
      }
    }
    subcatKeywords = Object.keys(subcatKws).length > 0 ? subcatKws : DEFAULT_SUBCAT_KEYWORDS;

    const vSubMap: Record<string, string> = {};
    for (const row of _aliasRows) {
      if (row.kind === 'variant_to_subcat') {
        vSubMap[norm(row.alias)] = row.canonical;
      }
    }
    variantToSubcatMap = vSubMap;

    const dbPromptRow = _aliasRows.find((r) => r.kind === 'system_prompt');
    systemPrompt = dbPromptRow ? dbPromptRow.canonical : DEFAULT_SYSTEM_PROMPT;

    dateSignalRegex1 = DATE_SIGNAL_REGEX_1;
    dateSignalRegex2 = DATE_SIGNAL_REGEX_2;
    dateSignalRegex3 = DATE_SIGNAL_REGEX_3;
    dateSignalRegex4 = DATE_SIGNAL_REGEX_4;
    dayWeekCheckRegex = DAY_WEEK_CHECK_REGEX;
    dayNamesList = DAY_NAMES_LIST;

    for (const r of _aliasRows) {
      if (r.kind === 'date_config') {
        const can = r.canonical;
        if (r.alias === 'date_signal_1') dateSignalRegex1 = new RegExp(can);
        else if (r.alias === 'date_signal_2') dateSignalRegex2 = new RegExp(can);
        else if (r.alias === 'date_signal_3') dateSignalRegex3 = new RegExp(can);
        else if (r.alias === 'date_signal_4') dateSignalRegex4 = new RegExp(can);
        else if (r.alias === 'day_week_check') dayWeekCheckRegex = new RegExp(can);
        else if (r.alias === 'day_names') {
          dayNamesList = can.split(',').map((s) => {
            const [name, val] = s.split(':');
            return { name, val: parseInt(val, 10) };
          });
        }
      }
    }

    topics = _topics; reportTypesByTopic = _reportTypesByTopic; subtypesByReportType = _subtypesByReportType;
    channels = _channels; accountsByChannel = _accountsByChannel; accounts = _accounts;
    branchesByAccount = _branchesByAccount; provinceOf = _provinceOf; provinces = _provinces;
    companies = _companies; categories = _categories; subCatsByCategory = _subCatsByCategory;
    brandsBySubCat = _brandsBySubCat; sizes = _sizes; packs = _packs; variants = _variants; brands = _brands; ownBrands = _ownBrands;
    defaultSubCatMap = _defaultSubCatMap;
    aliasRows = _aliasRows;
    setAliases(aliasRows);
    setSynonymGroups(synonymGroups);
    ready = true;

    const nBranches = Object.values(branchesByAccount).flat().length;
    console.log(`master: โหลดจาก SQL ✅ | categories ${categories.length} | brands ${brands.length} | accounts ${accounts.length} | branches ${nBranches} | sizes ${sizes.length} | variants ${variants.length} | aliases ${aliasRows.length}`);
  } catch (e: any) {
    console.error('master: โหลดจาก SQL ไม่สำเร็จ (คงข้อมูลเดิมไว้) —', e.message);
    throw e;
  }
}


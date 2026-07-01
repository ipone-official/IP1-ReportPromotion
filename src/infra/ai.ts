import * as D from './master';
import crypto from 'crypto';
import IORedis from 'ioredis';
import { envNumber } from './env';
import { logLatency } from './timing';

const KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE = 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const AI_TIMEOUT_MS = envNumber('DEEPSEEK_TIMEOUT_MS', 35000, 1000);
const AI_HTTP_RETRIES = envNumber('DEEPSEEK_HTTP_RETRIES', 1, 0);
const AI_JSON_ATTEMPTS = envNumber('DEEPSEEK_JSON_ATTEMPTS', 2, 1);

let redis: IORedis | null = null;
try {
  redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', () => {
  });
} catch (e) {
  console.warn('Redis connection failed to initialize in AI parser:', e);
}

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

export async function parseReport(
  input: string,
  expectFields?: string[],
  preMatched?: { account?: string; branch?: string; brands?: string[]; hasSecondStore?: boolean; secondStoreName?: string },
  topicCode?: string
): Promise<any> {
  const today = new Date().toISOString().slice(0, 10);
  const opts = D.aiOptions(preMatched?.brands, input, topicCode);

  const hash = crypto.createHash('md5').update(JSON.stringify({ input, expectFields, preMatched, topicCode })).digest('hex');
  const cacheKey = `ai_parse:${hash}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[cache] ai.parseReport hit chars=${input.length}`);
        return JSON.parse(cached);
      }
    } catch (err: any) {
      console.warn('AI cache read error:', err.message);
    }
  }

  let sys = D.systemPrompt + `\n\n## ตัวเลือกในระบบ\n${opts}\nวันนี้ ${today}`;

  if (topicCode) {
    sys += `\n\n## หัวข้อรายงานปัจจุบันที่ผู้ใช้แจ้งคือ "${topicCode}"`;
    if (topicCode === 'npd') {
      sys += ` (สินค้าใหม่) -> สินค้าทุกรายการใน items ให้ตั้งค่า "isNpd": true และให้ตั้งค่า reportType และ reportSubtype เป็น null หากไม่มีโปรโมชั่น แต่หากข้อความมีการระบุโปรโมชั่นชัดเจน (เช่น ลดราคา, ซื้อ2แถม1, ราคาพิเศษ) ให้สกัดค่า reportType และ reportSubtype ตามปกติตามตัวเลือกในระบบ`;
    }
  }

  if (preMatched?.account) {
    sys += `\n\n## ข้อมูลร้านค้าหลักที่ระบบตรวจจับพบแน่นอนแล้ว (บังคับใช้ค่าตามนี้ ห้ามแปลงชื่อหรือสกัดชื่ออื่นขัดแย้ง)
- account = "${preMatched.account}"
- branch = "${preMatched.branch || 'null'}"`;
    if (preMatched.hasSecondStore && preMatched.brands?.length) {
      sys += `\n- เนื่องจากข้อความนี้มีการรายงานหลายห้าง/ร้านค้า แต่ตารางระบบรองรับรายงานได้เพียงร้านเดียว ระบบได้ใช้ร้านค้าหลักตามรายการข้างบนแล้ว ดังนั้น **กรุณาสกัดและคืนค่าข้อมูลเฉพาะสินค้าที่มียี่ห้อดังต่อไปนี้เท่านั้น**: ${preMatched.brands.join(', ')} (ยี่ห้ออื่นๆ ที่อยู่ในร้านค้าอื่นให้ตัดทิ้ง ห้ามนำมาใส่ในรายการ items หรือ extra เด็ดขาด)`;
    }
  }

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
- ฟิลด์ที่ถามมีคำว่า "รายละเอียดสินค้า" → items[0].itemNote
- ฟิลด์ที่ถามขึ้นต้น "ยี่ห้อ" → คำตอบใส่ items[0].brand — ข้อยกเว้นเดียวของกฎ "ไม่ต้องใส่ brand" ข้อถัดไป
- ใส่ทุกค่าที่ตอบลง items[0] โดย "ไม่ต้องใส่ brand" — วงเล็บหลังชื่อฟิลด์ที่ถาม เป็นแค่ชื่อยี่ห้ออ้างอิง ไม่ใช่ค่าที่ต้องแตกเป็น brand
- ตอบพ่วงหลายยี่ห้อในประโยคเดียว → แยกเป็นหลาย items ตามยี่ห้อ (ยี่ห้อใช้จับคู่รายการเดิม)
- ตอบหลายฟิลด์รวดเดียว → แยกแต่ละฟิลด์ให้ถูก (เช่น ตอบวันที่ + ชื่อบริษัทมาด้วย → startDate/endDate + company)`;
  }

  const responseFormat = { type: 'json_object' };

  const reqBody = JSON.stringify({
    model: MODEL,
    temperature: 0,
    response_format: responseFormat,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: input },
    ],
  });
  let lastErr = 'AI ไม่มีคำตอบ';
  const started = Date.now();
  for (let attempt = 0; attempt < AI_JSON_ATTEMPTS; attempt++) {
    const data: any = await fetchJson(BASE, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: reqBody,
    }, AI_TIMEOUT_MS, AI_HTTP_RETRIES);
    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      let parsed: any = null;
      try { parsed = JSON.parse(content); } catch { }
      const m = content.match(/\{[\s\S]*\}/);
      if (!parsed && m) { try { parsed = JSON.parse(m[0]); } catch { } }
      if (parsed) {
        if (redis) {
          try {
            await redis.set(cacheKey, JSON.stringify(parsed), 'EX', 1800);
          } catch (err: any) {
            console.warn('AI cache write error:', err.message);
          }
        }
        logLatency('ai.parseReport ok', started, { chars: input.length });
        return parsed;
      }
      lastErr = 'AI ตอบไม่เป็น JSON';
    }
  }
  logLatency('ai.parseReport failed', started, { chars: input.length, error: lastErr }, 'warn');
  throw new Error(lastErr);
}

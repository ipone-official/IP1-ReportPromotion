import * as fs from 'fs';
import * as path from 'path';

// HSL -> hex (S,L ปรับให้แถบสีอ่านชัดบนการ์ดพื้นขาว)
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// สีของลำดับที่ i: ใช้ golden angle (137.5°) กระจายสีให้ห่างกันมากที่สุด — ไม่จำกัดจำนวน ไม่ซ้ำง่าย
function colorForIndex(i: number): string {
  const hue = (i * 137.508) % 360;
  return hslToHex(hue, 68, 42);
}

const DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'user-colors.json');

let map: Record<string, number> = {};
try { map = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { map = {}; }

function persist(): void {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(map));
  } catch (e: any) {
    console.error('userColor persist failed:', e?.message);
  }
}

// คืนสีประจำตัวผู้ใช้ — คนใหม่ได้สีถัดไปอัตโนมัติตอนพิมพ์ครั้งแรก
// (รองรับคนทยอยเข้า ไม่ต้องครบก่อน, สีคงที่ตลอดเพราะบันทึกลงไฟล์)
export function getUserColor(userId: string): string {
  if (!userId) return colorForIndex(0);
  if (!(userId in map)) {
    map[userId] = Object.keys(map).length;
    persist();
  }
  return colorForIndex(map[userId]);
}

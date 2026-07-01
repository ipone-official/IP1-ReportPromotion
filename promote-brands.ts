import 'dotenv/config';
import { query } from './src/infra/db';
import { loadMaster } from './src/infra/master';
import * as D from './src/infra/master';
import { matchMaster } from './src/domain/match';

/* ============================================================
   promote-brands — ทำให้ master "โตเอง" จากรายงานจริง (open-world cold-start)
   ยี่ห้อที่ปรากฏใน T_Report_Item (รายงานที่ผู้ใช้บันทึก = ยืนยันแล้ว) บ่อยพอ
   และยังไม่อยู่ใน master → เติมเข้า M_Product (พร้อม category/subcat ที่พบบ่อยสุด)
   ใช้:
     npm run promote:brands              → dry-run (โชว์ candidate เฉย ๆ)
     npm run promote:brands -- --apply   → เติมเข้า master จริง
     npm run promote:brands -- --min=3   → ตั้ง threshold ความถี่ (default 2)
   ============================================================ */

const APPLY = process.argv.includes('--apply');
const MIN = Number((process.argv.find((a) => a.startsWith('--min=')) || '--min=2').split('=')[1]) || 2;

const modal = (arr: (string | null)[]): string | null => {
  const c = new Map<string, number>();
  for (const v of arr) { const k = (v || '').trim(); if (!k) continue; c.set(k, (c.get(k) || 0) + 1); }
  let best: string | null = null, bn = 0;
  for (const [k, n] of c) if (n > bn) { best = k; bn = n; }
  return best;
};

(async () => {
  await loadMaster();
  console.log(`=== promote-brands (${APPLY ? 'APPLY' : 'DRY-RUN'}, min freq=${MIN}) ===`);
  console.log(`master brands ก่อน: ${D.brands.length}\n`);

  const rows = await query<{ brand: string; category: string | null; sub_category: string | null }>(`
    SELECT brand, category, sub_category FROM dbo.T_Report_Item
    WHERE brand IS NOT NULL AND LTRIM(RTRIM(brand))<>''`);

  const g = new Map<string, { sample: string; n: number; cats: (string | null)[]; subs: (string | null)[] }>();
  for (const r of rows) {
    const b = r.brand.trim();
    if (!g.has(b)) g.set(b, { sample: b, n: 0, cats: [], subs: [] });
    const e = g.get(b)!; e.n++; e.cats.push(r.category); e.subs.push(r.sub_category);
  }

  const candidates: { brand: string; n: number; cat: string | null; sub: string | null }[] = [];
  for (const e of g.values()) {
    if (matchMaster(e.sample, D.brands).best) continue;   // อยู่ใน master แล้ว (หรือ match ได้)
    if (e.n < MIN) continue;                               // ความถี่ไม่ถึงเกณฑ์ (กัน typo/one-off)
    candidates.push({ brand: e.sample, n: e.n, cat: modal(e.cats), sub: modal(e.subs) });
  }
  candidates.sort((a, b) => b.n - a.n);

  if (!candidates.length) { console.log('ไม่มี candidate (master ครอบคลุมรายงานที่บันทึกแล้ว หรือยังไม่ถึง threshold)'); process.exit(0); }

  console.log(`พบ candidate ${candidates.length} ยี่ห้อ (ปรากฏ >= ${MIN} ครั้งใน saved reports, ยังไม่อยู่ master):`);
  for (const c of candidates) console.log(`    "${c.brand}" (${c.n})  cat=${c.cat || '-'}  sub=${c.sub || '-'}`);

  if (!APPLY) { console.log('\n[DRY-RUN] ยังไม่เติมจริง — ตรวจรายชื่อแล้วรันซ้ำด้วย --apply'); process.exit(0); }

  let added = 0;
  for (const c of candidates) {
    const exists = await query<{ id: number }>(`SELECT TOP 1 id FROM dbo.M_Product WHERE LTRIM(RTRIM(brand))=@b`, { b: c.brand });
    if (exists.length) continue;
    await query(`INSERT INTO dbo.M_Product (company, category, sub_category, brand) VALUES (NULL, @cat, @sub, @b)`,
      { cat: c.cat, sub: c.sub, b: c.brand });
    added++;
    console.log(`  + เพิ่ม "${c.brand}"`);
  }
  console.log(`\nเติม master แล้ว ${added} ยี่ห้อ — restart worker (หรือรอ refresh 10 นาที) เพื่อให้ D.brands + Meili อัปเดต`);
  process.exit(0);
})();

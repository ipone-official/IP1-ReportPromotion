import { query, sqlEnabled } from './db';
import * as D from './master';
import { matchMaster } from '../domain/match';

/* auto-promote — self-improving: ยี่ห้อที่ปรากฏใน "รายงานที่บันทึกจริง" (ผู้ใช้ commit แล้ว)
   ตั้งแต่ MIN ครั้งขึ้นไป และยังไม่อยู่ master → เติมเข้า M_Product อัตโนมัติ
   (gate: saved report = สัญญาณยืนยันโดยนัย + ความถี่ → กัน typo/one-off) */
const MIN = Number(process.env.AUTO_PROMOTE_MIN || 3);

export async function autoPromoteBrands(): Promise<number> {
  if (!sqlEnabled()) return 0;
  try {
    const rows = await query<{ brand: string; category: string | null; sub_category: string | null; n: number }>(`
      SELECT brand, MAX(category) AS category, MAX(sub_category) AS sub_category, COUNT(*) AS n
      FROM dbo.T_Report_Item
      WHERE brand IS NOT NULL AND LEN(LTRIM(RTRIM(brand))) > 0
      GROUP BY brand HAVING COUNT(*) >= ${MIN}`);
    let added = 0;
    for (const r of rows) {
      const b = (r.brand || '').trim();
      if (!b || matchMaster(b, D.brands).best) continue;                 
      const ex = await query<{ id: number }>(`SELECT TOP 1 id FROM dbo.M_Product WHERE LTRIM(RTRIM(brand)) = @b`, { b });
      if (ex.length) continue;
      await query(`INSERT INTO dbo.M_Product (company, category, sub_category, brand) VALUES (NULL, @c, @s, @b)`,
        { c: r.category, s: r.sub_category, b });
      added++;
      console.log(`auto-promote: + ยี่ห้อ "${b}" (จาก ${r.n} รายงานจริง)`);
    }
    return added;
  } catch (e: any) {
    console.warn('autoPromoteBrands error:', e?.message);
    return 0;
  }
}

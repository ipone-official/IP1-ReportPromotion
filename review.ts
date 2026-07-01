import 'dotenv/config';
import { query } from './src/infra/db';

/* review — ดูรายงานจริงล่าสุด: ข้อความดิบที่หน้างานพิมพ์ → ระบบจับเข้าฟิลด์ได้อะไร
   ใช้ตอน pilot: กวาดตาดูว่า "มั่ว" ตรงไหน → ไปอุด (เติม master / จูน prompt / store)
   รัน:  npx tsx review.ts            (ล่าสุด 15)
        npx tsx review.ts --n=40      (ล่าสุด 40)  */
const N = Number((process.argv.find((a) => a.startsWith('--n=')) || '--n=15').split('=')[1]) || 15;
const one = (v: any) => String(v ?? '-');
const txt = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim();

(async () => {
  const reports = await query<any>(`SELECT TOP ${N} id, account, branch, company, start_date, end_date, observation_date, note, extra, created_at FROM dbo.T_Report ORDER BY id DESC`);
  if (!reports.length) { console.log('ยังไม่มีรายงานบันทึก (T_Report ว่าง) — รอ pilot'); process.exit(0); }
  for (const r of reports) {
    const items = await query<any>(`SELECT brand, sub_category, size, pack, variant, report_type, report_subtype, detail, is_competitor, price_normal, price_promo, discount_pct, promo_type, is_npd FROM dbo.T_Report_Item WHERE report_id=@id`, { id: r.id });
    console.log(`\n===== report #${r.id}  (${one(r.created_at)}) =====`);
    console.log(`ดิบ : "${txt(r.note)}"`);
    console.log(`ร้าน: ${one(r.account)} / ${one(r.branch)}  | บริษัท: ${one(r.company)}  | วันที่: ${one(r.start_date)}~${one(r.end_date)}`);
    items.forEach((it: any, i: number) => console.log(
      `  [${i}] ยี่ห้อ=${one(it.brand)} | หมวด=${one(it.sub_category)} | size=${one(it.size)} pack=${one(it.pack)} variant=${one(it.variant)}\n` +
      `      รายงาน=${one(it.report_type)}/${one(it.report_subtype)} | ราคา ${one(it.price_normal)}→${one(it.price_promo)} (${one(it.discount_pct)}%) promo=${one(it.promo_type)} | คู่แข่ง=${it.is_competitor == null ? '-' : (it.is_competitor ? 'ใช่' : 'ไม่')} npd=${it.is_npd ? 'ใช่' : '-'}\n` +
      `      detail="${txt(it.detail)}"`));
    if (r.extra) console.log(`  extra: ${txt(r.extra)}`);
  }
  console.log(`\n— รวม ${reports.length} รายงาน — กวาดตา "ดิบ → ฟิลด์" เจอมั่วตรงไหน จดไว้แล้วบอกผมไปอุด —`);
  process.exit(0);
})();

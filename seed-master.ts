import 'dotenv/config';
import { query } from './src/infra/db';
import { loadMaster } from './src/infra/master';
import * as D from './src/infra/master';
import { matchMaster } from './src/domain/match';

/* ============================================================
   seed-master — เติม product master (category/subCategory/brand) ครบทุกหมวด
   ยี่ห้อ FMCG ไทยจริง (home + personal care) ทั้งของนีโอและคู่แข่ง
   + รวมยี่ห้อที่ ParseLog ยืนยันว่าหน้างานเจอจริง
   ใช้:  npx tsx seed-master.ts            (dry-run โชว์ของใหม่)
        npx tsx seed-master.ts --apply     (เติมจริง)
   idempatent: ข้ามยี่ห้อที่มีใน master แล้ว
   ============================================================ */
const APPLY = process.argv.includes('--apply');

// taxonomy: [category, subCategory, [brands]]  — เฉพาะยี่ห้อที่มีจริงในตลาดไทย
const TAX: [string, string, string[]][] = [
  ['ผลิตภัณฑ์ซักผ้า', 'น้ำยา/ผงซักฟอก', ['บรีส', 'โอโม', 'เปา', 'แอทแทค', 'ทอป', 'ไทด์', 'แอเรียล', 'คาวบอย', 'ฟ้าใส', 'วิทแทท']],
  ['ผลิตภัณฑ์ซักผ้า', 'ปรับผ้านุ่ม', ['คอมฟอร์ท', 'ดาวนี่', 'ไฟน์ไลน์', 'สนักเกิล', 'ดีนี่', 'ไฮยีน', 'เปาซอฟท์']],
  ['ผลิตภัณฑ์ซักผ้า', 'ซักผ้าเด็ก', ['ดีนี่', 'ดีเอ็มพี', 'เพียวรีน']],
  ['ผลิตภัณฑ์ซักผ้า', 'ฟอกขาว/ขจัดคราบ', ['ไฮเตอร์']],
  ['ผลิตภัณฑ์ล้างจาน', 'น้ำยาล้างจาน', ['ซันไลต์', 'ไลปอนเอฟ', 'โทมิ', 'สมาร์ท']],
  ['ผลิตภัณฑ์ทำความสะอาดบ้าน', 'ห้องน้ำ/สุขภัณฑ์', ['วิกซอล', 'เป็ด', 'ฮาร์ปิค', 'มิสเตอร์มัสเซิล', 'เอ็กซิท']],
  ['ผลิตภัณฑ์ทำความสะอาดบ้าน', 'ถูพื้น/อเนกประสงค์', ['มาจิคลีน', 'เดทตอล', 'สปาคลีน', 'กลีนแม็กซ์']],
  ['ผลิตภัณฑ์ปรับอากาศ/ดับกลิ่น', 'สเปรย์/ปรับอากาศ', ['กลาเด้', 'แอมบิเพอร์']],
  ['ระงับกลิ่นกาย', 'โรลออน/สเปรย์', ['เรโซนา', 'นีเวีย', 'โอลด์สไปซ์', 'แอ๊กซ์', 'ดอฟ', 'เฟรชแอนด์ตี้', 'แดนซ์', 'ทรอส', '12พลัส']],
  ['น้ำหอม/โคโลญ', 'บอดี้สเปรย์/โคโลญ', ['เอเวอร์เซนส์', 'เทลมี', 'มิสทิน']],
  ['สบู่/ครีมอาบน้ำ', 'สบู่/เจลอาบน้ำ', ['ลักส์', 'โพรเทคส์', 'บีไนซ์', 'เคป', 'นานา']],
  ['แชมพู/ครีมนวด', 'แชมพู', ['ซันซิล', 'แพนทีน', 'เคลียร์', 'เฮดแอนด์โชว์เดอร์', 'รีจอยส์', 'โลรีอัล']],
  ['ยาสีฟัน/ดูแลช่องปาก', 'ยาสีฟัน', ['คอลเกต', 'ดาร์ลี่', 'ซอลส์', 'ซิสเทมา', 'เซ็นโซดายน์']],
  ['ดูแลผิวหน้า', 'โฟม/ครีมล้างหน้า', ['การ์นิเย่', 'พอนด์ส', 'บิโอเร']],
  ['ผ้าอนามัย', 'ผ้าอนามัย', ['โซฟี', 'ลอรีเอะ', 'โมเดส', 'คอตเทกซ์']],
  ['ผลิตภัณฑ์เด็ก', 'อาบน้ำ/แป้งเด็ก', ['จอห์นสัน', 'เพียวรีน']],
];

(async () => {
  await loadMaster();
  console.log(`=== seed-master (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`master brands ก่อน: ${D.brands.length} | categories ${D.categories.length}\n`);

  const seen = new Set<string>();
  const toAdd: { cat: string; sub: string; brand: string }[] = [];
  for (const [cat, sub, brands] of TAX) {
    for (const brand of brands) {
      if (seen.has(brand)) continue; seen.add(brand);
      if (matchMaster(brand, D.brands).best) continue;     // มีใน master แล้ว → ข้าม
      toAdd.push({ cat, sub, brand });
    }
  }

  console.log(`ยี่ห้อใหม่ที่จะเติม: ${toAdd.length}`);
  for (const x of toAdd) console.log(`    + "${x.brand}"  [${x.cat} / ${x.sub}]`);

  if (!APPLY) { console.log('\n[DRY-RUN] ยังไม่เติม — ตรวจแล้วรันซ้ำด้วย --apply'); process.exit(0); }

  let added = 0;
  for (const x of toAdd) {
    const ex = await query<{ id: number }>(`SELECT TOP 1 id FROM dbo.M_Product WHERE LTRIM(RTRIM(brand))=@b`, { b: x.brand });
    if (ex.length) continue;
    await query(`INSERT INTO dbo.M_Product (company, category, sub_category, brand) VALUES (NULL, @c, @s, @b)`, { c: x.cat, s: x.sub, b: x.brand });
    added++;
  }
  console.log(`\nเติมแล้ว ${added} ยี่ห้อ — restart worker เพื่อให้ D.brands + Meili อัปเดต`);
  process.exit(0);
})();

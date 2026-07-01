import 'dotenv/config';
import { query } from './src/infra/db';
import { loadMaster } from './src/infra/master';
import * as D from './src/infra/master';
import { matchMaster, norm } from './src/domain/match';

/* ============================================================
   seed-aliases — เติม alias (อังกฤษ + คำสะกดผิดที่พบบ่อย) ให้ยี่ห้อใน master
   ปิดช่องที่ Meili ช่วยไม่ได้ (อังกฤษ↔ไทย คนละสคริปต์) — หน้างานพิมพ์อังกฤษบ่อย
   ใช้:  npx tsx seed-aliases.ts            (dry-run)
        npx tsx seed-aliases.ts --apply     (เติมจริง)
   ============================================================ */
const APPLY = process.argv.includes('--apply');

// canonical(ไทยใน master) -> [alias อังกฤษ/สะกดผิด] (เก็บแบบอ่านง่าย; norm จัดการ case/space เอง)
const ALIASES: Record<string, string[]> = {
  'บรีส': ['breeze'], 'โอโม': ['omo'], 'เปา': ['pao'], 'แอทแทค': ['attack'], 'ทอป': ['top'], 'ไทด์': ['tide'],
  'แอเรียล': ['ariel'], 'คาวบอย': ['cowboy'], 'ฟ้าใส': ['fasai'],
  'คอมฟอร์ท': ['comfort'], 'ดาวนี่': ['downy'], 'ไฟน์ไลน์': ['fineline', 'fine line'], 'สนักเกิล': ['snuggle'],
  'ดีนี่': ['d-nee', 'dnee', 'ดี-นี่'], 'เพียวรีน': ['pureen'], 'ไฮเตอร์': ['haiter', 'hiter'],
  'ซันไลต์': ['sunlight'], 'ไลปอนเอฟ': ['lipon', 'lipon f'], 'สมาร์ท': ['smart'], 'โทมิ': ['tomi'],
  'วิกซอล': ['vixol'], 'เป็ด': ['duck'], 'ฮาร์ปิค': ['harpic'], 'มิสเตอร์มัสเซิล': ['mr muscle', 'mr.muscle'],
  'เอ็กซิท': ['exit'], 'มาจิคลีน': ['magiclean', 'magic clean'], 'เดทตอล': ['dettol'],
  'กลาเด้': ['glade'], 'แอมบิเพอร์': ['ambipur', 'ambi pur'],
  'เรโซนา': ['rexona'], 'นีเวีย': ['nivea'], 'โอลด์สไปซ์': ['old spice', 'oldspice'], 'แอ๊กซ์': ['axe'],
  'ดอฟ': ['dove'], 'ทรอส': ['tros'], '12พลัส': ['12plus', 'twelve plus'], 'มิสทิน': ['mistine'],
  'ลักส์': ['lux'], 'โพรเทคส์': ['protex'], 'บีไนซ์': ['benice', 'be nice'], 'เคป': ['cape'],
  'ซันซิล': ['sunsilk'], 'แพนทีน': ['pantene'], 'เคลียร์': ['clear'], 'เฮดแอนด์โชว์เดอร์': ['head & shoulders', 'head and shoulders', 'h&s'],
  'รีจอยส์': ['rejoice'], 'โลรีอัล': ['loreal', "l'oreal"],
  'คอลเกต': ['colgate'], 'ดาร์ลี่': ['darlie'], 'ซอลส์': ['salz'], 'ซิสเทมา': ['systema'], 'เซ็นโซดายน์': ['sensodyne'],
  'การ์นิเย่': ['garnier'], 'พอนด์ส': ['ponds', "pond's"], 'บิโอเร': ['biore'],
  'โซฟี': ['sofy'], 'ลอรีเอะ': ['laurier'], 'โมเดส': ['modess'], 'คอตเทกซ์': ['kotex'], 'จอห์นสัน': ['johnson', 'johnsons', "johnson's"],
};

(async () => {
  await loadMaster();
  console.log(`=== seed-aliases (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  const have = new Set(D.aliasRows.filter((r) => r.kind === 'brand').map((r) => norm(r.alias) + '|' + norm(r.canonical)));
  const toAdd: { alias: string; canonical: string }[] = [];
  for (const [canon, aliases] of Object.entries(ALIASES)) {
    if (!matchMaster(canon, D.brands).best) continue;            // canonical ต้องอยู่ใน master
    for (const a of aliases) {
      if (have.has(norm(a) + '|' + norm(canon))) continue;       // มี alias นี้แล้ว
      if (matchMaster(a, D.brands).best === canon) continue;     // resolve ได้อยู่แล้ว ไม่ต้องเพิ่ม
      toAdd.push({ alias: a, canonical: canon });
    }
  }
  console.log(`alias ใหม่: ${toAdd.length}`);
  for (const x of toAdd) console.log(`    + "${x.alias}" → "${x.canonical}"`);
  if (!APPLY) { console.log('\n[DRY-RUN] รันซ้ำด้วย --apply เพื่อเติมจริง'); process.exit(0); }

  let n = 0;
  for (const x of toAdd) {
    const ex = await query<{ id: number }>(`SELECT TOP 1 id FROM dbo.M_MatchAlias WHERE kind='brand' AND LTRIM(RTRIM(alias))=@a AND LTRIM(RTRIM(canonical))=@c`, { a: x.alias, c: x.canonical });
    if (ex.length) continue;
    await query(`INSERT INTO dbo.M_MatchAlias (kind, alias, canonical, note) VALUES ('brand', @a, @c, 'seed-en')`, { a: x.alias, c: x.canonical });
    n++;
  }
  console.log(`\nเติม alias แล้ว ${n} — restart worker เพื่อโหลด`);
  process.exit(0);
})();

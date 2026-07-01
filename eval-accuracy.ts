import 'dotenv/config';
import { query, sqlEnabled } from './src/infra/db';
import { loadMaster } from './src/infra/master';
import * as D from './src/infra/master';
import { matchMaster, norm, fuzzyBrandAccept } from './src/domain/match';
import { searchBrandMeili, meiliEnabled } from './src/infra/meilisearch';

/* ============================================================
   AI ACCURACY EVAL — วัดความแม่นของ parse+match จาก T_ParseLog จริง
   เชื่อมกับ master: ค่าที่ extract มาแล้ว "ไม่ match master" = ต้องเติม master หรือ matching พลาด
   วัดผล A2 (Meili): ตัวที่ string match พลาด แต่ Meili จับได้ = กำไรจาก A2
   รัน: npm run audit:accuracy
   ============================================================ */

type Item = { brand?: string; subCategory?: string; size?: string; needsReview?: boolean; rawBrand?: string };
const parseItems = (j: any): Item[] => {
  try { const o = typeof j === 'string' ? JSON.parse(j) : j; return Array.isArray(o?.items) ? o.items : []; }
  catch { return []; }
};

// resolve เดียวกับ A2 (Meili candidate → ยืนยันด้วย editDist/soundex)
async function meiliResolve(raw: string): Promise<string | undefined> {
  if (!meiliEnabled() || !raw) return undefined;
  const cands = await searchBrandMeili(raw, 5);
  if (!cands.length) return undefined;
  return cands.find((c) => fuzzyBrandAccept(raw, c));
}

async function run() {
  if (!sqlEnabled()) { console.error('SQL ไม่ได้เปิด (ตั้ง DB_* ใน .env)'); process.exit(1); }
  await loadMaster();
  console.log('=== AI ACCURACY EVAL (จาก T_ParseLog) ===');
  console.log(`master: brands ${D.brands.length} | meiliEnabled ${meiliEnabled()}\n`);

  const total = (await query<{ c: number }>('SELECT COUNT(*) c FROM dbo.T_ParseLog'))[0].c;
  if (!total) { console.log('ยังไม่มี log'); process.exit(0); }

  // 1) outcome funnel
  const oc = await query<{ outcome: string; c: number }>('SELECT outcome, COUNT(*) c FROM dbo.T_ParseLog GROUP BY outcome ORDER BY c DESC');
  console.log(`• total transactions: ${total}`);
  console.log('• outcome funnel:');
  for (const o of oc) console.log(`    ${o.outcome}: ${o.c} (${(o.c * 100 / total).toFixed(1)}%)`);

  // 2) brand resolution จาก merged_json (สถานะจริงหลัง match)
  const merged = await query<{ merged_json: string }>("SELECT merged_json FROM dbo.T_ParseLog WHERE merged_json IS NOT NULL");
  let items = 0, resolved = 0, needsReview = 0;
  for (const r of merged) for (const it of parseItems(r.merged_json)) {
    items++;
    if (it.brand && !it.needsReview) resolved++;
    else if (it.needsReview) needsReview++;
  }
  console.log(`\n• brand resolution (merged items): ${items} items | resolved ${resolved} (${(resolved * 100 / Math.max(1, items)).toFixed(1)}%) | needsReview ${needsReview} (${(needsReview * 100 / Math.max(1, items)).toFixed(1)}%)`);

  // 3) เก็บ "ยี่ห้อดิบที่ AI สกัด" (จาก ai_json) แล้วเช็คว่า match master ได้ไหม → master gap / matching miss
  const ai = await query<{ ai_json: string }>("SELECT ai_json FROM dbo.T_ParseLog WHERE ai_json IS NOT NULL");
  const freq = new Map<string, { sample: string; n: number }>();
  for (const r of ai) for (const it of parseItems(r.ai_json)) {
    const b = String(it.brand || '').trim();
    if (!b) continue;
    const k = norm(b);
    if (!freq.has(k)) freq.set(k, { sample: b, n: 0 });
    freq.get(k)!.n++;
  }

  const byString: string[] = [], byMeiliOnly: { raw: string; hit: string; n: number }[] = [], unmatched: { raw: string; n: number }[] = [];
  for (const { sample, n } of freq.values()) {
    const sm = matchMaster(sample, D.brands).best;            // matcher เดิม (string + alias)
    if (sm) { byString.push(sample); continue; }
    const mm = await meiliResolve(sample);                     // A2: Meili
    if (mm) byMeiliOnly.push({ raw: sample, hit: mm, n });
    else unmatched.push({ raw: sample, n });
  }
  const distinct = freq.size;
  console.log(`\n• ยี่ห้อดิบที่ AI สกัด: ${distinct} ค่า (distinct)`);
  console.log(`    resolve ด้วย string/alias เดิม: ${byString.length}`);
  console.log(`    resolve ด้วย Meili เท่านั้น (กำไรจาก A2): ${byMeiliOnly.length}`);
  console.log(`    ยังไม่ match: ${unmatched.length}`);

  byMeiliOnly.sort((a, b) => b.n - a.n);
  console.log('\n• A2 จับเพิ่ม (string เดิมพลาด → Meili ได้) [top 15]:');
  for (const x of byMeiliOnly.slice(0, 15)) console.log(`    "${x.raw}" → "${x.hit}"  (เจอ ${x.n} ครั้ง)`);

  unmatched.sort((a, b) => b.n - a.n);
  console.log('\n• ยังไม่ match เลย — เติม master หรือ matching ยังพลาด [top 20]:');
  for (const x of unmatched.slice(0, 20)) console.log(`    "${x.raw}"  (เจอ ${x.n} ครั้ง)`);

  console.log('\n=== END ===');
  process.exit(0);
}
run();

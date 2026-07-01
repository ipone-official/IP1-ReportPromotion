import 'dotenv/config';
import * as fs from 'fs';
import { loadMaster } from './src/infra/master';
import { fastParse } from './src/flow/flow-parser';
import { norm } from './src/domain/match';

/* ============================================================
   eval-goldset — วัด per-field accuracy ของ pipeline จริง (AI+match) เทียบ gold set
   รัน:  npx tsx eval-goldset.ts
   gold set: eval/goldset.jsonl  (raw + expected ต่อ field)
   ============================================================ */

function valEq(expected: any, produced: any): boolean {
  if (typeof expected === 'boolean') return produced === expected;
  if (typeof expected === 'number') return produced != null && Number(produced) === expected;
  // string: เทียบแบบตัดช่องว่าง/จุด/สัญลักษณ์ออก (ยุติธรรมกับ size เช่น "700 มล." == "700มล")
  const clean = (v: any) => String(v ?? '').toLowerCase().replace(/[^0-9a-z฀-๿]/g, '');
  return clean(produced) === clean(expected);
}

const REPORT_FIELDS = ['account', 'branch', 'company', 'startDate', 'endDate', 'observationDate'];
const ITEM_FIELDS = ['brand', 'category', 'subCategory', 'size', 'pack', 'variant', 'reportType', 'reportSubtype',
  'isCompetitor', 'priceNormal', 'pricePromo', 'discountPct', 'promoType', 'buyQty', 'freeQty', 'thresholdBaht', 'stockStatus', 'facings', 'isNpd'];

(async () => {
  await loadMaster();
  const lines = fs.readFileSync('eval/goldset.jsonl', 'utf8').split('\n').filter((l) => l.trim());
  const tally: Record<string, { c: number; t: number }> = {};
  const add = (f: string, ok: boolean) => { (tally[f] = tally[f] || { c: 0, t: 0 }).t++; if (ok) tally[f].c++; };
  let bTP = 0, bFN = 0, bFP = 0;
  const fails: string[] = [];

  for (const line of lines) {
    const g = JSON.parse(line);
    const s: any = { asked: [], current: {}, items: [], photoCount: 0, userId: 'eval', topicCode: g.topicCode };
    try { await fastParse(s, g.raw); } catch (e: any) { fails.push(`#${g.id} parse error: ${e?.message}`); }

    for (const f of REPORT_FIELDS) if (g.expected[f] != null) {
      const ok = valEq(g.expected[f], s[f]);
      add(f, ok); if (!ok) fails.push(`#${g.id} ${f}: คาด"${g.expected[f]}" ได้"${s[f] ?? '-'}"`);
    }

    const exItems = g.expected.items || [];
    const prItems = s.items || [];
    const prBrands = prItems.map((it: any) => norm(it.brand || it.rawBrand || ''));
    const exBrands = exItems.map((it: any) => norm(it.brand || ''));
    for (const ex of exItems) {
      const eb = norm(ex.brand || '');
      const pIdx = prBrands.findIndex((b: string) => b && (b === eb || b.includes(eb) || eb.includes(b)));
      if (pIdx >= 0) bTP++; else { bFN++; fails.push(`#${g.id} brand ไม่เจอ: ${ex.brand}`); }
      const pit = pIdx >= 0 ? prItems[pIdx] : {};
      for (const f of ITEM_FIELDS) if (ex[f] != null) {
        const ok = valEq(ex[f], (pit as any)[f]);
        add(f, ok); if (!ok) fails.push(`#${g.id} item.${f}(${ex.brand}): คาด"${ex[f]}" ได้"${(pit as any)[f] ?? '-'}"`);
      }
    }
    for (const pb of prBrands) if (pb && !exBrands.some((eb: string) => eb === pb || eb.includes(pb) || pb.includes(eb))) bFP++;
  }

  console.log('=== PER-FIELD ACCURACY (gold set, n=' + lines.length + ') ===');
  console.log('-- report-level --');
  for (const f of REPORT_FIELDS) { const t = tally[f]; if (t) console.log(`  ${f.padEnd(16)} ${t.c}/${t.t} (${Math.round(t.c * 100 / t.t)}%)`); }
  console.log('-- item-level --');
  for (const f of ITEM_FIELDS) { const t = tally[f]; if (t) console.log(`  ${f.padEnd(16)} ${t.c}/${t.t} (${Math.round(t.c * 100 / t.t)}%)`); }
  const prec = bTP / (bTP + bFP || 1), rec = bTP / (bTP + bFN || 1);
  console.log(`\nbrand: precision ${Math.round(prec * 100)}% | recall ${Math.round(rec * 100)}% (TP${bTP} FP${bFP} FN${bFN})`);

  console.log('\n=== ที่พลาด (สำหรับไล่แก้) ===');
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  process.exit(0);
})();

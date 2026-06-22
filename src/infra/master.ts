import { query, sqlEnabled } from './db';
import { setAliases, norm } from '../domain/match';

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
export let reportTypesByTopic: Record<string, string[]> = {};
export let subtypesByReportType: Record<string, string[]> = {};
export let aliasRows: { kind: string; alias: string; canonical: string }[] = [];

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

export function aiOptions(): string {
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
  return [
    `ยี่ห้อในระบบ (ถ้าตรงให้ใช้ชื่อนี้): ${brands.join(', ')}`,
    `บริษัทในระบบ (ตัวเลือกของช่อง company): ${companies.join(', ')}`,
    `กลุ่มสินค้า (category) และประเภทสินค้า (subCategory) ในระบบ:\n${subCatLines}`,
    `ไซส์ในระบบ (อ้างอิง — พิมพ์ต่างก็เก็บได้): ${sizes.slice(0, 30).join(', ')}${sizes.length > 30 ? '...' : ''}`,
    `แพ็คในระบบ: ${packs.join(', ')}`,
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
    const _packs = col(await query('EXEC dbo.SpGetPacks'));
    const vset = new Set<string>();
    for (const r of await query('EXEC dbo.SpGetVariants')) {
      String(r.v).split(/[\/,]/).map((x) => x.trim()).filter((x) => x && x.length <= 60).forEach((x) => vset.add(x));
    }
    const _variants = normUniq([...vset]);
    const _brands = [...new Set(Object.values(_brandsBySubCat).flat())];

    let _aliasRows: { kind: string; alias: string; canonical: string }[] = [];
    try {
      _aliasRows = (await query('EXEC dbo.SpGetMatchAlias'))
        .map((r) => ({ kind: String(r.kind || '').trim(), alias: String(r.alias || '').trim(), canonical: String(r.canonical || '').trim() }));
    } catch (e: any) {
      _aliasRows = [];
      console.warn('master: SpGetMatchAlias อ่านไม่ได้ —', e.message);
    }

    topics = _topics; reportTypesByTopic = _reportTypesByTopic; subtypesByReportType = _subtypesByReportType;
    channels = _channels; accountsByChannel = _accountsByChannel; accounts = _accounts;
    branchesByAccount = _branchesByAccount; provinceOf = _provinceOf; provinces = _provinces;
    companies = _companies; categories = _categories; subCatsByCategory = _subCatsByCategory;
    brandsBySubCat = _brandsBySubCat; sizes = _sizes; packs = _packs; variants = _variants; brands = _brands;
    aliasRows = _aliasRows;
    setAliases(aliasRows);
    ready = true;

    const nBranches = Object.values(branchesByAccount).flat().length;
    console.log(`master: โหลดจาก SQL ✅ | categories ${categories.length} | brands ${brands.length} | accounts ${accounts.length} | branches ${nBranches} | sizes ${sizes.length} | variants ${variants.length} | aliases ${aliasRows.length}`);
  } catch (e: any) {
    console.error('master: โหลดจาก SQL ไม่สำเร็จ (คงข้อมูลเดิมไว้) —', e.message);
    throw e;
  }
}


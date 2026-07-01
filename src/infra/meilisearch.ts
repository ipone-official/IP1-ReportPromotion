import * as D from './master';

// meilisearch@0.58 เป็น ESM-only แต่ tsconfig ใช้ module=CommonJS → static import หรือ
// dynamic import ธรรมดาจะถูก tsc แปลงเป็น require() แล้วพัง ERR_REQUIRE_ESM ตอนรัน dist จริง.
// ซ่อน import() ไว้ใน Function() เพื่อให้ tsc ไม่แตะ → คงเป็น native ESM dynamic import ตอนรัน.
const nativeImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

const MEILI_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY || 'masterKey123';

let client: any = null;
let enabled = false;
let initPromise: Promise<void> | null = null;

function initClient(): Promise<void> {
  if (!initPromise) {
    initPromise = nativeImport('meilisearch')
      .then((mod: any) => {
        const MeiliSearch =
          mod.MeiliSearch || mod.Meilisearch ||
          (mod.default && (mod.default.MeiliSearch || mod.default.Meilisearch)) ||
          mod.default;
        client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
        enabled = true;
      })
      .catch((e: any) => {
        enabled = false;
        console.warn('Meilisearch: client init failed — running in fallback mode:', e.message);
      });
  }
  return initPromise;
}

// เริ่ม init ทันที (ไม่ block) ให้ enabled พร้อมเร็วที่สุด
initClient();

export const meiliEnabled = () => enabled;

/**
 * Syncs the MSSQL in-memory cache arrays to Meilisearch indices.
 */
export async function syncMasterToMeilisearch(): Promise<void> {
  await initClient();
  if (!enabled || !client) return;
  try {
    // 1. Sync Stores
    const storesIndex = client.index('stores');
    await storesIndex.updateSettings({
      searchableAttributes: ['account', 'branch', 'province'],
      filterableAttributes: ['account', 'province']
    });

    const storeDocs: any[] = [];
    let idCounter = 1;
    for (const [account, branches] of Object.entries(D.branchesByAccount)) {
      if (branches.length === 0) {
        storeDocs.push({ id: `store_${idCounter++}`, account, branch: '' });
      } else {
        for (const branch of branches) {
          const province = D.provinceOf[`${account}|${branch}`] || '';
          storeDocs.push({ id: `store_${idCounter++}`, account, branch, province });
        }
      }
    }
    
    if (storeDocs.length > 0) {
      await storesIndex.addDocuments(storeDocs);
      console.log(`Meilisearch: Synced ${storeDocs.length} store records.`);
    }

    // 2. Sync Brands
    const brandsIndex = client.index('brands');
    await brandsIndex.updateSettings({
      searchableAttributes: ['brand'],
      filterableAttributes: ['brand'],
      // typo-tolerant สำหรับชื่อยี่ห้อไทยที่มักสั้น (เช่น "โมิ"→"โทมิ")
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 3, twoTypos: 7 } }
    });

    const brandDocs: any[] = [];
    let brandIdCounter = 1;
    for (const brand of D.brands) {
      brandDocs.push({ id: `brand_${brandIdCounter++}`, brand });
    }

    if (brandDocs.length > 0) {
      await brandsIndex.addDocuments(brandDocs);
      console.log(`Meilisearch: Synced ${brandDocs.length} brand records.`);
    }

  } catch (e: any) {
    console.warn('Meilisearch: Sync failed (check if container is running) —', e.message);
  }
}


export async function searchStoreMeili(q: string, limit = 5): Promise<{ account: string; branch: string; score: number }[]> {
  await initClient();
  if (!enabled || !client) return [];
  try {
    const index = client.index('stores');
    const res = await index.search(q, { limit });
    return res.hits.map((h: any) => ({
      account: h.account,
      branch: h.branch,
      score: 1 // Match found in search index
    }));
  } catch {
    return [];
  }
}


export async function searchBrandMeili(q: string, limit = 5): Promise<string[]> {
  await initClient();
  if (!enabled || !client || !q || !q.trim()) return [];
  try {
    const res = await client.index('brands').search(q.trim(), { limit });
    return res.hits.map((h: any) => h.brand).filter(Boolean);
  } catch {
    return [];
  }
}

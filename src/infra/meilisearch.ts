// @ts-ignore
import Meili = require('meilisearch');
const Meilisearch = Meili.Meilisearch;
import * as D from './master';

const MEILI_HOST = process.env.MEILI_HOST || 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY || 'masterKey123';

let client: any = null;
let enabled = false;

try {
  client = new Meilisearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
  enabled = true;
} catch (e: any) {
  console.warn('Meilisearch: client init failed — running in fallback mode:', e.message);
}

export const meiliEnabled = () => enabled;

/**
 * Syncs the MSSQL in-memory cache arrays to Meilisearch indices.
 */
export async function syncMasterToMeilisearch(): Promise<void> {
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
  if (!enabled || !client || !q || !q.trim()) return [];
  try {
    const res = await client.index('brands').search(q.trim(), { limit });
    return res.hits.map((h: any) => h.brand).filter(Boolean);
  } catch {
    return [];
  }
}

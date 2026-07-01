import sql from 'mssql';
import { envNumber } from './env';

const config: sql.config = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  port: envNumber('DB_PORT', 1433, 1),
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 20, min: 2, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000,
  requestTimeout: 20000,
};

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  if (connecting) return connecting;
  connecting = (async () => {
    const p = new sql.ConnectionPool(config);
    p.on('error', (e: any) => { console.error('SQL pool error:', e?.message || e); if (pool === p) pool = null; });
    await p.connect();
    pool = p;
    return p;
  })();
  try {
    return await connecting;
  } catch (e) {
    pool = null;
    throw e;
  } finally {
    connecting = null;
  }
}

export async function query<T = any>(q: string, params: Record<string, any> = {}): Promise<T[]> {
  const p = await getPool();
  const req = p.request();
  for (const [k, v] of Object.entries(params)) req.input(k, v);
  const res = await req.query(q);
  return res.recordset as T[];
}

export const sqlEnabled = () => !!(process.env.DB_SERVER && process.env.DB_PASSWORD);

let parseLogMutedUntil = 0; // mute ชั่วคราวเมื่อ error (ไม่ปิดถาวร) — ให้กลับมาเก็บ log เองหลัง cooldown
export function logParse(e: {
  userId?: string; raw?: string; aiJson?: any; merged?: any;
  askedFields?: string[]; outcome: string; reportId?: number;
}): void {
  if (!sqlEnabled() || Date.now() < parseLogMutedUntil) return;
  (async () => {
    const p = await getPool();
    await p.request()
      .input('line_user_id', e.userId || '')
      .input('raw_text', e.raw || null)
      .input('ai_json', e.aiJson ? JSON.stringify(e.aiJson) : null)
      .input('merged_json', e.merged ? JSON.stringify(e.merged) : null)
      .input('asked_fields', e.askedFields?.length ? e.askedFields.join(', ').slice(0, 400) : null)
      .input('outcome', e.outcome)
      .input('report_id', e.reportId ?? null)
      .execute('SpInsertParseLog');
  })().catch((err: any) => {
    parseLogMutedUntil = Date.now() + 10 * 60 * 1000; // เงียบ 10 นาทีแล้วลองใหม่ (เผื่อ DB/SP ล่มชั่วคราว)
    console.warn('T_ParseLog: บันทึกไม่ได้ (mute 10 นาที; ตาราง/SP มีครบไหม? sql/01_schema + 04_procedures) —', err?.message);
  });
}

export async function saveReport(s: any): Promise<number> {
  const p = await getPool();
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const r = await new sql.Request(tx)
      .input('line_user_id', s.userId || '')
      .input('topic', s.topicName || null)
      .input('channel', s.channel || null)
      .input('account', s.account || null)
      .input('branch', s.branch || null)
      .input('company', s.company || null)
      .input('start_date', s.startDate || null)
      .input('end_date', s.endDate || null)
      .input('observation_date', s.observationDate || null)
      .input('note', s.rawText || null)
      .input('extra', s.extra?.length ? JSON.stringify(s.extra) : null)
      .execute('SpInsertReport');
    const id = r.recordset[0].id;
    for (const it of s.items || []) {
      const targetBrand = it.brand || it.rawBrand || null;
      const targetVariant = it.variant || it.rawVariant || null;
      await new sql.Request(tx)
        .input('report_id', id)
        .input('category', it.category || null)
        .input('sub_category', it.subCategory || null)
        .input('brand', targetBrand)
        .input('size', it.size || null)
        .input('pack', it.pack || null)
        .input('variant', targetVariant)
        .input('report_type', it.reportType || null)
        .input('report_subtype', it.reportSubtype || null)
        .input('detail', it.detail || null)
        .input('item_note', it.itemNote || null)
        .input('is_npd', it.isNpd ? 1 : 0)
        .input('is_competitor', it.isCompetitor == null ? null : (it.isCompetitor ? 1 : 0))
        .input('price_normal', it.priceNormal ?? null)
        .input('price_promo', it.pricePromo ?? null)
        .input('discount_pct', it.discountPct ?? null)
        .input('promo_type', it.promoType ?? null)
        .input('buy_qty', it.buyQty ?? null)
        .input('free_qty', it.freeQty ?? null)
        .input('threshold_baht', it.thresholdBaht ?? null)
        .input('stock_status', it.stockStatus ?? null)
        .input('facings', it.facings ?? null)
        .execute('SpInsertReportItem');

      // Only insert verified products: must be a recognized brand or explicitly NPD
      // This prevents typos and unresolved rawBrand from polluting M_Product
      const isVerifiedBrand = targetBrand && !it.needsReview && (it.brand === targetBrand);
      if (isVerifiedBrand || it.isNpd) {
        const checkRes = await new sql.Request(tx)
          .input('brand', targetBrand)
          .input('sub_category', it.subCategory || null)
          .input('variant', targetVariant)
          .input('size', it.size || null)
          .input('pack', it.pack || null)
          .query(`
            SELECT TOP 1 id FROM dbo.M_Product 
            WHERE LTRIM(RTRIM(brand)) = @brand 
              AND (@sub_category IS NULL OR LTRIM(RTRIM(sub_category)) = @sub_category)
              AND (@variant IS NULL OR LTRIM(RTRIM(variant)) = @variant)
              AND (@size IS NULL OR LTRIM(RTRIM(size)) = @size)
              AND (@pack IS NULL OR LTRIM(RTRIM(pack)) = @pack)
          `);
        if (checkRes.recordset.length === 0) {
          await new sql.Request(tx)
            .input('company', s.company || '')
            .input('category', it.category || null)
            .input('sub_category', it.subCategory || null)
            .input('brand', targetBrand)
            .input('size', it.size || null)
            .input('pack', it.pack || null)
            .input('variant', targetVariant)
            .query(`
              INSERT INTO dbo.M_Product (company, category, sub_category, brand, size, pack, variant)
              VALUES (@company, @category, @sub_category, @brand, @size, @pack, @variant)
            `);
        }
      }
    }
    const { getPhoto } = await import('./photoStore');
    const fs = await import('fs');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    let lostPhotos = 0;
    for (const key of s.photoKeys || []) {
      const buf = await getPhoto(key);
      if (!buf) { lostPhotos++; continue; } // หมดอายุ/หายจาก Redis — ไม่ drop เงียบ
      const fileName = `${key}.jpg`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.promises.writeFile(filePath, buf);
      const relativePath = `uploads/${fileName}`;
      await new sql.Request(tx)
        .input('report_id', id).input('photo_data', sql.NVarChar(sql.MAX), relativePath).input('photo_type', 'image')
        .execute('SpInsertReportPhoto');
    }
    if (lostPhotos) console.warn(`saveReport: ${lostPhotos}/${(s.photoKeys || []).length} รูปหมดอายุ/หายจาก Redis (report#${id}) — บันทึกรายงานต่อโดยไม่มีรูปที่หาย`);
    await tx.commit();
    try {
      const { loadMaster } = await import('./master');
      await loadMaster();
    } catch {}
    return id;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function insertMatchAlias(kind: string, alias: string, canonical: string, note?: string): Promise<void> {
  if (!sqlEnabled()) return;
  try {
    const p = await getPool();
    await p.request()
      .input('kind', kind)
      .input('alias', alias)
      .input('canonical', canonical)
      .input('note', note || null)
      .execute('SpInsertMatchAlias');
  } catch (e: any) {
    console.warn(`insertMatchAlias: Failed to save alias (${alias} -> ${canonical}) -`, e?.message);
  }
}

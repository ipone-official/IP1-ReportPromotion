import sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT || 1433),
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

let parseLogBroken = false;
export function logParse(e: {
  userId?: string; raw?: string; aiJson?: any; merged?: any;
  askedFields?: string[]; outcome: string; reportId?: number;
}): void {
  if (!sqlEnabled() || parseLogBroken) return;
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
    parseLogBroken = true;
    console.warn('T_ParseLog: บันทึกไม่ได้ (ตาราง/SP ยังไม่มี? รัน sql/01_schema.sql + sql/04_procedures.sql) —', err?.message);
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
      .input('note', s.rawText || null)
      .input('extra', s.extra?.length ? JSON.stringify(s.extra) : null)
      .execute('SpInsertReport');
    const id = r.recordset[0].id;
    for (const it of s.items || []) {
      await new sql.Request(tx)
        .input('report_id', id)
        .input('category', it.category || null)
        .input('sub_category', it.subCategory || null)
        .input('brand', it.brand || null)
        .input('size', it.size || null)
        .input('pack', it.pack || null)
        .input('variant', it.variant || null)
        .input('report_type', it.reportType || null)
        .input('report_subtype', it.reportSubtype || null)
        .input('detail', it.detail || null)
        .input('is_npd', it.isNpd ? 1 : 0)
        .execute('SpInsertReportItem');
    }
    const { getPhoto } = await import('./photoStore');
    for (const key of s.photoKeys || []) {
      const buf = getPhoto(key);
      if (!buf) continue;
      await new sql.Request(tx)
        .input('report_id', id).input('photo_data', sql.VarBinary(sql.MAX), buf).input('photo_type', 'image')
        .execute('SpInsertReportPhoto');
    }
    await tx.commit();
    return id;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

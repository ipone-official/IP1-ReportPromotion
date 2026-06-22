import { query, sqlEnabled } from './db';

export async function loadSessionState(userId: string): Promise<string | null> {
  if (!sqlEnabled()) return null;
  try {
    const r = await query<{ state: string }>('SELECT state FROM dbo.T_BotSession WHERE line_user_id = @id', { id: userId });
    return r[0]?.state ?? null;
  } catch (e: any) { console.warn('T_BotSession load:', e.message); return null; }
}

export async function saveSessionState(userId: string, state: string): Promise<void> {
  if (!sqlEnabled()) return;
  await query(
    `UPDATE dbo.T_BotSession SET state = @state, updated_at = SYSDATETIME() WHERE line_user_id = @id;
     IF @@ROWCOUNT = 0 INSERT INTO dbo.T_BotSession (line_user_id, state) VALUES (@id, @state);`,
    { id: userId, state }
  );
}

export async function clearSessionState(userId: string): Promise<void> {
  if (!sqlEnabled()) return;
  try { await query('DELETE FROM dbo.T_BotSession WHERE line_user_id = @id', { id: userId }); } catch {}
}

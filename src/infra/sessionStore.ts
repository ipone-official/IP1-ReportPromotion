import IORedis from 'ioredis';
import { query, sqlEnabled } from './db';

const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
});
redis.on('error', () => {});

export async function loadSessionState(userId: string): Promise<string | null> {
  const key = `ai_session:${userId}`;
  try {
    const val = await redis.get(key);
    if (val !== null) {
      return val;
    }
  } catch (e: any) {
    console.warn('Redis loadSessionState error:', e.message);
  }
  if (!sqlEnabled()) return null;
  try {
    const r = await query<{ state: string }>('SELECT state FROM dbo.T_BotSession WHERE line_user_id = @id', { id: userId });
    const state = r[0]?.state ?? null;
    if (state !== null) {
      try {
        await redis.set(key, state, 'EX', 21600);
      } catch {}
    }
    return state;
  } catch (e: any) {
    console.warn('T_BotSession load:', e.message);
    return null;
  }
}

export async function saveSessionState(userId: string, state: string): Promise<void> {
  const key = `ai_session:${userId}`;
  try {
    await redis.set(key, state, 'EX', 21600);
  } catch (e: any) {
    console.warn('Redis saveSessionState error:', e.message);
  }
  if (!sqlEnabled()) return;
  try {
    await query(
      `UPDATE dbo.T_BotSession SET state = @state, updated_at = SYSDATETIME() WHERE line_user_id = @id;
       IF @@ROWCOUNT = 0 INSERT INTO dbo.T_BotSession (line_user_id, state) VALUES (@id, @state);`,
      { id: userId, state }
    );
  } catch (e: any) {
    console.warn('SQL saveSessionState error:', e.message);
  }
}

export async function clearSessionState(userId: string): Promise<void> {
  const key = `ai_session:${userId}`;
  try {
    await redis.del(key);
  } catch (e: any) {
    console.warn('Redis clearSessionState error:', e.message);
  }
  if (!sqlEnabled()) return;
  try {
    await query('DELETE FROM dbo.T_BotSession WHERE line_user_id = @id', { id: userId });
  } catch (e: any) {
    console.warn('SQL clearSessionState error:', e.message);
  }
}

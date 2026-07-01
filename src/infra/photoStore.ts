import { randomBytes } from 'crypto';
import IORedis from 'ioredis';
import sharp from 'sharp';

const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
// เก็บรูปให้นานพอครอบเวลากรอกจริง (เท่ากับ session TTL 6 ชม.) กันรูปหายก่อนกดบันทึก
const PHOTO_TTL_SEC = 21600;

export async function savePhoto(data: Buffer): Promise<string> {
  const key = randomBytes(16).toString('hex');
  let buf = data;
  try {
    buf = await sharp(data)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();
  } catch (e: any) {
    console.warn('sharp compression failed:', e.message);
  }
  await redis.set(`photo:${key}`, buf, 'EX', PHOTO_TTL_SEC);
  return key;
}

export async function getPhoto(key: string): Promise<Buffer | null> {
  const buf = await redis.getBuffer(`photo:${key}`);
  if (buf) redis.expire(`photo:${key}`, PHOTO_TTL_SEC).catch(() => {});
  return buf;
}

export async function deletePhotos(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const pipeline = redis.pipeline();
  for (const k of keys) pipeline.del(`photo:${k}`);
  await pipeline.exec();
}

let _baseUrl = '';
export function setBaseUrl(url: string) { if (url) _baseUrl = url.replace(/\/$/, ''); }
export function getBaseUrl(): string {
  if (_baseUrl) return _baseUrl;
  const env = (process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');
  return env || 'http://localhost:3000';
}

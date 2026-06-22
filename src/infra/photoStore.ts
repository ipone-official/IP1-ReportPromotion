import { randomBytes } from 'crypto';

const store = new Map<string, Buffer>();

export function savePhoto(data: Buffer): string {
  const key = randomBytes(16).toString('hex');
  store.set(key, data);
  return key;
}
export function getPhoto(key: string): Buffer | undefined { return store.get(key); }
export function deletePhotos(keys: string[]) { for (const k of keys) store.delete(k); }

let _baseUrl = '';
export function setBaseUrl(url: string) { if (url) _baseUrl = url.replace(/\/$/, ''); }
export function getBaseUrl(): string {
  if (_baseUrl) return _baseUrl;
  const env = (process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');
  return env || 'http://localhost:3000';
}

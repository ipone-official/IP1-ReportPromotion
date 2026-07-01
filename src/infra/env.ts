export function envNumber(name: string, fallback: number, min?: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  if (min != null && n < min) return fallback;
  return n;
}

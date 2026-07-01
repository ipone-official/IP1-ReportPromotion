type LogLevel = 'log' | 'warn';

function attrsText(attrs: Record<string, unknown>): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}

export function logLatency(
  label: string,
  started: number,
  attrs: Record<string, unknown> = {},
  level: LogLevel = 'log',
): void {
  const suffix = attrsText(attrs);
  console[level](`[latency] ${label} ${Date.now() - started}ms${suffix ? ` ${suffix}` : ''}`);
}

export function logSlow(label: string, started: number, thresholdMs: number, attrs: Record<string, unknown> = {}): void {
  if (Date.now() - started > thresholdMs) logLatency(label, started, attrs, 'warn');
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

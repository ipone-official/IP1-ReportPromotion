const inFlight = new Set<string>();
const lastAction = new Map<string, number>();

export async function runOnce(
  key: string,
  signature: string,
  run: () => Promise<unknown>,
  debounceMs = 2500,
): Promise<boolean> {
  const now = Date.now();
  if (inFlight.has(key)) return false;
  const sig = key + '|' + signature;
  const last = lastAction.get(sig);
  if (last !== undefined && now - last < debounceMs) return false;
  if (lastAction.size > 5000) lastAction.clear();
  lastAction.set(sig, now);
  inFlight.add(key);
  try {
    await run();
    return true;
  } finally {
    inFlight.delete(key);
  }
}

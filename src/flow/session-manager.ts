import { Session } from '../shared/types';
import { loadSessionState, saveSessionState, clearSessionState } from '../infra/sessionStore';
import { SESSION_TTL_MS } from '../shared/constants';
import { logSlow } from '../infra/timing';

export const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { current: {}, items: [], photoCount: 0, asked: [], userId: id };
    sessions.set(id, s);
  }
  s.lastSeen = Date.now();
  return s;
}

export async function loadSession(id: string): Promise<Session> {
  let s = sessions.get(id);
  if (!s) {
    const json = await loadSessionState(id);
    if (json) {
      try {
        s = JSON.parse(json) as Session;
      } catch {
        s = undefined;
      }
    }
    if (!s) {
      s = { current: {}, items: [], photoCount: 0, asked: [], userId: id };
    }
    s.userId = id;
    sessions.set(id, s);
  }
  s.lastSeen = Date.now();
  return s;
}

export async function saveSession(s: Session): Promise<void> {
  if (!s.userId) return;
  const started = Date.now();
  try {
    await saveSessionState(s.userId, JSON.stringify(s));
  } catch (e: any) {
    console.warn('saveSession:', e?.message);
  } finally {
    logSlow('saveSession', started, 1000, { user: s.userId });
  }
}

export function resetSession(s: Session) {
  s.step = undefined;
  s.awaitingText = undefined;
  s.topicCode = undefined;
  s.topicName = undefined;
  s.channel = undefined;
  s.account = undefined;
  s.branch = undefined;
  s.storeNew = undefined;
  s.company = undefined;
  s.current = {};
  s.items = [];
  s.startDate = undefined;
  s.endDate = undefined;
  s.photoCount = 0;
  s.photoKeys = [];
  s.asked = [];
  s.rawText = undefined;
  s.pendingReport = undefined;
  s.fillingMissing = false;
  s.askingMore = false;
  s.skipMore = false;
  s.skippedFields = undefined;
  s.askRounds = 0;
  s.pendingFields = undefined;
  s.storeCands = undefined;
  s.editItemIndex = undefined;
  s.editExtraIndex = undefined;
  s.editing = false;
  s.editTarget = undefined;
  s.approx = undefined;
  s.extra = undefined;
  s.savedReportId = undefined;
  s.typedStore = undefined;
  s.typedBrand = undefined;
  s.typedVariant = undefined;
  s.typedSubCategory = undefined;
  s.typedCompany = undefined;
  s.typedReportSubtype = undefined;
  s.reportSubtypeSelections = undefined;
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) {
    if ((s.lastSeen || 0) < cutoff) {
      sessions.delete(id);
      clearSessionState(id).catch(() => {});
    }
  }
}, 30 * 60 * 1000).unref();

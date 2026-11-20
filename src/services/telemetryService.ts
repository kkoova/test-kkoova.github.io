import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_ROSTER, GroupRoster } from '../data/defaultRoster';
import { TestGradeResult } from '../data/questions';

export type ViolationType =
  | 'visibility_hidden'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'context_menu'
  | 'devtools_shortcut';

export interface ViolationEvent {
  id: string;
  sessionId: string;
  studentName: string;
  group: string;
  type: ViolationType;
  label: string;
  questionNumber: number;
  timestamp: string;
  createdAtMs: number;
}

export interface StudentSession {
  id: string;
  studentName: string;
  group: string;
  status: 'in_progress' | 'violation_paused' | 'completed';
  currentQuestion: number;
  totalQuestions: number;
  answeredCount: number;
  violationsCount: number;
  violations: ViolationEvent[];
  score: number | null;
  percentage: number | null;
  gradeLabel: string | null;
  startedAtMs: number;
  updatedAtMs: number;
  completedAtMs: number | null;
  sectionBreakdown?: TestGradeResult['sectionBreakdown'];
  details?: TestGradeResult['details'];
}

export type SyncStatus = 'connecting' | 'connected' | 'permission_denied' | 'error';

const LOCAL_SESSIONS_KEY = 'godot_test_local_sessions_v1';
const LOCAL_VIOLATIONS_KEY = 'godot_test_local_violations_v1';
const LOCAL_ROSTER_KEY = 'godot_test_local_roster_v1';
const CHANNEL_NAME = 'godot_test_telemetry_v1';

let broadcastChannel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return broadcastChannel;
}

function readLocalSessions(): Record<string, StudentSession> {
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalSession(session: StudentSession) {
  try {
    const all = readLocalSessions();
    all[session.id] = session;
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(all));
    getChannel()?.postMessage({ kind: 'session_update', session });
  } catch {
    // ignore storage quota errors
  }
}

function removeLocalSession(sessionId: string) {
  try {
    const all = readLocalSessions();
    delete all[sessionId];
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(all));

    const vRaw = localStorage.getItem(LOCAL_VIOLATIONS_KEY);
    if (vRaw) {
      const vList: ViolationEvent[] = JSON.parse(vRaw);
      localStorage.setItem(
        LOCAL_VIOLATIONS_KEY,
        JSON.stringify(vList.filter((v) => v.sessionId !== sessionId))
      );
    }
    getChannel()?.postMessage({ kind: 'session_delete', sessionId });
  } catch {
    // ignore
  }
}

function readLocalViolations(): ViolationEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_VIOLATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendLocalViolation(event: ViolationEvent) {
  try {
    const list = readLocalViolations();
    const updated = [event, ...list].slice(0, 200);
    localStorage.setItem(LOCAL_VIOLATIONS_KEY, JSON.stringify(updated));
    getChannel()?.postMessage({ kind: 'violation_new', event });
  } catch {
    // ignore
  }
}

export function readLocalRoster(): GroupRoster[] {
  try {
    const raw = localStorage.getItem(LOCAL_ROSTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_ROSTER;
}

function writeLocalRoster(groups: GroupRoster[]) {
  try {
    localStorage.setItem(LOCAL_ROSTER_KEY, JSON.stringify(groups));
    getChannel()?.postMessage({ kind: 'roster_update', groups });
  } catch {
    // ignore
  }
}

export async function createOrStartSession(params: {
  studentName: string;
  group: string;
  totalQuestions: number;
}): Promise<StudentSession> {
  const now = Date.now();
  const id = `sess_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const session: StudentSession = {
    id,
    studentName: params.studentName,
    group: params.group,
    status: 'in_progress',
    currentQuestion: 1,
    totalQuestions: params.totalQuestions,
    answeredCount: 0,
    violationsCount: 0,
    violations: [],
    score: null,
    percentage: null,
    gradeLabel: null,
    startedAtMs: now,
    updatedAtMs: now,
    completedAtMs: null,
  };

  writeLocalSession(session);

  try {
    await setDoc(doc(db, 'godot_test_sessions', id), session);
  } catch (err) {
    console.warn('Firestore session write failed (local mirror active):', err);
  }

  return session;
}

export async function updateSessionProgress(
  session: StudentSession,
  patch: Partial<StudentSession>
): Promise<StudentSession> {
  const updated: StudentSession = {
    ...session,
    ...patch,
    updatedAtMs: Date.now(),
  };
  writeLocalSession(updated);

  try {
    await updateDoc(doc(db, 'godot_test_sessions', session.id), {
      ...patch,
      updatedAtMs: updated.updatedAtMs,
    });
  } catch (err) {
    console.warn('Firestore progress update failed:', err);
  }

  return updated;
}

export async function recordViolation(
  session: StudentSession,
  params: { type: ViolationType; label: string; questionNumber: number }
): Promise<{ updatedSession: StudentSession; event: ViolationEvent }> {
  const now = Date.now();
  const timeStr = new Date(now).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const event: ViolationEvent = {
    id: `viol_${now}_${Math.random().toString(36).slice(2, 7)}`,
    sessionId: session.id,
    studentName: session.studentName,
    group: session.group,
    type: params.type,
    label: params.label,
    questionNumber: params.questionNumber,
    timestamp: timeStr,
    createdAtMs: now,
  };

  const nextViolations = [event, ...session.violations];
  const updatedSession: StudentSession = {
    ...session,
    status: 'violation_paused',
    violationsCount: session.violationsCount + 1,
    violations: nextViolations,
    updatedAtMs: now,
  };

  writeLocalSession(updatedSession);
  appendLocalViolation(event);

  try {
    await Promise.all([
      updateDoc(doc(db, 'godot_test_sessions', session.id), {
        status: 'violation_paused',
        violationsCount: updatedSession.violationsCount,
        violations: nextViolations,
        updatedAtMs: now,
      }),
      setDoc(doc(db, 'godot_test_violations', event.id), event),
    ]);
  } catch (err) {
    console.warn('Firestore violation write failed:', err);
  }

  return { updatedSession, event };
}

export async function completeSession(
  session: StudentSession,
  result: TestGradeResult
): Promise<StudentSession> {
  const now = Date.now();
  const updatedSession: StudentSession = {
    ...session,
    status: 'completed',
    currentQuestion: session.totalQuestions,
    answeredCount: session.totalQuestions,
    score: result.score,
    percentage: result.percentage,
    gradeLabel: result.gradeLabel,
    completedAtMs: now,
    updatedAtMs: now,
    sectionBreakdown: result.sectionBreakdown,
    details: result.details,
  };

  writeLocalSession(updatedSession);

  try {
    await updateDoc(doc(db, 'godot_test_sessions', session.id), {
      status: 'completed',
      currentQuestion: session.totalQuestions,
      answeredCount: session.totalQuestions,
      score: result.score,
      percentage: result.percentage,
      gradeLabel: result.gradeLabel,
      completedAtMs: now,
      updatedAtMs: now,
      sectionBreakdown: result.sectionBreakdown,
      details: result.details,
    });
  } catch (err) {
    console.warn('Firestore completion write failed:', err);
  }

  return updatedSession;
}

export async function removeSession(sessionId: string): Promise<void> {
  removeLocalSession(sessionId);
  try {
    await deleteDoc(doc(db, 'godot_test_sessions', sessionId));
  } catch (err) {
    console.warn('Firestore delete session failed:', err);
  }
}

export async function saveRoster(groups: GroupRoster[]): Promise<void> {
  writeLocalRoster(groups);
  try {
    await setDoc(doc(db, 'godot_test_config', 'roster'), {
      groups,
      updatedAtMs: Date.now(),
    });
  } catch (err) {
    console.warn('Firestore roster save failed:', err);
    throw err;
  }
}

export function subscribeRoster(
  onUpdate: (groups: GroupRoster[]) => void
): () => void {
  onUpdate(readLocalRoster());

  const unsubFirestore = onSnapshot(
    doc(db, 'godot_test_config', 'roster'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.groups) && data.groups.length > 0) {
          writeLocalRoster(data.groups);
          onUpdate(data.groups);
        }
      }
    },
    (err) => {
      console.warn('Firestore roster snapshot error:', err.code);
    }
  );

  const ch = getChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (ev.data?.kind === 'roster_update' && Array.isArray(ev.data.groups)) {
      onUpdate(ev.data.groups);
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_ROSTER_KEY) {
      onUpdate(readLocalRoster());
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubFirestore();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

export function subscribeTelemetry(callbacks: {
  onSessions: (sessions: StudentSession[]) => void;
  onViolations: (violations: ViolationEvent[]) => void;
  onStatus: (status: SyncStatus) => void;
}): () => void {
  const mergeAndEmitLocal = () => {
    const localSessions = Object.values(readLocalSessions()).sort(
      (a, b) => b.updatedAtMs - a.updatedAtMs
    );
    const localViolations = readLocalViolations().sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
    callbacks.onSessions(localSessions);
    callbacks.onViolations(localViolations);
  };

  mergeAndEmitLocal();

  let firestoreSessions: StudentSession[] = [];
  let firestoreViolations: ViolationEvent[] = [];

  const emitMerged = () => {
    const sessionMap = new Map<string, StudentSession>();
    for (const s of Object.values(readLocalSessions())) {
      sessionMap.set(s.id, s);
    }
    for (const s of firestoreSessions) {
      const existing = sessionMap.get(s.id);
      if (!existing || s.updatedAtMs >= existing.updatedAtMs) {
        sessionMap.set(s.id, s);
      }
    }
    const sortedSessions = Array.from(sessionMap.values()).sort(
      (a, b) => b.updatedAtMs - a.updatedAtMs
    );
    callbacks.onSessions(sortedSessions);

    const violMap = new Map<string, ViolationEvent>();
    for (const v of readLocalViolations()) violMap.set(v.id, v);
    for (const v of firestoreViolations) violMap.set(v.id, v);
    const sortedViolations = Array.from(violMap.values())
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 150);
    callbacks.onViolations(sortedViolations);
  };

  const sessionsQuery = query(
    collection(db, 'godot_test_sessions'),
    orderBy('updatedAtMs', 'desc'),
    limit(150)
  );
  const violationsQuery = query(
    collection(db, 'godot_test_violations'),
    orderBy('createdAtMs', 'desc'),
    limit(150)
  );

  const unsubSessions = onSnapshot(
    sessionsQuery,
    (snap) => {
      callbacks.onStatus('connected');
      firestoreSessions = snap.docs.map((d) => d.data() as StudentSession);
      emitMerged();
    },
    (err) => {
      if (err.code === 'permission-denied') {
        callbacks.onStatus('permission_denied');
      } else {
        callbacks.onStatus('error');
      }
    }
  );

  const unsubViolations = onSnapshot(
    violationsQuery,
    (snap) => {
      firestoreViolations = snap.docs.map((d) => d.data() as ViolationEvent);
      emitMerged();
    },
    () => {
      // handled via sessions status
    }
  );

  const ch = getChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (
      ev.data?.kind === 'session_update' ||
      ev.data?.kind === 'session_delete' ||
      ev.data?.kind === 'violation_new'
    ) {
      emitMerged();
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_SESSIONS_KEY || ev.key === LOCAL_VIOLATIONS_KEY) {
      emitMerged();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubSessions();
    unsubViolations();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

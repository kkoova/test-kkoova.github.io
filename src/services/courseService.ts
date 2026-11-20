import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../firebase';

export interface Mission {
  id: string;
  title: string;
  subtitle: string;
  preview_img: string;
  godot_path: string;
  tutorial_url: string;
  steps: string[];
}

export interface MissionSubmission {
  id: string;
  studentName: string;
  githubUid: string;
  repository: string;
  topicId: string;
  timestampMs: number;
}

export interface FeedbackEntry {
  id: string;
  studentName: string;
  githubUid: string;
  feedback: string;
  timestampMs: number;
}

export interface GlobalTimerState {
  startTime: number;
  duration: number;
  goals: string[];
  isActive: boolean;
}

const LOCAL_SUBMISSIONS_KEY = 'mobile_godot_local_submissions_v1';
const LOCAL_FEEDBACK_KEY = 'mobile_godot_local_feedback_v1';

function readLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalArray<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export async function fetchMissions(): Promise<Mission[]> {
  const res = await fetch('./data.json');
  if (!res.ok) {
    throw new Error('Не удалось загрузить список миссий (data.json)');
  }
  const data = await res.json();
  return Array.isArray(data?.missions) ? data.missions : [];
}

function extractMillis(ts: unknown): number {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function submitMissionReport(params: {
  user: User | null;
  fallbackName?: string;
  topicId: string;
  repository: string;
}): Promise<{ ok: boolean; error?: string }> {
  const repo = params.repository.trim();
  if (!repo) {
    return { ok: false, error: 'Укажите ссылку на репозиторий GitHub.' };
  }
  if (!/^https?:\/\/.+/i.test(repo)) {
    return { ok: false, error: 'Ссылка должна начинаться с http:// или https://.' };
  }

  const uid = params.user?.uid || 'preview_student';
  const studentName = params.user?.displayName || params.fallbackName || 'Студент';

  // Check local duplicate first
  const localSubs = readLocalArray<MissionSubmission>(LOCAL_SUBMISSIONS_KEY);
  if (localSubs.some((s) => s.githubUid === uid && s.topicId === params.topicId)) {
    return { ok: false, error: 'Вы уже отправили отчёт по этой миссии.' };
  }

  if (params.user) {
    try {
      const q = query(
        collection(db, 'submissions-godot'),
        where('githubUid', '==', uid),
        where('topicId', '==', params.topicId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { ok: false, error: 'Вы уже отправили отчёт по этой миссии.' };
      }

      const docRef = await addDoc(collection(db, 'submissions-godot'), {
        studentName,
        githubUid: uid,
        repository: repo,
        topicId: params.topicId,
        timestamp: serverTimestamp(),
      });

      writeLocalArray(LOCAL_SUBMISSIONS_KEY, [
        {
          id: docRef.id,
          studentName,
          githubUid: uid,
          repository: repo,
          topicId: params.topicId,
          timestampMs: Date.now(),
        },
        ...localSubs,
      ]);
      return { ok: true };
    } catch (err) {
      console.warn('Firestore submission failed, saving locally:', err);
    }
  }

  // Fallback local mirror
  writeLocalArray(LOCAL_SUBMISSIONS_KEY, [
    {
      id: `sub_${Date.now()}`,
      studentName,
      githubUid: uid,
      repository: repo,
      topicId: params.topicId,
      timestampMs: Date.now(),
    },
    ...localSubs,
  ]);
  return { ok: true };
}

export function subscribeUserSubmissions(
  uid: string | null,
  onUpdate: (items: MissionSubmission[]) => void
): () => void {
  const effectiveUid = uid || 'preview_student';
  const emitLocal = () => {
    const local = readLocalArray<MissionSubmission>(LOCAL_SUBMISSIONS_KEY).filter(
      (s) => s.githubUid === effectiveUid
    );
    onUpdate(local);
  };
  emitLocal();

  if (!uid) return () => {};

  const q = query(collection(db, 'submissions-godot'), where('githubUid', '==', uid));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const remote: MissionSubmission[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          studentName: data.studentName || 'Студент',
          githubUid: data.githubUid || uid,
          repository: data.repository || '',
          topicId: data.topicId || '',
          timestampMs: extractMillis(data.timestamp),
        };
      });
      onUpdate(remote.sort((a, b) => b.timestampMs - a.timestampMs));
    },
    () => {
      emitLocal();
    }
  );

  return unsub;
}

export function subscribeAllSubmissions(
  onUpdate: (items: MissionSubmission[]) => void
): () => void {
  onUpdate(readLocalArray<MissionSubmission>(LOCAL_SUBMISSIONS_KEY));

  const q = query(
    collection(db, 'submissions-godot'),
    orderBy('timestamp', 'desc'),
    limit(150)
  );
  return onSnapshot(
    q,
    (snap) => {
      const remote: MissionSubmission[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          studentName: data.studentName || 'Студент',
          githubUid: data.githubUid || '',
          repository: data.repository || '',
          topicId: data.topicId || '',
          timestampMs: extractMillis(data.timestamp),
        };
      });
      onUpdate(remote);
    },
    () => {
      // keep local
    }
  );
}

export async function submitFeedback(params: {
  user: User | null;
  fallbackName?: string;
  feedback: string;
}): Promise<{ ok: boolean; error?: string }> {
  const text = params.feedback.trim();
  if (!text) {
    return { ok: false, error: 'Введите текст предложения или отзыва.' };
  }

  const uid = params.user?.uid || 'preview_student';
  const studentName = params.user?.displayName || params.fallbackName || 'Студент';

  const localFeed = readLocalArray<FeedbackEntry>(LOCAL_FEEDBACK_KEY);

  if (params.user) {
    try {
      const docRef = await addDoc(collection(db, 'feedback-godot'), {
        studentName,
        githubUid: uid,
        feedback: text,
        timestamp: serverTimestamp(),
      });
      writeLocalArray(LOCAL_FEEDBACK_KEY, [
        {
          id: docRef.id,
          studentName,
          githubUid: uid,
          feedback: text,
          timestampMs: Date.now(),
        },
        ...localFeed,
      ]);
      return { ok: true };
    } catch (err) {
      console.warn('Firestore feedback failed, saving locally:', err);
    }
  }

  writeLocalArray(LOCAL_FEEDBACK_KEY, [
    {
      id: `fb_${Date.now()}`,
      studentName,
      githubUid: uid,
      feedback: text,
      timestampMs: Date.now(),
    },
    ...localFeed,
  ]);
  return { ok: true };
}

export function subscribeAllFeedback(
  onUpdate: (items: FeedbackEntry[]) => void
): () => void {
  onUpdate(readLocalArray<FeedbackEntry>(LOCAL_FEEDBACK_KEY));

  const q = query(
    collection(db, 'feedback-godot'),
    orderBy('timestamp', 'desc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const remote: FeedbackEntry[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          studentName: data.studentName || 'Студент',
          githubUid: data.githubUid || '',
          feedback: data.feedback || '',
          timestampMs: extractMillis(data.timestamp),
        };
      });
      onUpdate(remote);
    },
    () => {
      // keep local
    }
  );
}

export function subscribeGlobalTimer(
  onUpdate: (timer: GlobalTimerState | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'system', 'timer'),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      const data = snap.data();
      onUpdate({
        startTime: Number(data.startTime) || Date.now(),
        duration: Number(data.duration) || 0,
        goals: Array.isArray(data.goals) ? data.goals : [],
        isActive: Boolean(data.isActive),
      });
    },
    () => {
      onUpdate(null);
    }
  );
}

export async function triggerGlobalTimer(minutes: number, goals: string[]): Promise<void> {
  await setDoc(doc(db, 'system', 'timer'), {
    startTime: Date.now(),
    duration: Math.max(1, minutes) * 60,
    goals,
    isActive: true,
  });
}

export async function stopGlobalTimer(): Promise<void> {
  await setDoc(doc(db, 'system', 'timer'), { isActive: false }, { merge: true });
}

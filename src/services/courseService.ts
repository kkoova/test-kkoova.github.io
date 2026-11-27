import {
  addDoc,
  collection,
  deleteDoc,
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

export interface LessonTreeNode {
  name: string;
  type: string;
  level: number;
}

export type LessonItem =
  | { type: 'text'; val: string }
  | { type: 'button'; text: string; url: string }
  | { type: 'config'; data: [string, string][] }
  | { type: 'tip'; val: string }
  | { type: 'instruction'; val: string }
  | { type: 'timer'; minutes: number; goals: string[] }
  | { type: 'grid'; items: string[] }
  | { type: 'tree'; nodes: LessonTreeNode[] }
  | { type: 'code'; title?: string; code: string }
  | { type: 'image'; url: string; caption?: string };

export interface LessonPhase {
  id: string;
  label: string;
  header: string;
  items: LessonItem[];
}

export interface LessonData {
  unit: string;
  title: string;
  phases: LessonPhase[];
}

export interface MissionSubmission {
  id: string;
  studentName: string;
  githubUid: string;
  repository: string;
  topicId: string;
  timestampMs: number;
}

export interface BonusSubmission {
  id: string;
  studentName: string;
  group: string;
  kind: 'quiz' | 'project';
  score?: number;
  total?: number;
  percentage?: number;
  gradeLabel: string;
  repoLink?: string;
  note?: string;
  timestampMs: number;
}

export interface BonusConfig {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  showQuiz: boolean;
  quizTabLabel: string;
  showProject: boolean;
  projectTabLabel: string;
  projectBadge: string;
  projectTitle: string;
  projectSubtitle: string;
  projectRequirements: string[];
  showResultsToStudents: boolean;
}

export const DEFAULT_BONUS_CONFIG: BonusConfig = {
  heroBadge: 'Дополнительное задание на оценку',
  heroTitle: 'Заработать дополнительную «5» или закрыть долг',
  heroSubtitle:
    'Выберите формат: быстрый код-челлендж по Godot 4 прямо в браузере (автопроверка) или практическая доработка любой игры эффектами Game Feel. Результат сразу попадает преподавателю.',
  showQuiz: true,
  quizTabLabel: 'Код-челлендж (5 задач)',
  showProject: true,
  projectTabLabel: 'ТЗ на GitHub (Game Feel)',
  projectBadge: 'Практическое ТЗ · Бонус-оценка «5»',
  projectTitle: 'Миссия «Game Feel & Juice Pack» для любой вашей игры',
  projectSubtitle:
    'Возьмите любой свой проект из курса (Лабиринт, Кликер, Тетрис или Рыбалку) и добавьте 4 элемента «сочности» игры:',
  projectRequirements: [
    '1. Плавный отклик UI через create_tween() (пружинка при нажатии кнопок или появлении окна).',
    '2. Эффект тряски камеры (Camera Shake) или вспышки при важном событии / столкновении.',
    '3. Частицы (GPUParticles2D или CPUParticles2D) + минимум 2 звуковых эффекта через AudioStreamPlayer.',
    '4. Сохранение лучшего результата в user:// через ConfigFile или JSON, чтобы рекорд не сбрасывался после перезапуска.',
  ],
  showResultsToStudents: true,
};

export interface WheelSpinRecord {
  id: string;
  uid: string;
  userName: string;
  labName: string;
  tierId: string;
  tierLabel: string;
  won: boolean;
  outcomeText: string;
  dateKey: string;
  timestampMs: number;
}

export const DAILY_SPIN_LIMIT = 3;

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
const LOCAL_MISSIONS_KEY = 'mobile_godot_custom_missions_v1';
const LOCAL_DOCS_KEY = 'mobile_godot_custom_docs_v1';
const LOCAL_BONUS_KEY = 'mobile_godot_bonus_submissions_v1';
const LOCAL_BONUS_CONFIG_KEY = 'mobile_godot_bonus_config_v1';
const LOCAL_WHEEL_SPINS_KEY = 'mobile_godot_wheel_spins_v1';
const COURSE_CHANNEL_NAME = 'mobile_godot_course_sync_v1';

let courseChannel: BroadcastChannel | null = null;
function getCourseChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!courseChannel) {
    courseChannel = new BroadcastChannel(COURSE_CHANNEL_NAME);
  }
  return courseChannel;
}

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

export function readLocalMissions(): Mission[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_MISSIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalMissions(missions: Mission[] | null) {
  try {
    if (missions === null) {
      localStorage.removeItem(LOCAL_MISSIONS_KEY);
    } else {
      localStorage.setItem(LOCAL_MISSIONS_KEY, JSON.stringify(missions));
    }
    getCourseChannel()?.postMessage({ kind: 'missions_update', missions });
  } catch {
    // ignore
  }
}

export function readLocalCustomDocs(): Record<string, LessonData> {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCustomDocs(docs: Record<string, LessonData>) {
  try {
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs));
    getCourseChannel()?.postMessage({ kind: 'docs_update', docs });
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

export function subscribeMissions(
  onUpdate: (missions: Mission[]) => void,
  onError?: (errMsg: string) => void
): () => void {
  let defaultMissions: Mission[] = [];
  let hasOverride = false;

  const localOverride = readLocalMissions();
  if (localOverride) {
    hasOverride = true;
    onUpdate(localOverride);
  }

  fetchMissions()
    .then((list) => {
      defaultMissions = list;
      if (!hasOverride && !readLocalMissions()) {
        onUpdate(list);
      }
    })
    .catch((err: Error) => {
      if (!hasOverride && onError) {
        onError(err.message);
      }
    });

  const unsubFirestore = onSnapshot(
    doc(db, 'godot_test_config', 'missions'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data?.missionsJson === 'string') {
          try {
            const parsed = JSON.parse(data.missionsJson);
            if (Array.isArray(parsed)) {
              hasOverride = true;
              writeLocalMissions(parsed);
              onUpdate(parsed);
              return;
            }
          } catch {
            // ignore
          }
        }
      }
    },
    () => {
      // keep local / default
    }
  );

  const ch = getCourseChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (ev.data?.kind === 'missions_update') {
      if (Array.isArray(ev.data.missions)) {
        hasOverride = true;
        onUpdate(ev.data.missions);
      } else if (ev.data.missions === null && defaultMissions.length > 0) {
        hasOverride = false;
        onUpdate(defaultMissions);
      }
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_MISSIONS_KEY) {
      const m = readLocalMissions();
      if (m) {
        hasOverride = true;
        onUpdate(m);
      } else if (defaultMissions.length > 0) {
        hasOverride = false;
        onUpdate(defaultMissions);
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubFirestore();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function saveMissions(missions: Mission[]): Promise<void> {
  writeLocalMissions(missions);
  await setDoc(doc(db, 'godot_test_config', 'missions'), {
    missionsJson: JSON.stringify(missions),
    updatedAtMs: Date.now(),
  });
}

export async function resetMissionsToDefault(): Promise<Mission[]> {
  const defaults = await fetchMissions();
  writeLocalMissions(null);
  try {
    await deleteDoc(doc(db, 'godot_test_config', 'missions'));
  } catch {
    // ignore if rules block delete; fallback overwrite with defaults
    await setDoc(doc(db, 'godot_test_config', 'missions'), {
      missionsJson: JSON.stringify(defaults),
      updatedAtMs: Date.now(),
    }).catch(() => {});
  }
  return defaults;
}

export function subscribeCustomDocs(
  onUpdate: (docs: Record<string, LessonData>) => void
): () => void {
  onUpdate(readLocalCustomDocs());

  const unsubFirestore = onSnapshot(
    doc(db, 'godot_test_config', 'lesson_docs'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data?.docsJson === 'string') {
          try {
            const parsed = JSON.parse(data.docsJson);
            if (parsed && typeof parsed === 'object') {
              writeLocalCustomDocs(parsed);
              onUpdate(parsed);
            }
          } catch {
            // ignore
          }
        }
      }
    },
    () => {
      // keep local
    }
  );

  const ch = getCourseChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (ev.data?.kind === 'docs_update' && ev.data.docs) {
      onUpdate(ev.data.docs);
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_DOCS_KEY) {
      onUpdate(readLocalCustomDocs());
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubFirestore();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function saveCustomDoc(docName: string, lesson: LessonData): Promise<void> {
  const current = readLocalCustomDocs();
  const next = { ...current, [docName]: lesson };
  writeLocalCustomDocs(next);
  await setDoc(doc(db, 'godot_test_config', 'lesson_docs'), {
    docsJson: JSON.stringify(next),
    updatedAtMs: Date.now(),
  });
}

export async function deleteCustomDoc(docName: string): Promise<void> {
  const current = readLocalCustomDocs();
  const next = { ...current };
  delete next[docName];
  writeLocalCustomDocs(next);
  await setDoc(doc(db, 'godot_test_config', 'lesson_docs'), {
    docsJson: JSON.stringify(next),
    updatedAtMs: Date.now(),
  });
}

export async function fetchLessonDoc(docName: string): Promise<LessonData> {
  const customDocs = readLocalCustomDocs();
  if (customDocs[docName]) {
    return customDocs[docName];
  }
  const res = await fetch(`./assets/docs/${docName}`);
  if (!res.ok) {
    throw new Error(`Методичка «${docName}» не найдена`);
  }
  return res.json();
}

function extractMillis(ts: unknown): number {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function submitBonusAssignment(
  entry: Omit<BonusSubmission, 'id' | 'timestampMs'>
): Promise<BonusSubmission> {
  const record: BonusSubmission = {
    ...entry,
    id: `bonus_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestampMs: Date.now(),
  };

  const local = readLocalArray<BonusSubmission>(LOCAL_BONUS_KEY);
  const nextLocal = [record, ...local].slice(0, 150);
  writeLocalArray(LOCAL_BONUS_KEY, nextLocal);
  getCourseChannel()?.postMessage({ kind: 'bonus_update', items: nextLocal });

  try {
    await setDoc(doc(db, 'godot_bonus_submissions', record.id), record);
  } catch (err) {
    console.warn('Firestore bonus submission failed, saved locally:', err);
  }

  return record;
}

export function subscribeBonusSubmissions(
  onUpdate: (items: BonusSubmission[]) => void
): () => void {
  onUpdate(readLocalArray<BonusSubmission>(LOCAL_BONUS_KEY));

  const q = query(
    collection(db, 'godot_bonus_submissions'),
    orderBy('timestampMs', 'desc'),
    limit(150)
  );
  const unsubFirestore = onSnapshot(
    q,
    (snap) => {
      const remote = snap.docs.map((d) => d.data() as BonusSubmission);
      const map = new Map<string, BonusSubmission>();
      for (const l of readLocalArray<BonusSubmission>(LOCAL_BONUS_KEY)) map.set(l.id, l);
      for (const r of remote) map.set(r.id, r);
      const merged = Array.from(map.values()).sort((a, b) => b.timestampMs - a.timestampMs);
      onUpdate(merged);
    },
    () => {
      onUpdate(readLocalArray<BonusSubmission>(LOCAL_BONUS_KEY));
    }
  );

  const ch = getCourseChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (ev.data?.kind === 'bonus_update' && Array.isArray(ev.data.items)) {
      onUpdate(ev.data.items);
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_BONUS_KEY) {
      onUpdate(readLocalArray<BonusSubmission>(LOCAL_BONUS_KEY));
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubFirestore();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function deleteBonusSubmission(id: string): Promise<void> {
  const local = readLocalArray<BonusSubmission>(LOCAL_BONUS_KEY).filter((x) => x.id !== id);
  writeLocalArray(LOCAL_BONUS_KEY, local);
  getCourseChannel()?.postMessage({ kind: 'bonus_update', items: local });
  try {
    await deleteDoc(doc(db, 'godot_bonus_submissions', id));
  } catch {
    // ignore
  }
}

export function readLocalBonusConfig(): BonusConfig {
  try {
    const raw = localStorage.getItem(LOCAL_BONUS_CONFIG_KEY);
    if (!raw) return DEFAULT_BONUS_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_BONUS_CONFIG,
      ...parsed,
      projectRequirements: Array.isArray(parsed?.projectRequirements)
        ? parsed.projectRequirements
        : DEFAULT_BONUS_CONFIG.projectRequirements,
    };
  } catch {
    return DEFAULT_BONUS_CONFIG;
  }
}

function writeLocalBonusConfig(cfg: BonusConfig) {
  try {
    localStorage.setItem(LOCAL_BONUS_CONFIG_KEY, JSON.stringify(cfg));
    getCourseChannel()?.postMessage({ kind: 'bonus_config_update', config: cfg });
  } catch {
    // ignore
  }
}

export async function saveBonusConfig(cfg: BonusConfig): Promise<void> {
  writeLocalBonusConfig(cfg);
  await setDoc(doc(db, 'godot_test_config', 'bonus_config'), {
    configJson: JSON.stringify(cfg),
    updatedAtMs: Date.now(),
  });
}

export function subscribeBonusConfig(
  onUpdate: (cfg: BonusConfig) => void
): () => void {
  onUpdate(readLocalBonusConfig());

  const unsubFirestore = onSnapshot(
    doc(db, 'godot_test_config', 'bonus_config'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data?.configJson === 'string') {
          try {
            const parsed = JSON.parse(data.configJson);
            const merged: BonusConfig = {
              ...DEFAULT_BONUS_CONFIG,
              ...parsed,
              projectRequirements: Array.isArray(parsed?.projectRequirements)
                ? parsed.projectRequirements
                : DEFAULT_BONUS_CONFIG.projectRequirements,
            };
            writeLocalBonusConfig(merged);
            onUpdate(merged);
          } catch {
            // ignore
          }
        }
      }
    },
    () => {
      // keep local
    }
  );

  const ch = getCourseChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (ev.data?.kind === 'bonus_config_update' && ev.data.config) {
      onUpdate(ev.data.config);
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_BONUS_CONFIG_KEY) {
      onUpdate(readLocalBonusConfig());
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubFirestore();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function recordWheelSpin(
  entry: Omit<WheelSpinRecord, 'id' | 'dateKey' | 'timestampMs'>
): Promise<WheelSpinRecord> {
  const record: WheelSpinRecord = {
    ...entry,
    id: `spin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dateKey: getTodayDateKey(),
    timestampMs: Date.now(),
  };

  const local = readLocalArray<WheelSpinRecord>(LOCAL_WHEEL_SPINS_KEY);
  const nextLocal = [record, ...local].slice(0, 300);
  writeLocalArray(LOCAL_WHEEL_SPINS_KEY, nextLocal);
  getCourseChannel()?.postMessage({ kind: 'wheel_spins_update', items: nextLocal });

  try {
    await setDoc(doc(db, 'godot_wheel_spins', record.id), record);
  } catch (err) {
    console.warn('Firestore wheel spin save failed, saved locally:', err);
  }

  return record;
}

export function subscribeWheelSpins(
  onUpdate: (items: WheelSpinRecord[]) => void
): () => void {
  onUpdate(readLocalArray<WheelSpinRecord>(LOCAL_WHEEL_SPINS_KEY));

  const q = query(
    collection(db, 'godot_wheel_spins'),
    orderBy('timestampMs', 'desc'),
    limit(200)
  );
  const unsubFirestore = onSnapshot(
    q,
    (snap) => {
      const remote = snap.docs.map((d) => d.data() as WheelSpinRecord);
      const map = new Map<string, WheelSpinRecord>();
      for (const l of readLocalArray<WheelSpinRecord>(LOCAL_WHEEL_SPINS_KEY)) map.set(l.id, l);
      for (const r of remote) map.set(r.id, r);
      const merged = Array.from(map.values()).sort((a, b) => b.timestampMs - a.timestampMs);
      onUpdate(merged);
    },
    () => {
      onUpdate(readLocalArray<WheelSpinRecord>(LOCAL_WHEEL_SPINS_KEY));
    }
  );

  const ch = getCourseChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (ev.data?.kind === 'wheel_spins_update' && Array.isArray(ev.data.items)) {
      onUpdate(ev.data.items);
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_WHEEL_SPINS_KEY) {
      onUpdate(readLocalArray<WheelSpinRecord>(LOCAL_WHEEL_SPINS_KEY));
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubFirestore();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
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


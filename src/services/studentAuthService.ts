import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface StudentAccount {
  id: string;
  group: string;
  studentName: string;
  passwordHash: string;
  salt: string;
  createdAtMs: number;
  lastLoginAtMs: number;
}

export interface StudentSessionUser {
  id: string;
  group: string;
  studentName: string;
}

const LOCAL_ACCOUNTS_KEY = 'mobile_godot_student_accounts_v1';
const LOCAL_CURRENT_STUDENT_KEY = 'mobile_godot_current_student_v1';
const STUDENT_AUTH_CHANNEL = 'mobile_godot_student_auth_v1';

let authChannel: BroadcastChannel | null = null;
function getAuthChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!authChannel) {
    authChannel = new BroadcastChannel(STUDENT_AUTH_CHANNEL);
  }
  return authChannel;
}

export function makeStudentAccountId(group: string, studentName: string): string {
  const raw = `${group.trim()}::${studentName.trim()}`;
  const bytes = new TextEncoder().encode(raw);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `stu_${hex}`;
}

function readLocalAccounts(): Record<string, StudentAccount> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalAccounts(map: Record<string, StudentAccount>) {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(map));
    getAuthChannel()?.postMessage({ kind: 'accounts_update', accounts: map });
  } catch {
    // ignore
  }
}

export function readLocalStudentSession(): StudentSessionUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_CURRENT_STUDENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === 'string' &&
      typeof parsed.group === 'string' &&
      typeof parsed.studentName === 'string'
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveLocalStudentSession(user: StudentSessionUser | null) {
  try {
    if (!user) {
      localStorage.removeItem(LOCAL_CURRENT_STUDENT_KEY);
    } else {
      localStorage.setItem(LOCAL_CURRENT_STUDENT_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore
  }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}:${password}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash for non-HTTPS local preview if subtle is unavailable
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint8Array(12);
    window.crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function subscribeStudentAccounts(
  onUpdate: (accounts: Record<string, StudentAccount>) => void
): () => void {
  onUpdate(readLocalAccounts());

  const unsubFirestore = onSnapshot(
    collection(db, 'godot_student_accounts'),
    (snap) => {
      const local = readLocalAccounts();
      const merged: Record<string, StudentAccount> = { ...local };
      snap.docs.forEach((d) => {
        const data = d.data() as StudentAccount;
        if (data?.id) {
          merged[data.id] = data;
        }
      });
      writeLocalAccounts(merged);
      onUpdate(merged);
    },
    () => {
      onUpdate(readLocalAccounts());
    }
  );

  const ch = getAuthChannel();
  const handleChannel = (ev: MessageEvent) => {
    if (ev.data?.kind === 'accounts_update' && ev.data.accounts) {
      onUpdate(ev.data.accounts);
    }
  };
  ch?.addEventListener('message', handleChannel);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === LOCAL_ACCOUNTS_KEY) {
      onUpdate(readLocalAccounts());
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    unsubFirestore();
    ch?.removeEventListener('message', handleChannel);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function loginOrRegisterStudent(params: {
  group: string;
  studentName: string;
  password: string;
  confirmPassword?: string;
  cachedAccounts: Record<string, StudentAccount>;
}): Promise<{
  ok: boolean;
  isNew?: boolean;
  session?: StudentSessionUser;
  error?: string;
}> {
  const group = params.group.trim();
  const studentName = params.studentName.trim();
  const password = params.password;

  if (!group || !studentName) {
    return { ok: false, error: 'Выберите вашу группу и ФИО из списка.' };
  }
  if (!password || password.length < 4) {
    return { ok: false, error: 'Пароль должен содержать минимум 4 символа.' };
  }

  const accountId = makeStudentAccountId(group, studentName);
  let existing: StudentAccount | null = params.cachedAccounts[accountId] || null;

  // Always verify directly against Firestore to prevent claiming an already-registered student
  try {
    const snap = await getDoc(doc(db, 'godot_student_accounts', accountId));
    if (snap.exists()) {
      existing = snap.data() as StudentAccount;
    }
  } catch {
    // fallback to cached/local
  }

  if (existing) {
    const candidateHash = await hashPassword(password, existing.salt);
    if (candidateHash !== existing.passwordHash) {
      return {
        ok: false,
        error:
          'Неверный пароль. Это ФИО уже занято и защищено паролем владельца.',
      };
    }

    const updated: StudentAccount = {
      ...existing,
      lastLoginAtMs: Date.now(),
    };
    const localMap = readLocalAccounts();
    localMap[accountId] = updated;
    writeLocalAccounts(localMap);

    try {
      await setDoc(doc(db, 'godot_student_accounts', accountId), updated, {
        merge: true,
      });
    } catch {
      // ignore if offline
    }

    const session: StudentSessionUser = { id: accountId, group, studentName };
    saveLocalStudentSession(session);
    return { ok: true, isNew: false, session };
  }

  // First-time registration for this student
  if (
    params.confirmPassword !== undefined &&
    params.confirmPassword !== password
  ) {
    return { ok: false, error: 'Пароли не совпадают.' };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const now = Date.now();

  const newAccount: StudentAccount = {
    id: accountId,
    group,
    studentName,
    passwordHash,
    salt,
    createdAtMs: now,
    lastLoginAtMs: now,
  };

  const localMap = readLocalAccounts();
  localMap[accountId] = newAccount;
  writeLocalAccounts(localMap);

  try {
    await setDoc(doc(db, 'godot_student_accounts', accountId), newAccount);
  } catch (err) {
    console.warn('Firestore student account save failed, saved locally:', err);
  }

  const session: StudentSessionUser = { id: accountId, group, studentName };
  saveLocalStudentSession(session);
  return { ok: true, isNew: true, session };
}

export async function resetStudentAccountPassword(accountId: string): Promise<void> {
  const localMap = readLocalAccounts();
  delete localMap[accountId];
  writeLocalAccounts(localMap);

  try {
    await deleteDoc(doc(db, 'godot_student_accounts', accountId));
  } catch {
    // ignore
  }
}

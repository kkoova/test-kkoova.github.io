import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { AlertTriangle, ChevronRight, Lock, LogIn, Shield } from 'lucide-react';
import { ADMIN_UID, auth, githubProvider } from './firebase';
import { GroupRoster } from './data/defaultRoster';
import {
  gradeTest,
  QUESTIONS,
  TestGradeResult,
  UserAnswerValue,
} from './data/questions';
import {
  completeSession,
  createOrStartSession,
  readLocalRoster,
  recordViolation,
  StudentSession,
  subscribeRoster,
  subscribeTelemetry,
  SyncStatus,
  updateSessionProgress,
  ViolationEvent,
  ViolationType,
} from './services/telemetryService';
import { StartScreen } from './components/StartScreen';
import { isQuestionAnswered, QuestionRenderer } from './components/QuestionRenderer';
import { FinalResultsView } from './components/FinalResultsView';
import { AdminDashboard } from './components/AdminDashboard';
import { SecondScreenMonitor } from './components/SecondScreenMonitor';

type AppPhase = 'start' | 'active' | 'completed' | 'admin' | 'monitor';

const PREVIEW_ADMIN_KEY = 'godot_test_preview_admin';

export default function App() {
  const isStandaloneMonitorUrl = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('view') === 'monitor';
  }, []);

  const [phase, setPhase] = useState<AppPhase>(isStandaloneMonitorUrl ? 'monitor' : 'start');

  // Firebase Auth & Admin state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [previewAdmin, setPreviewAdmin] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PREVIEW_ADMIN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAdmin = firebaseUser?.uid === ADMIN_UID || previewAdmin;
  const adminLabel =
    firebaseUser?.displayName ||
    firebaseUser?.email ||
    (previewAdmin ? 'Режим предпросмотра' : 'Преподаватель');

  // Roster state
  const [roster, setRoster] = useState<GroupRoster[]>(() => readLocalRoster());

  // Telemetry state (for Admin & 2nd Screen)
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [violationsFeed, setViolationsFeed] = useState<ViolationEvent[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');

  // Active student test state
  const [activeSession, setActiveSession] = useState<StudentSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, UserAnswerValue>>({});
  const [gradeResult, setGradeResult] = useState<TestGradeResult | null>(null);

  // Anti-cheat overlay state
  const [warningModal, setWarningModal] = useState<{
    open: boolean;
    reason: string;
    count: number;
  }>({ open: false, reason: '', count: 0 });

  const activeSessionRef = useRef<StudentSession | null>(null);
  const currentIdxRef = useRef<number>(0);
  const lastViolationMsRef = useRef<number>(0);
  const enteredFullscreenRef = useRef<boolean>(false);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  // Listen to Firebase Auth state (automatically detects ADMIN_UID from main.js login)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsub();
  }, []);

  // Subscribe to student roster
  useEffect(() => {
    const unsub = subscribeRoster((groups) => {
      setRoster(groups);
    });
    return () => unsub();
  }, []);

  // Subscribe to real-time telemetry when Admin or Monitor is active
  useEffect(() => {
    if (!isAdmin && phase !== 'admin' && phase !== 'monitor') return;
    const unsub = subscribeTelemetry({
      onSessions: setSessions,
      onViolations: setViolationsFeed,
      onStatus: setSyncStatus,
    });
    return () => unsub();
  }, [isAdmin, phase]);

  const handleAdminGitHubSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, githubProvider);
      if (cred.user.uid !== ADMIN_UID) {
        await signOut(auth);
        setAuthError(
          `Аккаунт ${cred.user.email || cred.user.uid} не имеет прав администратора (UID не совпадает с ADMIN_UID).`
        );
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed') {
        setAuthError(
          'Этот домен не добавлен в Authorized Domains проекта Firebase (it-course-lele). На kkoova.github.io вход работает штатно, а для тестирования здесь можно включить режим предпросмотра.'
        );
      } else if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        setAuthError(
          'Окно входа было закрыто или заблокировано браузером. Вы можете повторить попытку или открыть режим предпросмотра.'
        );
      } else {
        setAuthError(`Ошибка авторизации: ${(err as Error)?.message || 'неизвестная ошибка'}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminPreviewFallback = () => {
    try {
      localStorage.setItem(PREVIEW_ADMIN_KEY, '1');
    } catch {
      // ignore
    }
    setPreviewAdmin(true);
    setAuthError(null);
    if (phase === 'start') {
      setPhase('admin');
    }
  };

  const handleAdminSignOut = async () => {
    try {
      localStorage.removeItem(PREVIEW_ADMIN_KEY);
    } catch {
      // ignore
    }
    setPreviewAdmin(false);
    if (firebaseUser) {
      await signOut(auth).catch(() => {});
    }
    setPhase('start');
  };

  // Violation handler
  const triggerViolation = useCallback(async (type: ViolationType, label: string) => {
    const sess = activeSessionRef.current;
    if (!sess) return;

    const now = Date.now();
    // Debounce to prevent blur + visibilitychange double counting the same switch
    if (now - lastViolationMsRef.current < 900) return;
    lastViolationMsRef.current = now;

    const qNum = currentIdxRef.current + 1;
    const { updatedSession } = await recordViolation(sess, {
      type,
      label,
      questionNumber: qNum,
    });
    activeSessionRef.current = updatedSession;
    setActiveSession(updatedSession);
    setWarningModal({
      open: true,
      reason: label,
      count: updatedSession.violationsCount,
    });
  }, []);

  // Anti-Cheat listeners active ONLY during 'active' test phase
  useEffect(() => {
    if (phase !== 'active') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('visibility_hidden', 'Переключение вкладки или сворачивание браузера');
      }
    };

    const handleBlur = () => {
      window.setTimeout(() => {
        if (!document.hasFocus() && activeSessionRef.current) {
          triggerViolation('window_blur', 'Потеря фокуса: переход в другое окно или программу');
        }
      }, 120);
    };

    const handleFullscreenChange = () => {
      if (enteredFullscreenRef.current && !document.fullscreenElement && activeSessionRef.current) {
        triggerViolation('fullscreen_exit', 'Выход из полноэкранного режима');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [phase, triggerViolation]);

  const handleStartTest = async ({ group, studentName }: { group: string; studentName: string }) => {
    enteredFullscreenRef.current = false;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        enteredFullscreenRef.current = Boolean(document.fullscreenElement);
      }
    } catch {
      // Fullscreen may be restricted inside embedded iframes; focus & visibility checks still run
      enteredFullscreenRef.current = false;
    }

    const session = await createOrStartSession({
      studentName,
      group,
      totalQuestions: QUESTIONS.length,
    });

    setActiveSession(session);
    activeSessionRef.current = session;
    setCurrentIdx(0);
    setAnswers({});
    setGradeResult(null);
    setWarningModal({ open: false, reason: '', count: 0 });
    setPhase('active');
  };

  const handleResumeAfterWarning = async () => {
    setWarningModal((prev) => ({ ...prev, open: false }));
    if (enteredFullscreenRef.current && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // ignore if blocked
      }
    }
    if (activeSessionRef.current) {
      const updated = await updateSessionProgress(activeSessionRef.current, {
        status: 'in_progress',
      });
      setActiveSession(updated);
      activeSessionRef.current = updated;
    }
  };

  const handleAnswerChange = (val: UserAnswerValue | undefined) => {
    const q = QUESTIONS[currentIdx];
    setAnswers((prev) => {
      const next = { ...prev };
      if (val === undefined) {
        delete next[q.id];
      } else {
        next[q.id] = val;
      }
      return next;
    });
  };

  const handleNextOrFinish = async () => {
    const q = QUESTIONS[currentIdx];
    if (!isQuestionAnswered(q, answers[q.id])) return;

    const answeredCount = Object.keys(answers).length;

    if (currentIdx < QUESTIONS.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      if (activeSessionRef.current) {
        const updated = await updateSessionProgress(activeSessionRef.current, {
          currentQuestion: nextIdx + 1,
          answeredCount,
        });
        setActiveSession(updated);
        activeSessionRef.current = updated;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Final check and grading
      const result = gradeTest(QUESTIONS, answers);
      setGradeResult(result);

      if (activeSessionRef.current) {
        const finished = await completeSession(activeSessionRef.current, result);
        setActiveSession(finished);
        activeSessionRef.current = finished;
      }

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setPhase('completed');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const groupNames = useMemo(() => roster.map((g) => g.name), [roster]);

  // 1. Standalone 2nd Screen URL (?view=monitor)
  if (phase === 'monitor') {
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-[#0F141A] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[#2A3744] bg-[#161E27] p-7 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-lg bg-[#213124] border border-[#5D8247] flex items-center justify-center text-[#9ED164]">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white">Доступ к 2-му экрану</h1>
            <p className="text-xs text-[#9FB0C0] leading-relaxed">
              Экран мониторинга статистики и нарушений доступен только преподавателю (UID администратора).
            </p>
            {authError && (
              <div className="p-3 rounded-lg bg-[#251E15] border border-[#E5A454]/40 text-xs text-[#F3D3A7] space-y-2 text-left">
                <p>{authError}</p>
                <button
                  type="button"
                  onClick={handleAdminPreviewFallback}
                  className="px-3 py-1.5 rounded bg-[#E5A454] text-[#1A140C] font-semibold cursor-pointer"
                >
                  Открыть предпросмотр монитора
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={authLoading}
              onClick={handleAdminGitHubSignIn}
              className="w-full py-3 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'Вход...' : 'Войти через GitHub'}</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <SecondScreenMonitor
        sessions={sessions}
        violations={violationsFeed}
        syncStatus={syncStatus}
        groups={groupNames}
        isStandaloneWindow={isStandaloneMonitorUrl}
        onExit={isStandaloneMonitorUrl ? undefined : () => setPhase('admin')}
      />
    );
  }

  // 2. Admin Panel
  if (phase === 'admin' && isAdmin) {
    return (
      <AdminDashboard
        sessions={sessions}
        violations={violationsFeed}
        syncStatus={syncStatus}
        roster={roster}
        adminLabel={adminLabel}
        onBackToStart={() => setPhase('start')}
        onOpenSecondScreenInPlace={() => setPhase('monitor')}
      />
    );
  }

  // 3. Final Graded Results View
  if (phase === 'completed' && gradeResult && activeSession) {
    return (
      <FinalResultsView
        studentName={activeSession.studentName}
        group={activeSession.group}
        violationsCount={activeSession.violationsCount}
        result={gradeResult}
        onExitToHome={() => {
          setActiveSession(null);
          activeSessionRef.current = null;
          setPhase('start');
        }}
      />
    );
  }

  // 4. Start Screen (Group & Student Dropdowns)
  if (phase === 'start' || !activeSession) {
    return (
      <StartScreen
        roster={roster}
        totalQuestions={QUESTIONS.length}
        isAdmin={isAdmin}
        adminEmailOrName={adminLabel}
        authLoading={authLoading}
        authError={authError}
        onAdminGitHubSignIn={handleAdminGitHubSignIn}
        onAdminPreviewFallback={handleAdminPreviewFallback}
        onAdminSignOut={handleAdminSignOut}
        onOpenAdminPanel={() => setPhase('admin')}
        onStartTest={handleStartTest}
      />
    );
  }

  // 5. Active Student Testing Session
  const currentQuestion = QUESTIONS[currentIdx];
  const currentValue = answers[currentQuestion.id];
  const canContinue = isQuestionAnswered(currentQuestion, currentValue);
  const progressPct = Math.round(((currentIdx + 1) / QUESTIONS.length) * 100);

  return (
    <div className="min-h-screen bg-[#0F141A] text-[#E6EDF3] flex flex-col select-none">
      {/* Violation Warning Overlay */}
      {warningModal.open && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[#E06C75]/60 bg-[#1B1417] p-7 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#3B1E22] flex items-center justify-center text-[#E06C75]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#FFB8BE]">Зафиксировано нарушение</h2>
            <p className="text-xs text-[#D6B8BC] leading-relaxed">
              Причина: <strong className="text-white">{warningModal.reason}</strong>.
              <br />
              Событие отправлено в журнал преподавателя. Всего нарушений:{' '}
              <span className="font-mono font-bold text-[#E06C75] tabular-nums">
                {warningModal.count}
              </span>
              .
            </p>
            <button
              type="button"
              onClick={handleResumeAfterWarning}
              className="w-full py-3 rounded-lg bg-[#E06C75] text-[#1A0D0F] font-semibold text-sm hover:bg-[#EA858D] transition-colors cursor-pointer"
            >
              Вернуться к тесту
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#222D38] bg-[#131A22] px-4 sm:px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#213124] border border-[#5D8247] flex items-center justify-center font-mono font-bold text-sm text-[#CBEF9C]">
              G
            </div>
            <div className="text-sm font-bold text-white">Godot System Check</div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-[#9FB0C0]">
              {activeSession.group} · {activeSession.studentName}
            </span>
            <span className="text-[#45586B]" aria-hidden="true">
              |
            </span>
            <span
              className={`inline-flex items-center gap-1.5 tabular-nums ${
                activeSession.violationsCount > 0 ? 'text-[#E06C75]' : 'text-[#9ED164]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Нарушений: {activeSession.violationsCount}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Test Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Progress Bar */}
        <div className="p-4 rounded-xl border border-[#24303C] bg-[#141B23]">
          <div className="flex items-center justify-between text-xs font-mono text-[#8EA0B0] mb-2">
            <span>{currentQuestion.section}</span>
            <span className="tabular-nums text-[#E6EDF3]">
              Задание {String(currentIdx + 1).padStart(2, '0')} из {QUESTIONS.length}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#24303C] overflow-hidden">
            <div
              className="h-full bg-[#9ED164] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <section className="rounded-xl border border-[#2A3744] bg-[#161E27] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#24303C] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-[#9ED164]">
              Задание {String(currentIdx + 1).padStart(2, '0')}
            </span>
            <span className="text-xs font-mono text-[#E5A454]">{currentQuestion.type}</span>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#F1F6FA] leading-snug mb-2">
                {currentQuestion.title}
              </h2>
              <p className="text-sm text-[#A9B9C8] leading-relaxed">{currentQuestion.desc}</p>
            </div>

            {currentQuestion.context && (
              <div className="p-3.5 rounded-lg border border-[#2A3744] bg-[#11171D] text-xs text-[#C7D3DF] leading-relaxed">
                {currentQuestion.context}
              </div>
            )}

            <QuestionRenderer
              question={currentQuestion}
              value={currentValue}
              onChange={handleAnswerChange}
            />
          </div>

          <div className="px-6 py-4 border-t border-[#24303C] bg-[#131A22] flex items-center justify-between gap-4">
            <span className="text-xs font-mono text-[#7C8D9C]">
              {canContinue ? 'Ответ зафиксирован' : 'Выберите ответ для продолжения'}
            </span>
            <button
              type="button"
              disabled={!canContinue}
              onClick={handleNextOrFinish}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#9ED164] text-[#111912] font-semibold text-sm hover:bg-[#B4E07F] transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>
                {currentIdx === QUESTIONS.length - 1
                  ? 'Завершить и проверить'
                  : 'Следующий вопрос'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

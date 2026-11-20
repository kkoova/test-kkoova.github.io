import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { AlertTriangle, ChevronRight, Clock, Lock, LogIn, Shield } from 'lucide-react';
import { ADMIN_UID, auth, githubProvider } from './firebase';
import { GroupRoster } from './data/defaultRoster';
import {
  gradeTest,
  Question,
  QUESTIONS,
  TestGradeResult,
  UserAnswerValue,
} from './data/questions';
import {
  completeSession,
  createOrStartSession,
  readLocalRoster,
  readLocalTestConfigs,
  recordViolation,
  StudentSession,
  subscribeRoster,
  subscribeTelemetry,
  subscribeTestConfigs,
  SyncStatus,
  TestDefinition,
  updateSessionProgress,
  ViolationEvent,
  ViolationType,
} from './services/telemetryService';
import {
  FeedbackEntry,
  fetchMissions,
  GlobalTimerState,
  Mission,
  MissionSubmission,
  subscribeAllFeedback,
  subscribeAllSubmissions,
  subscribeGlobalTimer,
  subscribeUserSubmissions,
} from './services/courseService';
import { PortalHeader } from './components/PortalHeader';
import { CoursePortalView } from './components/CoursePortalView';
import { LessonView } from './components/LessonView';
import { StartScreen, TestCatalogGrid } from './components/StartScreen';
import { isQuestionAnswered, QuestionRenderer } from './components/QuestionRenderer';
import { FinalResultsView } from './components/FinalResultsView';
import { AdminDashboard } from './components/AdminDashboard';
import { SecondScreenMonitor } from './components/SecondScreenMonitor';
import { GlobalTimerOverlay } from './components/GlobalTimerOverlay';
import { ProfileModal } from './components/ProfileModal';
import { FeedbackModal } from './components/FeedbackModal';

type AppView =
  | 'course'
  | 'lesson'
  | 'test_start'
  | 'test_active'
  | 'test_completed'
  | 'admin'
  | 'monitor';

const PREVIEW_ROLE_KEY = 'mobile_godot_preview_role';

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const initialUrlParams = useMemo(() => {
    if (typeof window === 'undefined') return { view: null, doc: null };
    const sp = new URLSearchParams(window.location.search);
    return { view: sp.get('view'), doc: sp.get('doc') };
  }, []);

  const isStandaloneMonitorUrl = initialUrlParams.view === 'monitor';

  const [view, setView] = useState<AppView>(() => {
    if (initialUrlParams.view === 'monitor') return 'monitor';
    if (initialUrlParams.view === 'test') return 'test_start';
    if (initialUrlParams.doc) return 'lesson';
    return 'course';
  });
  const [activeDoc, setActiveDoc] = useState<string>(initialUrlParams.doc || '01.json');

  // Auth state (shared across Course, Lesson, Test, Admin, Monitor)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [previewRole, setPreviewRole] = useState<'admin' | 'student' | null>(() => {
    try {
      const val = localStorage.getItem(PREVIEW_ROLE_KEY);
      return val === 'admin' || val === 'student' ? val : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Teacher "Enter as Student" verification mode
  const [studentViewMode, setStudentViewMode] = useState<boolean>(false);
  const [simulateGuest, setSimulateGuest] = useState<boolean>(false);

  const isRealAdmin = firebaseUser?.uid === ADMIN_UID || previewRole === 'admin';
  const isAdmin = isRealAdmin && !studentViewMode;
  const rawSignedIn = Boolean(firebaseUser) || previewRole !== null;
  const isSignedIn = studentViewMode && simulateGuest ? false : rawSignedIn;

  const userLabel =
    studentViewMode
      ? 'Студент (проверка преподавателя)'
      : firebaseUser?.displayName ||
        firebaseUser?.email ||
        (previewRole === 'admin'
          ? 'Преподаватель (Предпросмотр)'
          : previewRole === 'student'
            ? 'Студент (Предпросмотр)'
            : 'Гость');

  // Course data state
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsError, setMissionsError] = useState<string | null>(null);
  const [userSubmissions, setUserSubmissions] = useState<MissionSubmission[]>([]);
  const [globalTimer, setGlobalTimer] = useState<GlobalTimerState | null>(null);

  // Modals
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Roster, Tests Catalog & Telemetry state
  const [roster, setRoster] = useState<GroupRoster[]>(() => readLocalRoster());
  const [tests, setTests] = useState<TestDefinition[]>(() => readLocalTestConfigs());
  const [preselectedTestId, setPreselectedTestId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [violationsFeed, setViolationsFeed] = useState<ViolationEvent[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [allSubmissions, setAllSubmissions] = useState<MissionSubmission[]>([]);
  const [allFeedback, setAllFeedback] = useState<FeedbackEntry[]>([]);

  // Active Student Test state
  const [activeTest, setActiveTest] = useState<TestDefinition | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(QUESTIONS);
  const [activeSession, setActiveSession] = useState<StudentSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, UserAnswerValue>>({});
  const [gradeResult, setGradeResult] = useState<TestGradeResult | null>(null);
  const [finishedByTimeout, setFinishedByTimeout] = useState<boolean>(false);
  const [remainingSec, setRemainingSec] = useState<number>(0);

  const [warningModal, setWarningModal] = useState<{
    open: boolean;
    reason: string;
    count: number;
  }>({ open: false, reason: '', count: 0 });

  const activeSessionRef = useRef<StudentSession | null>(null);
  const activeQuestionsRef = useRef<Question[]>(QUESTIONS);
  const answersRef = useRef<Record<number, UserAnswerValue>>({});
  const currentIdxRef = useRef<number>(0);
  const lastViolationMsRef = useRef<number>(0);
  const enteredFullscreenRef = useRef<boolean>(false);
  const hasFinishedRef = useRef<boolean>(false);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    activeQuestionsRef.current = activeQuestions;
  }, [activeQuestions]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  // 1. Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthInitialized(true);
    });
    return () => unsub();
  }, []);

  // 2. Load missions from ./data.json
  useEffect(() => {
    fetchMissions()
      .then((list) => setMissions(list))
      .catch((err: Error) => setMissionsError(err.message));
  }, []);

  // 3. Subscribe to Global Timer (system/timer)
  useEffect(() => {
    return subscribeGlobalTimer(setGlobalTimer);
  }, []);

  // 4. Subscribe to Student Roster & Test Configurations
  useEffect(() => {
    const unsubRoster = subscribeRoster(setRoster);
    const unsubTests = subscribeTestConfigs(setTests);
    return () => {
      unsubRoster();
      unsubTests();
    };
  }, []);

  // 5. Subscribe to Current User's Submissions
  useEffect(() => {
    if (!rawSignedIn) {
      setUserSubmissions([]);
      return;
    }
    return subscribeUserSubmissions(firebaseUser?.uid || null, setUserSubmissions);
  }, [rawSignedIn, firebaseUser?.uid]);

  // 6. Subscribe to Admin Telemetry & Course Submissions when Admin/Monitor/Profile
  useEffect(() => {
    if (!isAdmin && view !== 'admin' && view !== 'monitor' && !profileOpen) return;
    const unsubTel = subscribeTelemetry({
      onSessions: setSessions,
      onViolations: setViolationsFeed,
      onStatus: setSyncStatus,
    });
    let unsubSubs = () => {};
    let unsubFeed = () => {};
    if (isAdmin) {
      unsubSubs = subscribeAllSubmissions(setAllSubmissions);
      unsubFeed = subscribeAllFeedback(setAllFeedback);
    }
    return () => {
      unsubTel();
      unsubSubs();
      unsubFeed();
    };
  }, [isAdmin, view, profileOpen]);

  const handleGitHubSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, githubProvider);
      try {
        localStorage.removeItem(PREVIEW_ROLE_KEY);
      } catch {
        // ignore
      }
      setPreviewRole(null);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed') {
        setAuthError(
          'Текущий домен предпросмотра не добавлен в Authorized Domains проекта Firebase (it-course-lele). На kkoova.github.io вход через GitHub работает напрямую, а здесь можно открыть портал в режиме предпросмотра.'
        );
      } else if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        setAuthError(
          'Окно авторизации GitHub было закрыто или заблокировано. Повторите попытку или используйте режим предпросмотра.'
        );
      } else {
        setAuthError(`Ошибка авторизации: ${(err as Error)?.message || 'неизвестная ошибка'}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const activatePreviewRole = (role: 'admin' | 'student') => {
    try {
      localStorage.setItem(PREVIEW_ROLE_KEY, role);
    } catch {
      // ignore
    }
    setPreviewRole(role);
    setStudentViewMode(false);
    setSimulateGuest(false);
    setAuthError(null);
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem(PREVIEW_ROLE_KEY);
    } catch {
      // ignore
    }
    setPreviewRole(null);
    setStudentViewMode(false);
    setSimulateGuest(false);
    if (firebaseUser) {
      await signOut(auth).catch(() => {});
    }
    if (view === 'admin' || view === 'monitor') {
      setView('course');
    }
  };

  const toggleStudentPreview = () => {
    if (!isRealAdmin) return;
    if (!studentViewMode) {
      setStudentViewMode(true);
      setSimulateGuest(false);
      setView('course');
    } else {
      setStudentViewMode(false);
      setSimulateGuest(false);
      setView('admin');
    }
  };

  // Complete & grade test (both manual finish on last question and auto-finish on timer expiry)
  const finishActiveTest = useCallback(async (timedOut: boolean) => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    const currentQuestions = activeQuestionsRef.current;
    const currentAnswers = answersRef.current;
    const result = gradeTest(currentQuestions, currentAnswers);

    setWarningModal({ open: false, reason: '', count: 0 });
    setFinishedByTimeout(timedOut);
    setGradeResult(result);

    if (activeSessionRef.current) {
      const answeredCount = Object.keys(currentAnswers).length;
      const finished = await completeSession(activeSessionRef.current, result, {
        timedOut,
        answeredCount,
      });
      setActiveSession(finished);
      activeSessionRef.current = finished;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setView('test_completed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Test countdown timer during test_active
  useEffect(() => {
    if (view !== 'test_active' || !activeSession?.deadlineMs) return;

    const deadlineMs = activeSession.deadlineMs;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0 && !hasFinishedRef.current) {
        finishActiveTest(true);
      }
    };

    tick();
    const interval = window.setInterval(tick, 400);
    return () => window.clearInterval(interval);
  }, [view, activeSession?.deadlineMs, finishActiveTest]);

  // Anti-cheat violation handler
  const triggerViolation = useCallback(async (type: ViolationType, label: string) => {
    const sess = activeSessionRef.current;
    if (!sess || hasFinishedRef.current) return;

    const now = Date.now();
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

  useEffect(() => {
    if (view !== 'test_active') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('visibility_hidden', 'Переключение вкладки или сворачивание браузера');
      }
    };

    const handleBlur = () => {
      window.setTimeout(() => {
        if (!document.hasFocus() && activeSessionRef.current && !hasFinishedRef.current) {
          triggerViolation('window_blur', 'Потеря фокуса: переход в другое окно или программу');
        }
      }, 120);
    };

    const handleFullscreenChange = () => {
      if (
        enteredFullscreenRef.current &&
        !document.fullscreenElement &&
        activeSessionRef.current &&
        !hasFinishedRef.current
      ) {
        triggerViolation('fullscreen_exit', 'Выход из полноэкранного режима');
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
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
  }, [view, triggerViolation]);

  const handleStartTest = async ({
    test,
    group,
    studentName,
  }: {
    test: TestDefinition;
    group: string;
    studentName: string;
  }) => {
    enteredFullscreenRef.current = false;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        enteredFullscreenRef.current = Boolean(document.fullscreenElement);
      }
    } catch {
      enteredFullscreenRef.current = false;
    }

    const qList =
      test.questionIds.length > 0
        ? QUESTIONS.filter((q) => test.questionIds.includes(q.id))
        : QUESTIONS;
    const finalQuestions = qList.length > 0 ? qList : QUESTIONS;
    const durationMin = Math.max(1, test.durationMinutes || 25);
    const deadlineMs = Date.now() + durationMin * 60 * 1000;

    hasFinishedRef.current = false;
    setActiveTest(test);
    setActiveQuestions(finalQuestions);
    activeQuestionsRef.current = finalQuestions;
    setFinishedByTimeout(false);
    setRemainingSec(durationMin * 60);

    const session = await createOrStartSession({
      studentName,
      group,
      totalQuestions: finalQuestions.length,
      githubUid: studentViewMode ? null : firebaseUser?.uid || null,
      testId: test.id,
      testTitle: test.title,
      durationMinutes: durationMin,
      deadlineMs,
    });

    setActiveSession(session);
    activeSessionRef.current = session;
    setCurrentIdx(0);
    setAnswers({});
    answersRef.current = {};
    setGradeResult(null);
    setWarningModal({ open: false, reason: '', count: 0 });
    setView('test_active');
  };

  const handleResumeAfterWarning = async () => {
    setWarningModal((prev) => ({ ...prev, open: false }));
    if (enteredFullscreenRef.current && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // ignore
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
    const q = activeQuestions[currentIdx];
    if (!q) return;
    setAnswers((prev) => {
      const next = { ...prev };
      if (val === undefined) delete next[q.id];
      else next[q.id] = val;
      answersRef.current = next;
      return next;
    });
  };

  const handleNextOrFinish = async () => {
    const q = activeQuestions[currentIdx];
    if (!q || !isQuestionAnswered(q, answers[q.id])) return;

    const answeredCount = Object.keys(answers).length;
    if (currentIdx < activeQuestions.length - 1) {
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
      await finishActiveTest(false);
    }
  };

  const groupNames = useMemo(() => roster.map((g) => g.name), [roster]);
  const userTestSessions = useMemo(() => {
    if (!firebaseUser?.uid) return sessions;
    return sessions.filter((s) => s.githubUid === firebaseUser.uid);
  }, [sessions, firebaseUser?.uid]);

  // 1. Second Screen Monitor View (?view=monitor or in-place)
  if (view === 'monitor') {
    if (!isRealAdmin) {
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
                  onClick={() => activatePreviewRole('admin')}
                  className="px-3 py-1.5 rounded bg-[#E5A454] text-[#1A140C] font-semibold cursor-pointer"
                >
                  Открыть предпросмотр монитора
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={authLoading}
              onClick={handleGitHubSignIn}
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
      <>
        <GlobalTimerOverlay timer={globalTimer} isAdmin={isAdmin} />
        <SecondScreenMonitor
          sessions={sessions}
          violations={violationsFeed}
          syncStatus={syncStatus}
          groups={groupNames}
          isStandaloneWindow={isStandaloneMonitorUrl}
          onExit={isStandaloneMonitorUrl ? undefined : () => setView('admin')}
        />
      </>
    );
  }

  // 2. Unified Admin Console
  if (view === 'admin' && isAdmin) {
    return (
      <>
        <GlobalTimerOverlay timer={globalTimer} isAdmin={isAdmin} />
        <AdminDashboard
          sessions={sessions}
          violations={violationsFeed}
          syncStatus={syncStatus}
          roster={roster}
          tests={tests}
          missions={missions}
          allSubmissions={allSubmissions}
          allFeedback={allFeedback}
          globalTimer={globalTimer}
          adminLabel={userLabel}
          onBackToPortal={() => setView('course')}
          onEnterStudentView={toggleStudentPreview}
          onOpenSecondScreenInPlace={() => setView('monitor')}
        />
      </>
    );
  }

  // 3. Active Student Test (distraction-free fullscreen mode with countdown timer)
  if (view === 'test_active' && activeSession) {
    const currentQuestion = activeQuestions[currentIdx];
    const currentValue = answers[currentQuestion.id];
    const canContinue = isQuestionAnswered(currentQuestion, currentValue);
    const progressPct = Math.round(((currentIdx + 1) / activeQuestions.length) * 100);

    const timerUrgent = remainingSec <= 60;
    const timerWarning = remainingSec > 60 && remainingSec <= 180;

    return (
      <div className="min-h-screen bg-[#0F141A] text-[#E6EDF3] flex flex-col select-none">
        <GlobalTimerOverlay timer={globalTimer} isAdmin={isAdmin} />

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

        <header className="border-b border-[#222D38] bg-[#131A22] px-4 sm:px-6 py-3.5">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#213124] border border-[#5D8247] flex items-center justify-center font-mono font-bold text-sm text-[#CBEF9C]">
                G
              </div>
              <div className="text-sm font-bold text-white">
                {activeTest?.title || 'Godot System Check'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <span className="text-[#9FB0C0]">
                {activeSession.group} · {activeSession.studentName}
              </span>
              <span className="text-[#45586B]" aria-hidden="true">
                |
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border tabular-nums font-bold ${
                  timerUrgent
                    ? 'bg-[#3B1E22] border-[#E06C75] text-[#FFB8BE]'
                    : timerWarning
                      ? 'bg-[#251E15] border-[#E5A454] text-[#F3D3A7]'
                      : 'bg-[#161F28] border-[#2A3744] text-[#CBEF9C]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{formatCountdown(remainingSec)}</span>
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

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
          <div className="p-4 rounded-xl border border-[#24303C] bg-[#141B23]">
            <div className="flex items-center justify-between text-xs font-mono text-[#8EA0B0] mb-2">
              <span>{currentQuestion.section}</span>
              <span className="tabular-nums text-[#E6EDF3]">
                Задание {String(currentIdx + 1).padStart(2, '0')} из {activeQuestions.length}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#24303C] overflow-hidden">
              <div
                className="h-full bg-[#9ED164] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

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
                  {currentIdx === activeQuestions.length - 1
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

  // 4. Unified Portal Shell (Start Page, Course Map, Lesson Reader, Test Start, Test Results)
  const activeHeaderSection =
    view === 'test_start' || view === 'test_completed' ? 'test' : 'course';

  return (
    <div className="min-h-screen bg-[#0F141A] text-[#E6EDF3] flex flex-col">
      <GlobalTimerOverlay timer={globalTimer} isAdmin={isAdmin} />

      <PortalHeader
        activeSection={activeHeaderSection}
        onNavigate={(sec) => {
          setView(sec === 'test' ? 'test_start' : 'course');
        }}
        isSignedIn={isSignedIn}
        isAdmin={isAdmin}
        canSwitchToStudent={isRealAdmin}
        isStudentPreviewMode={studentViewMode}
        simulateGuest={simulateGuest}
        userLabel={userLabel}
        authLoading={authLoading}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenFeedback={() => setFeedbackOpen(true)}
        onOpenAdmin={() => setView('admin')}
        onToggleStudentPreview={toggleStudentPreview}
        onToggleSimulateGuest={() => setSimulateGuest((v) => !v)}
        onSignIn={handleGitHubSignIn}
        onSignOut={handleSignOut}
      />

      {/* Shared Auth Error / Preview Banner */}
      {authError && (
        <div className="max-w-7xl w-full mx-auto px-6 pt-5">
          <div className="p-4 rounded-xl border border-[#E5A454]/50 bg-[#251E15] text-sm text-[#F3D3A7] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="font-semibold text-[#E5A454] text-xs">
                Авторизация GitHub в текущем окне ограничена
              </div>
              <p className="text-xs text-[#D8C2A2] leading-relaxed">{authError}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => activatePreviewRole('student')}
                className="px-3 py-2 rounded-md border border-[#E5A454] text-[#F3D3A7] text-xs font-semibold hover:bg-[#E5A454]/10 cursor-pointer"
              >
                Войти как студент
              </button>
              <button
                type="button"
                onClick={() => activatePreviewRole('admin')}
                className="px-3 py-2 rounded-md bg-[#E5A454] text-[#1A140C] text-xs font-semibold hover:bg-[#F0B469] cursor-pointer"
              >
                Войти как преподаватель
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1">
        {/* Start Page when not signed in: Login + Locked/Scheduled Tests */}
        {view === 'course' && !isSignedIn && authInitialized ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 5 cols: GitHub Login Card */}
              <div className="lg:col-span-5 rounded-xl border border-[#2A3744] bg-[#161E27] p-7 sm:p-8 space-y-5 shadow-xl">
                <div className="w-12 h-12 rounded-lg bg-[#213124] border border-[#5D8247] flex items-center justify-center font-mono text-xl font-bold text-[#CBEF9C]">
                  G
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-mono text-[#9ED164]">Портал курса</div>
                  <h1 className="text-2xl font-bold text-white">Mobile Godot</h1>
                  <p className="text-xs text-[#9FB0C0] leading-relaxed">
                    Войдите через GitHub, чтобы открыть карту миссий, методические материалы, сдавать проекты и отслеживать личный прогресс. Преподаватель определяется автоматически.
                  </p>
                </div>

                {!studentViewMode ? (
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={handleGitHubSignIn}
                    className="w-full py-3.5 px-4 rounded-lg bg-[#9ED164] text-[#111912] text-sm font-semibold hover:bg-[#B4E07F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{authLoading ? 'Выполняется вход...' : 'Войти через GitHub'}</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-lg border border-[#344656] bg-[#11171D] text-xs text-[#9FB0C0]">
                    Вы просматриваете стартовую страницу так, как её видит студент до входа через GitHub.
                  </div>
                )}
              </div>

              {/* Right 7 cols: Tests Catalog & Scheduled Dates (Locked until Teacher Unlocks) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono text-[#E5A454]">Контроль знаний и расписание</div>
                  <h2 className="text-xl font-bold text-white">Тестирования по курсу</h2>
                  <p className="text-xs text-[#9FB0C0] leading-relaxed">
                    Здесь отображаются назначенные тесты и даты проведения для групп. Доступ открывается только после нажатия кнопки разблокировки преподавателем.
                  </p>
                </div>

                <TestCatalogGrid
                  tests={tests}
                  totalAvailableQuestions={QUESTIONS.length}
                  onSelectTest={(t) => {
                    setPreselectedTestId(t.id);
                    setView('test_start');
                  }}
                />
              </div>
            </div>
          </div>
        ) : view === 'course' ? (
          missionsError ? (
            <div className="max-w-xl mx-auto my-12 p-6 rounded-xl border border-[#E06C75]/50 bg-[#1B1417] text-center text-sm text-[#FFB8BE]">
              {missionsError}
            </div>
          ) : (
            <CoursePortalView
              missions={missions}
              submissions={userSubmissions}
              user={firebaseUser}
              fallbackName={userLabel}
              onOpenLesson={(docUrl) => {
                setActiveDoc(docUrl);
                setView('lesson');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenTest={() => setView('test_start')}
            />
          )
        ) : view === 'lesson' ? (
          <LessonView
            docName={activeDoc}
            isAdmin={isAdmin}
            onBack={() => setView('course')}
          />
        ) : view === 'test_completed' && gradeResult && activeSession ? (
          <FinalResultsView
            studentName={activeSession.studentName}
            group={activeSession.group}
            testTitle={activeTest?.title || activeSession.testTitle}
            timedOut={finishedByTimeout}
            violationsCount={activeSession.violationsCount}
            result={gradeResult}
            onExitToHome={() => {
              setActiveSession(null);
              activeSessionRef.current = null;
              setView('course');
            }}
          />
        ) : (
          <StartScreen
            tests={tests}
            roster={roster}
            totalQuestions={QUESTIONS.length}
            initialTestId={preselectedTestId}
            defaultStudentHint={studentViewMode ? null : firebaseUser?.displayName || null}
            onStartTest={handleStartTest}
          />
        )}
      </main>

      {/* Modals */}
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        displayName={userLabel}
        email={firebaseUser?.email || ''}
        photoUrl={firebaseUser?.photoURL || null}
        missions={missions}
        submissions={userSubmissions}
        testSessions={userTestSessions}
      />

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        user={firebaseUser}
        fallbackName={userLabel}
      />
    </div>
  );
}

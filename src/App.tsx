import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { AlertTriangle, ChevronRight, Clock, Lock, LogIn, Shield, ShieldCheck } from 'lucide-react';
import { ADMIN_UID, auth, githubProvider } from './firebase';
import { GroupRoster } from './data/defaultRoster';
import {
  gradeTest,
  Question,
  TestGradeResult,
  UserAnswerValue,
} from './data/questions';
import {
  completeSession,
  createOrStartSession,
  GradebookConfig,
  ProjectGuideConfig,
  readLocalGradebook,
  readLocalProjectGuide,
  readLocalQuestions,
  readLocalRoster,
  readLocalTestConfigs,
  recordViolation,
  StudentSession,
  subscribeGradebook,
  subscribeProjectGuide,
  subscribeQuestions,
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
  BonusConfig,
  BonusSubmission,
  FeedbackEntry,
  GlobalTimerState,
  LessonData,
  Mission,
  readLocalBonusConfig,
  subscribeAllFeedback,
  subscribeBonusConfig,
  subscribeBonusSubmissions,
  subscribeCustomDocs,
  subscribeGlobalTimer,
  subscribeMissions,
  subscribeWheelSpins,
  WheelSpinRecord,
} from './services/courseService';
import {
  readLocalStudentSession,
  saveLocalStudentSession,
  StudentAccount,
  StudentSessionUser,
  subscribeStudentAccounts,
} from './services/studentAuthService';
import {
  detectAutomationEnvironment,
  isDevToolsHeuristicTriggered,
  isTrustedUserEvent,
  shuffleWithSeed,
} from './utils/antiAgentGuard';
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
import { ProjectGuideBanner, ProjectGuideView } from './components/ProjectGuideView';
import { BonusTaskView } from './components/BonusTaskView';
import { AdhdZoneView } from './components/AdhdZoneView';
import { GradeCasinoView } from './components/GradeCasinoView';
import { StudentLoginPanel } from './components/StudentLoginPanel';
import { CanvasProtectedText } from './components/CanvasProtectedText';

type AppView =
  | 'course'
  | 'project'
  | 'lesson'
  | 'test_start'
  | 'test_active'
  | 'test_completed'
  | 'bonus'
  | 'adhd'
  | 'casino'
  | 'admin'
  | 'monitor';

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

  // Auth state (Student login by Group+FIO+Password; GitHub is reserved for Teacher Admin)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [studentAccounts, setStudentAccounts] = useState<Record<string, StudentAccount>>({});
  const [studentSession, setStudentSession] = useState<StudentSessionUser | null>(() =>
    readLocalStudentSession()
  );

  // Teacher "Enter as Student" verification mode
  const [studentViewMode, setStudentViewMode] = useState<boolean>(false);
  const [simulateGuest, setSimulateGuest] = useState<boolean>(false);

  const isRealAdmin = firebaseUser?.uid === ADMIN_UID;
  const isAdmin = isRealAdmin && !studentViewMode;
  const lockedStudent =
    !isAdmin && !(studentViewMode && simulateGuest) && studentSession
      ? { group: studentSession.group, studentName: studentSession.studentName }
      : null;

  const rawSignedIn =
    Boolean(studentSession) ||
    Boolean(isRealAdmin) ||
    Boolean(firebaseUser);
  const isSignedIn = studentViewMode && simulateGuest ? false : rawSignedIn;

  const userLabel = studentViewMode
    ? studentSession
      ? `${studentSession.studentName} (${studentSession.group})`
      : 'Студент (проверка преподавателя)'
    : studentSession
      ? `${studentSession.studentName} (${studentSession.group})`
      : firebaseUser?.displayName || firebaseUser?.email || 'Гость';

  // Course data state
  const [missions, setMissions] = useState<Mission[]>([]);
  const [customDocs, setCustomDocs] = useState<Record<string, LessonData>>({});
  const [missionsError, setMissionsError] = useState<string | null>(null);
  const [globalTimer, setGlobalTimer] = useState<GlobalTimerState | null>(null);

  // Modals
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Roster, Tests Catalog, Live Questions, Project Guide, Gradebook & Telemetry state
  const [roster, setRoster] = useState<GroupRoster[]>(() => readLocalRoster());
  const [tests, setTests] = useState<TestDefinition[]>(() => readLocalTestConfigs());
  const [questions, setQuestions] = useState<Question[]>(() => readLocalQuestions());
  const [projectGuide, setProjectGuide] = useState<ProjectGuideConfig>(() =>
    readLocalProjectGuide()
  );
  const [gradebook, setGradebook] = useState<GradebookConfig>(() => readLocalGradebook());
  const [preselectedTestId, setPreselectedTestId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [violationsFeed, setViolationsFeed] = useState<ViolationEvent[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [allFeedback, setAllFeedback] = useState<FeedbackEntry[]>([]);
  const [bonusSubmissions, setBonusSubmissions] = useState<BonusSubmission[]>([]);
  const [bonusConfig, setBonusConfig] = useState<BonusConfig>(() => readLocalBonusConfig());
  const [wheelSpins, setWheelSpins] = useState<WheelSpinRecord[]>([]);

  // Active Student Test state
  const [activeTest, setActiveTest] = useState<TestDefinition | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() => readLocalQuestions());
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
  const [testSessionSeed, setTestSessionSeed] = useState<string>('default');
  const [automationBlockError, setAutomationBlockError] = useState<string | null>(null);
  const [humanChallengeOpen, setHumanChallengeOpen] = useState<boolean>(false);
  const [humanHoldProgress, setHumanHoldProgress] = useState<number>(0);

  const activeSessionRef = useRef<StudentSession | null>(null);
  const activeQuestionsRef = useRef<Question[]>(questions);
  const answersRef = useRef<Record<number, UserAnswerValue>>({});
  const currentIdxRef = useRef<number>(0);
  const lastViolationMsRef = useRef<number>(0);
  const enteredFullscreenRef = useRef<boolean>(false);
  const hasFinishedRef = useRef<boolean>(false);
  const questionShownAtMsRef = useRef<number>(Date.now());
  const pointerMovesRef = useRef<number>(0);
  const fastStreakRef = useRef<number>(0);
  const holdIntervalRef = useRef<number | null>(null);

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

  // 2. Subscribe to Missions (data.json + teacher web overrides), Custom Docs & Bonus Config
  useEffect(() => {
    const unsubMissions = subscribeMissions(setMissions, setMissionsError);
    const unsubDocs = subscribeCustomDocs(setCustomDocs);
    const unsubBonusCfg = subscribeBonusConfig(setBonusConfig);
    return () => {
      unsubMissions();
      unsubDocs();
      unsubBonusCfg();
    };
  }, []);

  // 3. Subscribe to Global Timer (system/timer)
  useEffect(() => {
    return subscribeGlobalTimer(setGlobalTimer);
  }, []);

  // 4. Subscribe to Student Roster, Student Accounts, Test Configurations, Questions, Project Guide & Gradebook
  useEffect(() => {
    const unsubRoster = subscribeRoster(setRoster);
    const unsubStudentAccounts = subscribeStudentAccounts(setStudentAccounts);
    const unsubTests = subscribeTestConfigs(setTests);
    const unsubQuestions = subscribeQuestions(setQuestions);
    const unsubProjectGuide = subscribeProjectGuide(setProjectGuide);
    const unsubGradebook = subscribeGradebook(setGradebook);
    return () => {
      unsubRoster();
      unsubStudentAccounts();
      unsubTests();
      unsubQuestions();
      unsubProjectGuide();
      unsubGradebook();
    };
  }, []);

  // 5. Subscribe to Admin Telemetry, Course Feedback, Bonus Submissions & Wheel Spins
  useEffect(() => {
    let unsubTel = () => {};
    let unsubFeed = () => {};
    let unsubBonus = () => {};
    let unsubWheel = () => {};

    if (isAdmin || view === 'admin' || view === 'monitor' || profileOpen) {
      unsubTel = subscribeTelemetry({
        onSessions: setSessions,
        onViolations: setViolationsFeed,
        onStatus: setSyncStatus,
      });
    }
    if (isAdmin) {
      unsubFeed = subscribeAllFeedback(setAllFeedback);
    }
    if (isAdmin || view === 'bonus' || view === 'admin') {
      unsubBonus = subscribeBonusSubmissions(setBonusSubmissions);
    }
    if (isAdmin || view === 'casino' || view === 'admin') {
      unsubWheel = subscribeWheelSpins(setWheelSpins);
    }

    return () => {
      unsubTel();
      unsubFeed();
      unsubBonus();
      unsubWheel();
    };
  }, [isAdmin, view, profileOpen]);

  const handleGitHubSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, githubProvider);
    } catch (err) {
      console.warn('GitHub sign-in cancelled or failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setStudentViewMode(false);
    setSimulateGuest(false);
    setStudentSession(null);
    saveLocalStudentSession(null);
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
    const handleClipboardBlock = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerViolation('copy_attempt', 'Попытка копирования или вставки текста во время теста');
    };
    const handleKeyDownBlock = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      const isDevToolsKey =
        e.key === 'F12' ||
        (ctrlOrMeta && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) ||
        (ctrlOrMeta && ['u', 'c', 's', 'a', 'p'].includes(key)) ||
        e.key === 'PrintScreen';

      if (isDevToolsKey) {
        e.preventDefault();
        triggerViolation(
          'devtools_shortcut',
          `Запрещённая клавиша или комбинация (${e.key})`
        );
      }
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (e.isTrusted) {
        pointerMovesRef.current += 1;
      }
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const guardInterval = window.setInterval(() => {
      const autoCheck = detectAutomationEnvironment();
      if (autoCheck.suspicious) {
        triggerViolation(
          'automation_detected',
          `Обнаружена среда автоматизации (${autoCheck.reasons.join(', ')})`
        );
      } else if (isDevToolsHeuristicTriggered()) {
        triggerViolation(
          'devtools_opened',
          'Подозрение на открытую панель разработчика (DevTools)'
        );
      }
    }, 2200);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleClipboardBlock);
    document.addEventListener('cut', handleClipboardBlock);
    document.addEventListener('paste', handleClipboardBlock);
    window.addEventListener('keydown', handleKeyDownBlock, true);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(guardInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleClipboardBlock);
      document.removeEventListener('cut', handleClipboardBlock);
      document.removeEventListener('paste', handleClipboardBlock);
      window.removeEventListener('keydown', handleKeyDownBlock, true);
      window.removeEventListener('pointermove', handlePointerMove);
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
    setAutomationBlockError(null);
    const autoCheck = detectAutomationEnvironment();
    if (autoCheck.suspicious && !isRealAdmin) {
      setAutomationBlockError(
        `Запуск заблокирован: обнаружен браузер автоматизации / AI-агент (${autoCheck.reasons.join(', ')}). Используйте обычный браузер без скриптов управления.`
      );
      return;
    }

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
        ? questions.filter((q) => test.questionIds.includes(q.id))
        : questions;
    const rawQuestions = qList.length > 0 ? qList : questions;
    const seed = `${studentName}_${group}_${Date.now()}`;
    const finalQuestions = shuffleWithSeed(rawQuestions, seed);
    const durationMin = Math.max(1, test.durationMinutes || 25);
    const deadlineMs = Date.now() + durationMin * 60 * 1000;

    hasFinishedRef.current = false;
    questionShownAtMsRef.current = Date.now();
    pointerMovesRef.current = 0;
    fastStreakRef.current = 0;
    setHumanChallengeOpen(false);
    setHumanHoldProgress(0);
    setTestSessionSeed(seed);
    setActiveTest(test);
    setActiveQuestions(finalQuestions);
    activeQuestionsRef.current = finalQuestions;
    setFinishedByTimeout(false);
    setRemainingSec(durationMin * 60);

    const session = await createOrStartSession({
      studentName,
      group,
      totalQuestions: finalQuestions.length,
      githubUid: studentSession?.id || (studentViewMode ? null : firebaseUser?.uid || null),
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

  const proceedToNextOrFinish = async () => {
    const answeredCount = Object.keys(answers).length;
    if (currentIdx < activeQuestions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      questionShownAtMsRef.current = Date.now();
      pointerMovesRef.current = 0;
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

  const handleNextOrFinish = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e && !isTrustedUserEvent(e)) {
      triggerViolation(
        'automation_detected',
        'Программный клик по кнопке перехода (искусственное событие)'
      );
      return;
    }

    const q = activeQuestions[currentIdx];
    if (!q || !isQuestionAnswered(q, answers[q.id])) return;

    const elapsedMs = Date.now() - questionShownAtMsRef.current;
    if (elapsedMs < 850 || (elapsedMs < 1800 && pointerMovesRef.current === 0)) {
      fastStreakRef.current += 1;
      if (fastStreakRef.current >= 2) {
        setHumanHoldProgress(0);
        setHumanChallengeOpen(true);
        triggerViolation(
          'automation_detected',
          'Подозрительно быстрое прохождение без движения курсора (признак бота)'
        );
        return;
      }
    } else {
      fastStreakRef.current = 0;
    }

    await proceedToNextOrFinish();
  };

  const startHumanHold = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isTrustedUserEvent(e)) {
      triggerViolation('automation_detected', 'Искусственное удержание кнопки проверки');
      return;
    }
    if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current);
    const startMs = Date.now();
    holdIntervalRef.current = window.setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - startMs) / 1200) * 100));
      setHumanHoldProgress(pct);
      if (pct >= 100) {
        if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        fastStreakRef.current = 0;
        setHumanChallengeOpen(false);
        setHumanHoldProgress(0);
        proceedToNextOrFinish();
      }
    }, 40);
  };

  const stopHumanHold = () => {
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHumanHoldProgress(0);
  };

  const groupNames = useMemo(() => roster.map((g) => g.name), [roster]);
  const userTestSessions = useMemo(() => {
    if (lockedStudent) {
      return sessions.filter(
        (s) =>
          (s.studentName === lockedStudent.studentName && s.group === lockedStudent.group) ||
          (studentSession?.id ? s.githubUid === studentSession.id : false)
      );
    }
    if (!firebaseUser?.uid) return sessions;
    return sessions.filter((s) => s.githubUid === firebaseUser.uid);
  }, [sessions, lockedStudent, studentSession?.id, firebaseUser?.uid]);

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
          questions={questions}
          projectGuide={projectGuide}
          gradebook={gradebook}
          allFeedback={allFeedback}
          bonusSubmissions={bonusSubmissions}
          wheelSpins={wheelSpins}
          studentAccounts={studentAccounts}
          missions={missions}
          customDocs={customDocs}
          globalTimer={globalTimer}
          adminLabel={userLabel}
          onGradebookChange={setGradebook}
          onBackToPortal={() => setView('course')}
          onEnterStudentView={toggleStudentPreview}
          onOpenSecondScreenInPlace={() => setView('monitor')}
          onOpenProjectGuide={() => setView('project')}
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

        {humanChallengeOpen && (
          <div className="fixed inset-0 z-50 bg-[#0B0F14]/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-xl border border-[#E5A454]/60 bg-[#1C1812] p-7 text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#2A2215] flex items-center justify-center text-[#E5A454]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#F3D3A7]">
                Проверка на живого пользователя
              </h2>
              <p className="text-xs text-[#C7B8A1] leading-relaxed">
                Ответы отправляются слишком быстро без естественного движения мыши. Удерживайте кнопку ниже 1.2 секунды, чтобы подтвердить, что тест проходите вы лично, а не скрипт.
              </p>
              <div className="h-2 rounded-full bg-[#262018] overflow-hidden">
                <div
                  className="h-full bg-[#9ED164] transition-all duration-75"
                  style={{ width: `${humanHoldProgress}%` }}
                />
              </div>
              <button
                type="button"
                onPointerDown={startHumanHold}
                onPointerUp={stopHumanHold}
                onPointerLeave={stopHumanHold}
                onPointerCancel={stopHumanHold}
                className="w-full py-3.5 rounded-lg bg-[#E5A454] text-[#1A1308] font-bold text-sm hover:bg-[#F0B86F] transition-colors cursor-pointer select-none"
              >
                Удерживайте кнопку (прогресс: {humanHoldProgress}%)
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
              <div className="space-y-2.5">
                <CanvasProtectedText
                  text={currentQuestion.title}
                  fontSize={20}
                  lineHeight={28}
                  fontWeight="700"
                  color="#F1F6FA"
                />
                <CanvasProtectedText
                  text={currentQuestion.desc}
                  fontSize={14}
                  lineHeight={21}
                  color="#A9B9C8"
                />
              </div>

              {currentQuestion.context && (
                <div className="p-3.5 rounded-lg border border-[#2A3744] bg-[#11171D]">
                  <CanvasProtectedText
                    text={currentQuestion.context}
                    fontSize={12}
                    lineHeight={19}
                    color="#C7D3DF"
                  />
                </div>
              )}

              <QuestionRenderer
                question={currentQuestion}
                value={currentValue}
                onChange={handleAnswerChange}
                protectedMode
                sessionSeed={testSessionSeed}
                onAutomationDetected={(reason) => triggerViolation('automation_detected', reason)}
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

  // 4. Unified Portal Shell (Start Page, Course Map, Project Guide, Lesson Reader, Test Start, Test Results, Bonus, ADHD, Casino)
  const activeHeaderSection =
    view === 'project'
      ? 'project'
      : view === 'test_start' || view === 'test_completed'
        ? 'test'
        : view === 'bonus'
          ? 'bonus'
          : view === 'adhd'
            ? 'adhd'
            : view === 'casino'
              ? 'casino'
              : 'course';

  return (
    <div className="min-h-screen bg-[#0F141A] text-[#E6EDF3] flex flex-col">
      <GlobalTimerOverlay timer={globalTimer} isAdmin={isAdmin} />

      <PortalHeader
        activeSection={activeHeaderSection}
        onNavigate={(sec) => {
          if (sec === 'test') setView('test_start');
          else if (sec === 'project') setView('project');
          else if (sec === 'bonus') setView('bonus');
          else if (sec === 'adhd') setView('adhd');
          else if (sec === 'casino') setView('casino');
          else setView('course');
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
        onSignIn={() => setView('course')}
        onSignOut={handleSignOut}
      />

      {/* Main Workspace */}
      <main className="flex-1">
        {view === 'bonus' ? (
          <BonusTaskView
            roster={roster}
            defaultStudentHint={studentViewMode ? null : firebaseUser?.displayName || null}
            lockedStudent={lockedStudent}
            isAdmin={isAdmin}
            bonusConfig={bonusConfig}
            bonusSubmissions={bonusSubmissions}
          />
        ) : view === 'adhd' ? (
          <AdhdZoneView missions={missions} />
        ) : view === 'casino' ? (
          <GradeCasinoView
            isSignedIn={isSignedIn}
            userUid={
              studentSession?.id ||
              (studentViewMode ? 'teacher_student_preview' : firebaseUser?.uid || null)
            }
            userName={userLabel}
            labsCount={gradebook.labsCount || 6}
            wheelSpins={wheelSpins}
            onSignIn={() => setView('course')}
            onOpenBonus={() => setView('bonus')}
            onOpenTests={() => setView('test_start')}
          />
        ) : view === 'project' ? (
          <ProjectGuideView
            guide={projectGuide}
            gradebook={gradebook}
            roster={roster}
            isAdmin={isAdmin}
            defaultStudentHint={studentViewMode ? null : firebaseUser?.displayName || null}
            lockedStudent={lockedStudent}
            onBack={() => setView('course')}
          />
        ) : view === 'course' && !isSignedIn && authInitialized ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 5 cols: Student Group + FIO + Password Login (and secondary Teacher Login) */}
              <div className="lg:col-span-5 space-y-3">
                {studentViewMode ? (
                  <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-7 space-y-4">
                    <div className="text-xs font-mono text-[#9ED164]">Предпросмотр гостя</div>
                    <h1 className="text-xl font-bold text-white">Экран входа студента</h1>
                    <p className="text-xs text-[#9FB0C0] leading-relaxed">
                      Студент выбирает группу и своё ФИО из списка и задаёт пароль при первом входе. Вы сейчас смотрите портал в режиме гостя.
                    </p>
                  </div>
                ) : (
                  <StudentLoginPanel
                    roster={roster}
                    accounts={studentAccounts}
                    authLoading={authLoading}
                    onStudentLoginSuccess={(sess) => setStudentSession(sess)}
                    onTeacherSignIn={handleGitHubSignIn}
                  />
                )}
              </div>

              {/* Right 7 cols: Tests Catalog & Scheduled Dates */}
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono text-[#E5A454]">Контроль знаний и расписание</div>
                  <h2 className="text-xl font-bold text-white">Тестирования по курсу</h2>
                  <p className="text-xs text-[#9FB0C0] leading-relaxed">
                    Здесь отображаются назначенные тесты и даты проведения для групп. Для прохождения войдите в свой аккаунт студента слева.
                  </p>
                </div>

                <TestCatalogGrid
                  tests={tests}
                  totalAvailableQuestions={questions.length}
                  onSelectTest={(t) => {
                    setPreselectedTestId(t.id);
                    setView('test_start');
                  }}
                />
              </div>
            </div>

            <ProjectGuideBanner
              guide={projectGuide}
              gradebook={gradebook}
              roster={roster}
              lockedStudent={lockedStudent}
              onOpenGuide={() => setView('project')}
            />
          </div>
        ) : view === 'course' ? (
          missionsError ? (
            <div className="max-w-xl mx-auto my-12 p-6 rounded-xl border border-[#E06C75]/50 bg-[#1B1417] text-center text-sm text-[#FFB8BE]">
              {missionsError}
            </div>
          ) : (
            <CoursePortalView
              missions={missions}
              fallbackName={userLabel}
              projectGuide={projectGuide}
              gradebook={gradebook}
              roster={roster}
              lockedStudent={lockedStudent}
              onOpenLesson={(docUrl) => {
                setActiveDoc(docUrl);
                setView('lesson');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenTest={() => setView('test_start')}
              onOpenProjectGuide={() => setView('project')}
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
          <div className="space-y-4">
            {automationBlockError && (
              <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
                <div className="p-4 rounded-xl border border-[#E06C75]/60 bg-[#2D181B] text-xs text-[#FFB8BE] flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#E06C75] shrink-0" />
                  <span>{automationBlockError}</span>
                </div>
              </div>
            )}
            <StartScreen
              tests={tests}
              roster={roster}
              totalQuestions={questions.length}
              initialTestId={preselectedTestId}
              defaultStudentHint={studentViewMode ? null : firebaseUser?.displayName || null}
              lockedStudent={lockedStudent}
              allowManualPick={isRealAdmin && (studentViewMode || !lockedStudent)}
              onRequireLogin={() => setView('course')}
              onStartTest={handleStartTest}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        displayName={userLabel}
        email={studentSession ? `Группа ${studentSession.group}` : firebaseUser?.email || ''}
        photoUrl={studentSession ? null : firebaseUser?.photoURL || null}
        missions={missions}
        gradebook={gradebook}
        roster={roster}
        testSessions={userTestSessions}
        lockedStudent={lockedStudent}
        onOpenProjectGuide={() => setView('project')}
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

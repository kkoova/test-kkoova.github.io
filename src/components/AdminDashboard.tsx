import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  GraduationCap,
  Lock,
  Maximize2,
  MessageSquare,
  Monitor,
  Plus,
  Presentation,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import { Question, QUESTIONS as DEFAULT_QUESTIONS } from '../data/questions';
import {
  BonusSubmission,
  deleteBonusSubmission,
  FeedbackEntry,
  GlobalTimerState,
  LessonData,
  Mission,
  stopGlobalTimer,
  triggerGlobalTimer,
  WheelSpinRecord,
} from '../services/courseService';
import {
  computeStudentSemesterSummary,
  formatGradeValue,
  formatScheduledDateRu,
  GradebookConfig,
  GradeValue,
  makeGradebookKey,
  normalizeStudentRecord,
  percentageToGrade5,
  ProjectGuideConfig,
  removeSession,
  saveGradebook,
  saveProjectGuide,
  saveQuestions,
  saveRoster,
  saveTestConfigs,
  StudentGradeRecord,
  StudentSession,
  SyncStatus,
  TestDefinition,
  ViolationEvent,
} from '../services/telemetryService';
import { QuestionEditorModal } from './QuestionEditorModal';
import { MissionEditorPanel } from './MissionEditorPanel';

interface AdminDashboardProps {
  sessions: StudentSession[];
  violations: ViolationEvent[];
  syncStatus: SyncStatus;
  roster: GroupRoster[];
  tests: TestDefinition[];
  questions: Question[];
  projectGuide: ProjectGuideConfig;
  gradebook: GradebookConfig;
  allFeedback: FeedbackEntry[];
  bonusSubmissions: BonusSubmission[];
  wheelSpins: WheelSpinRecord[];
  missions: Mission[];
  customDocs: Record<string, LessonData>;
  globalTimer: GlobalTimerState | null;
  adminLabel: string;
  onGradebookChange: (next: GradebookConfig) => void;
  onBackToPortal: () => void;
  onEnterStudentView: () => void;
  onOpenSecondScreenInPlace: () => void;
  onOpenProjectGuide: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  sessions,
  violations,
  syncStatus,
  roster,
  tests,
  questions,
  projectGuide,
  gradebook,
  allFeedback,
  bonusSubmissions,
  wheelSpins,
  missions,
  customDocs,
  globalTimer,
  adminLabel,
  onGradebookChange,
  onBackToPortal,
  onEnterStudentView,
  onOpenSecondScreenInPlace,
  onOpenProjectGuide,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'schedule' | 'course' | 'missions' | 'roster' | 'questions'>('live');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'violations'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<StudentSession | null>(null);

  // Roster state
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedRosterGroupId, setSelectedRosterGroupId] = useState<string>(roster[0]?.id || '');
  const [bulkStudentsText, setBulkStudentsText] = useState('');
  const [rosterSaveMsg, setRosterSaveMsg] = useState<string | null>(null);
  const [showRulesHelp, setShowRulesHelp] = useState(false);

  // Global timer form
  const [timerMinutes, setTimerMinutes] = useState<number>(15);
  const [timerGoalsText, setTimerGoalsText] = useState<string>(
    'Завершить текущую миссию\nОтправить ссылку на GitHub'
  );
  const [timerMsg, setTimerMsg] = useState<string | null>(null);

  // Test creation & schedule state
  const [showNewTestForm, setShowNewTestForm] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestDesc, setNewTestDesc] = useState('');
  const [newTestDuration, setNewTestDuration] = useState<number>(20);
  const [newTestSections, setNewTestSections] = useState<string[]>([]);
  const [testsSaveMsg, setTestsSaveMsg] = useState<string | null>(null);

  // Question Constructor state
  const [qSearch, setQSearch] = useState('');
  const [qSectionFilter, setQSectionFilter] = useState('all');
  const [editingQuestion, setEditingQuestion] = useState<Question | null | 'new'>(null);
  const [qSaveMsg, setQSaveMsg] = useState<string | null>(null);
  const [confirmResetQ, setConfirmResetQ] = useState(false);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const [guideSaveMsg, setGuideSaveMsg] = useState<string | null>(null);

  // Gradebook tab state
  const [gradebookGroupId, setGradebookGroupId] = useState<string>(roster[0]?.id || '');
  const [gradebookSearch, setGradebookSearch] = useState<string>('');
  const [gradebookMsg, setGradebookMsg] = useState<string | null>(null);

  const allQuestionSections = useMemo(
    () => Array.from(new Set(questions.map((q) => q.section))),
    [questions]
  );

  const filteredQuestions = useMemo(() => {
    const query = qSearch.trim().toLowerCase();
    return questions.filter((q) => {
      if (qSectionFilter !== 'all' && q.section !== qSectionFilter) return false;
      if (
        query &&
        !q.title.toLowerCase().includes(query) &&
        !q.desc.toLowerCase().includes(query) &&
        !q.section.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [questions, qSearch, qSectionFilter]);

  const nextQuestionId = useMemo(
    () => questions.reduce((max, q) => Math.max(max, q.id), 0) + 1,
    [questions]
  );

  const persistQuestions = async (next: Question[], msg: string) => {
    try {
      await saveQuestions(next);
      setQSaveMsg(msg);
    } catch {
      setQSaveMsg('Сохранено локально (проверьте права записи Firestore для вопросов).');
    }
    window.setTimeout(() => setQSaveMsg(null), 4000);
  };

  const handleSaveQuestionFromModal = async (saved: Question) => {
    const exists = questions.some((q) => q.id === saved.id);
    const next = exists
      ? questions.map((q) => (q.id === saved.id ? saved : q))
      : [...questions, saved];
    setEditingQuestion(null);
    await persistQuestions(
      next,
      exists ? `Задание #${saved.id} обновлено.` : `Добавлено новое задание #${saved.id}.`
    );
  };

  const handleDuplicateQuestion = async (q: Question) => {
    const clone: Question = {
      ...q,
      id: nextQuestionId,
      title: `${q.title} (копия)`,
    };
    const next = [...questions, clone];
    await persistQuestions(next, `Создана копия задания #${clone.id}.`);
  };

  const handleDeleteQuestion = async (id: number) => {
    if (questions.length <= 1) return;
    const next = questions.filter((q) => q.id !== id);
    await persistQuestions(next, `Задание #${id} удалено.`);
  };

  const handleExportQuestionsJson = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `godot-questions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportQuestionsJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setQSaveMsg('Ошибка: JSON-файл не содержит массив вопросов.');
        return;
      }
      await persistQuestions(parsed as Question[], `Импортировано вопросов: ${parsed.length}.`);
    } catch {
      setQSaveMsg('Ошибка чтения JSON-файла.');
    } finally {
      e.target.value = '';
    }
  };

  const handleUpdateDefenseDate = async (
    groupName: string,
    patch: { date?: string; note?: string }
  ) => {
    const current = projectGuide.groupDates?.[groupName] || { date: '', note: '' };
    const next: ProjectGuideConfig = {
      ...projectGuide,
      groupDates: {
        ...(projectGuide.groupDates || {}),
        [groupName]: { ...current, ...patch },
      },
    };
    try {
      await saveProjectGuide(next);
      setGuideSaveMsg(`Дата защиты для «${groupName}» обновлена.`);
    } catch {
      setGuideSaveMsg('Сохранено локально (проверьте права записи Firestore).');
    }
    window.setTimeout(() => setGuideSaveMsg(null), 3500);
  };

  const persistTests = async (next: TestDefinition[], msg: string) => {
    try {
      await saveTestConfigs(next);
      setTestsSaveMsg(msg);
    } catch {
      setTestsSaveMsg('Сохранено локально (проверьте права записи Firestore для настроек теста).');
    }
    window.setTimeout(() => setTestsSaveMsg(null), 4000);
  };

  const handleToggleGlobalTestLock = async (testId: string) => {
    const target = tests.find((t) => t.id === testId);
    if (!target) return;
    const nextUnlocked = !target.isUnlocked;
    const next = tests.map((t) => (t.id === testId ? { ...t, isUnlocked: nextUnlocked } : t));
    await persistTests(
      next,
      nextUnlocked
        ? `Тест «${target.title}» разблокирован для всех групп.`
        : `Общая разблокировка теста «${target.title}» снята.`
    );
  };

  const handleUpdateTestDuration = async (testId: string, minutes: number) => {
    const clamped = Math.max(1, Math.min(180, Math.round(minutes) || 1));
    const next = tests.map((t) => (t.id === testId ? { ...t, durationMinutes: clamped } : t));
    await persistTests(next, `Таймер обновлён: ${clamped} мин.`);
  };

  const handleUpdateGroupSchedule = async (
    testId: string,
    groupName: string,
    patch: { assigned?: boolean; scheduledAt?: string; unlocked?: boolean },
    msg: string
  ) => {
    const next = tests.map((t) => {
      if (t.id !== testId) return t;
      const current = t.groupSchedules?.[groupName] || {
        assigned: false,
        scheduledAt: '',
        unlocked: false,
      };
      return {
        ...t,
        groupSchedules: {
          ...(t.groupSchedules || {}),
          [groupName]: { ...current, ...patch },
        },
      };
    });
    await persistTests(next, msg);
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTestTitle.trim();
    if (!title) return;
    const selectedQIds =
      newTestSections.length === 0
        ? []
        : questions.filter((q) => newTestSections.includes(q.section)).map((q) => q.id);

    const created: TestDefinition = {
      id: `test_${Date.now()}`,
      title,
      description:
        newTestDesc.trim() ||
        `Тестовое задание (${selectedQIds.length || questions.length} вопросов).`,
      durationMinutes: Math.max(1, Math.min(180, Number(newTestDuration) || 20)),
      questionIds: selectedQIds,
      isUnlocked: false,
      defaultScheduledAt: '',
      groupSchedules: {},
    };
    const next = [...tests, created];
    setNewTestTitle('');
    setNewTestDesc('');
    setNewTestDuration(20);
    setNewTestSections([]);
    setShowNewTestForm(false);
    await persistTests(next, `Тест «${created.title}» создан (по умолчанию заблокирован).`);
  };

  const handleDeleteTest = async (testId: string) => {
    if (tests.length <= 1) return;
    const next = tests.filter((t) => t.id !== testId);
    await persistTests(next, 'Тест удалён.');
  };

  const activeGradebookGroup =
    roster.find((g) => g.id === gradebookGroupId) || roster[0] || null;

  const persistGradebook = async (next: GradebookConfig, msg?: string) => {
    onGradebookChange(next);
    try {
      await saveGradebook(next);
      if (msg) setGradebookMsg(msg);
    } catch {
      if (msg) setGradebookMsg(`${msg} (локально)`);
    }
    if (msg) {
      window.setTimeout(() => setGradebookMsg(null), 3500);
    }
  };

  const updateStudentGradeField = async (
    groupName: string,
    studentName: string,
    updater: (rec: StudentGradeRecord) => StudentGradeRecord
  ) => {
    const labsTotal = Math.max(1, gradebook.labsCount || 6);
    const key = makeGradebookKey(groupName, studentName);
    const current = normalizeStudentRecord(gradebook.records[key], labsTotal);
    const updated = updater(current);
    const next: GradebookConfig = {
      ...gradebook,
      records: {
        ...gradebook.records,
        [key]: updated,
      },
    };
    await persistGradebook(next);
  };

  const parseGradeSelect = (raw: string): GradeValue => {
    if (raw === 'pass') return 'pass';
    if (raw === '5' || raw === '4' || raw === '3' || raw === '2') return Number(raw) as 2 | 3 | 4 | 5;
    return null;
  };

  const encodeGradeSelect = (val: GradeValue): string => {
    if (val === 'pass') return 'pass';
    if (val === null || val === undefined) return '';
    return String(val);
  };

  const handlePullTestScores = async () => {
    if (!activeGradebookGroup) return;
    const labsTotal = Math.max(1, gradebook.labsCount || 6);
    const nextRecords = { ...gradebook.records };
    let updatedCount = 0;

    for (const studentName of activeGradebookGroup.students) {
      const key = makeGradebookKey(activeGradebookGroup.name, studentName);
      const rec = normalizeStudentRecord(nextRecords[key], labsTotal);
      const studentSessions = sessions.filter(
        (s) =>
          s.status === 'completed' &&
          s.group === activeGradebookGroup.name &&
          s.studentName === studentName &&
          s.percentage !== null
      );
      if (studentSessions.length === 0) continue;

      let changed = false;
      if (gradebook.midtermTestId) {
        const matched = studentSessions
          .filter((s) => (s.testId || 'godot-core-1') === gradebook.midtermTestId)
          .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
        if (matched && matched.percentage !== null) {
          rec.midtermTest = percentageToGrade5(matched.percentage);
          changed = true;
        }
      }
      if (gradebook.finalTestId) {
        const matched = studentSessions
          .filter((s) => (s.testId || 'godot-core-1') === gradebook.finalTestId)
          .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
        if (matched && matched.percentage !== null) {
          rec.finalTest = percentageToGrade5(matched.percentage);
          changed = true;
        }
      }

      if (!gradebook.midtermTestId && !gradebook.finalTestId) {
        const best = studentSessions.sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
        if (best && best.percentage !== null) {
          rec.midtermTest = percentageToGrade5(best.percentage);
          changed = true;
        }
      }

      if (changed) {
        nextRecords[key] = rec;
        updatedCount++;
      }
    }

    await persistGradebook(
      { ...gradebook, records: nextRecords },
      updatedCount > 0
        ? `Обновлены оценки по тестам для ${updatedCount} студентов группы.`
        : 'Подходящих завершённых тестов для этой группы пока нет.'
    );
  };

  const handleExportGradebookCsv = () => {
    if (!activeGradebookGroup) return;
    const labsTotal = Math.max(1, gradebook.labsCount || 6);
    const labHeaders = Array.from({ length: labsTotal }, (_, i) => `Лаб ${i + 1}`);
    const headers = [
      'Студент',
      'Группа',
      ...labHeaders,
      'Промеж. тест',
      'Посещаемость (%)',
      'Статус итогового теста',
      'Итоговый тест',
      'Предзащита проекта',
      'Оценка за семестр',
    ];
    const rows = activeGradebookGroup.students.map((st) => {
      const rec = normalizeStudentRecord(
        gradebook.records[makeGradebookKey(activeGradebookGroup.name, st)],
        labsTotal
      );
      const sum = computeStudentSemesterSummary(rec, gradebook);
      const finalReqLabel =
        sum.needsFinalTest === null
          ? 'Не указана посещ.'
          : sum.needsFinalTest
            ? 'Сдаёт (низкая посещ.)'
            : 'Освобождён';
      return [
        st,
        activeGradebookGroup.name,
        ...rec.labs.map((l) => formatGradeValue(l)),
        formatGradeValue(rec.midtermTest),
        rec.attendance !== null ? `${rec.attendance}%` : '—',
        finalReqLabel,
        sum.needsFinalTest === false ? 'Освобождён' : formatGradeValue(rec.finalTest),
        formatGradeValue(rec.projectDefense),
        sum.semesterGradeLabel,
      ];
    });
    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vedomost-${activeGradebookGroup.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupNames = useMemo(() => {
    const set = new Set<string>(roster.map((g) => g.name));
    sessions.forEach((s) => set.add(s.group));
    return Array.from(set);
  }, [roster, sessions]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (groupFilter !== 'all' && s.group !== groupFilter) return false;
      if (statusFilter === 'active' && s.status === 'completed') return false;
      if (statusFilter === 'completed' && s.status !== 'completed') return false;
      if (statusFilter === 'violations' && s.violationsCount === 0) return false;
      if (
        q &&
        !s.studentName.toLowerCase().includes(q) &&
        !s.group.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [sessions, groupFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const active = filteredSessions.filter((s) => s.status !== 'completed').length;
    const completed = filteredSessions.filter((s) => s.status === 'completed');
    const avgScore =
      completed.length > 0
        ? Math.round(
            completed.reduce((acc, s) => acc + (s.percentage ?? 0), 0) / completed.length
          )
        : null;
    const totalViolations = filteredSessions.reduce((acc, s) => acc + s.violationsCount, 0);
    return { active, completedCount: completed.length, avgScore, totalViolations };
  }, [filteredSessions]);

  const exportCsv = () => {
    const headers = [
      'Студент',
      'Группа',
      'Статус',
      'Прогресс',
      'Правильных',
      'Всего',
      'Процент',
      'Оценка',
      'Нарушения',
    ];
    const rows = filteredSessions.map((s) => [
      s.studentName,
      s.group,
      s.status === 'completed'
        ? 'Завершил'
        : s.status === 'violation_paused'
          ? 'Нарушение'
          : 'В процессе',
      `${s.currentQuestion}/${s.totalQuestions}`,
      s.score ?? '',
      s.totalQuestions,
      s.percentage !== null ? `${s.percentage}%` : '',
      s.gradeLabel ?? '',
      s.violationsCount,
    ]);
    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `godot-test-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeRosterGroup =
    roster.find((g) => g.id === selectedRosterGroupId) || roster[0] || null;

  const persistRoster = async (next: GroupRoster[], msg: string) => {
    try {
      await saveRoster(next);
      setRosterSaveMsg(msg);
    } catch {
      setRosterSaveMsg('Сохранено локально (проверьте права записи Firestore для списка групп).');
    }
    window.setTimeout(() => setRosterSaveMsg(null), 4000);
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    const id = `grp_${Date.now()}`;
    const next = [...roster, { id, name: trimmed, students: [] }];
    setNewGroupName('');
    setSelectedRosterGroupId(id);
    await persistRoster(next, `Группа «${trimmed}» добавлена.`);
  };

  const handleDeleteGroup = async (id: string) => {
    const next = roster.filter((g) => g.id !== id);
    if (selectedRosterGroupId === id) {
      setSelectedRosterGroupId(next[0]?.id || '');
    }
    await persistRoster(next, 'Группа удалена.');
  };

  const handleAddStudentsBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRosterGroup) return;
    const names = bulkStudentsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    const existing = new Set(activeRosterGroup.students);
    names.forEach((n) => existing.add(n));
    const merged = Array.from(existing).sort((a, b) => a.localeCompare(b, 'ru'));

    const next = roster.map((g) =>
      g.id === activeRosterGroup.id ? { ...g, students: merged } : g
    );
    setBulkStudentsText('');
    await persistRoster(next, `Список группы «${activeRosterGroup.name}» обновлён.`);
  };

  const handleRemoveStudent = async (groupId: string, studentName: string) => {
    const next = roster.map((g) =>
      g.id === groupId
        ? { ...g, students: g.students.filter((st) => st !== studentName) }
        : g
    );
    await persistRoster(next, `Студент «${studentName}» удалён.`);
  };

  const handleStartGlobalTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    const goals = timerGoalsText
      .split(/\r?\n/)
      .map((g) => g.trim())
      .filter(Boolean);
    try {
      await triggerGlobalTimer(timerMinutes, goals);
      setTimerMsg('Глобальный таймер запущен для всех студентов.');
    } catch {
      setTimerMsg('Ошибка запуска таймера в Firestore (проверьте права доступа).');
    }
    window.setTimeout(() => setTimerMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#0F141A] text-[#E6EDF3] flex flex-col">
      <header className="border-b border-[#222D38] bg-[#131A22] px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBackToPortal}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[#324252] bg-[#161F28] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>На портал</span>
            </button>
            <div>
              <div className="text-xs font-mono text-[#9ED164]">
                Панель преподавателя · {adminLabel}
              </div>
              <h1 className="text-lg font-bold text-white">Управление курсом и тестом</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onEnterStudentView}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#344656] bg-[#161F28] text-xs font-medium text-[#E6EDF3] hover:border-[#9ED164] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#E5A454]" />
              <span>Войти как студент</span>
            </button>
            <a
              href="?view=monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors whitespace-nowrap shrink-0"
            >
              <Monitor className="w-4 h-4" />
              <span>Открыть 2-й экран (новое окно)</span>
            </a>
            <button
              type="button"
              onClick={onOpenSecondScreenInPlace}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#344656] bg-[#161F28] text-xs font-medium text-[#E6EDF3] hover:border-[#9ED164] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Режим 2-го экрана здесь</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-[#222D38] bg-[#11171E] px-6">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 overflow-x-auto">
          <nav className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'live'
                  ? 'border-[#9ED164] text-[#9ED164]'
                  : 'border-transparent text-[#8EA0B0] hover:text-white'
              }`}
            >
              Тест: статистика и нарушения
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'schedule'
                  ? 'border-[#9ED164] text-[#9ED164]'
                  : 'border-transparent text-[#8EA0B0] hover:text-white'
              }`}
            >
              Доступ и расписание тестов ({tests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('course')}
              className={`py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'course'
                  ? 'border-[#9ED164] text-[#9ED164]'
                  : 'border-transparent text-[#8EA0B0] hover:text-white'
              }`}
            >
              Ведомость, зачёт и таймер
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('missions')}
              className={`py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'missions'
                  ? 'border-[#9ED164] text-[#9ED164]'
                  : 'border-transparent text-[#8EA0B0] hover:text-white'
              }`}
            >
              Редактор миссий ({missions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'roster'
                  ? 'border-[#9ED164] text-[#9ED164]'
                  : 'border-transparent text-[#8EA0B0] hover:text-white'
              }`}
            >
              Группы и студенты ({roster.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'questions'
                  ? 'border-[#9ED164] text-[#9ED164]'
                  : 'border-transparent text-[#8EA0B0] hover:text-white'
              }`}
            >
              Конструктор вопросов ({questions.length})
            </button>
          </nav>

          <div className="flex items-center gap-2 text-xs font-mono shrink-0 py-2">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'connected' ? 'bg-[#9ED164]' : 'bg-[#E5A454]'
              }`}
              aria-hidden="true"
            />
            <span className="text-[#8EA0B0]">
              {syncStatus === 'connected'
                ? 'Firestore подключён'
                : syncStatus === 'permission_denied'
                  ? 'Только локальный канал (правила Firestore)'
                  : 'Локальный канал активен'}
            </span>
            {syncStatus === 'permission_denied' && (
              <button
                type="button"
                onClick={() => setShowRulesHelp((v) => !v)}
                className="text-[#E5A454] underline ml-1 cursor-pointer"
              >
                Как настроить?
              </button>
            )}
          </div>
        </div>
      </div>

      {showRulesHelp && (
        <div className="bg-[#1C1812] border-b border-[#E5A454]/40 px-6 py-4">
          <div className="max-w-[1400px] mx-auto text-xs text-[#EBD7B7] space-y-2">
            <div className="font-semibold text-[#E5A454]">
              Чтобы данные синхронизировались между устройствами через Firebase it-course-lele:
            </div>
            <p>
              Откройте Firebase Console → Firestore Database → Rules и разрешите доступ для коллекций теста:
            </p>
            <pre className="bg-[#0F141A] p-3 rounded border border-[#344656] font-mono text-[11px] overflow-x-auto text-[#CBEF9C]">
{`match /godot_test_sessions/{docId} { allow read, write: if true; }
match /godot_test_violations/{docId} { allow read, write: if true; }
match /godot_test_config/{docId} { allow read: if true; allow write: if request.auth != null && request.auth.uid == "A4x3C68w2tSp65CplZgxEflCeVh1"; }`}
            </pre>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-6">
        {/* TAB 1: Live Test Stats & Violations */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-[#24303C] bg-[#161E27]">
                <div className="text-xs text-[#8EA0B0] mb-1">Активных сейчас</div>
                <div className="text-2xl font-bold font-mono text-[#7CC4FA] tabular-nums">
                  {stats.active}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-[#24303C] bg-[#161E27]">
                <div className="text-xs text-[#8EA0B0] mb-1">Завершили тест</div>
                <div className="text-2xl font-bold font-mono text-[#9ED164] tabular-nums">
                  {stats.completedCount}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-[#24303C] bg-[#161E27]">
                <div className="text-xs text-[#8EA0B0] mb-1">Средний балл</div>
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
                </div>
              </div>
              <div className="p-4 rounded-xl border border-[#24303C] bg-[#161E27]">
                <div className="text-xs text-[#8EA0B0] mb-1">Зафиксировано нарушений</div>
                <div
                  className={`text-2xl font-bold font-mono tabular-nums ${
                    stats.totalViolations > 0 ? 'text-[#E06C75]' : 'text-[#9ED164]'
                  }`}
                >
                  {stats.totalViolations}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6C7E8E] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по имени..."
                    className="bg-[#161E27] border border-[#2A3744] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                  />
                </div>

                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="bg-[#161E27] border border-[#2A3744] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                >
                  <option value="all">Все группы</option>
                  {groupNames.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                <div className="inline-flex p-1 rounded-lg bg-[#161E27] border border-[#2A3744]">
                  {(
                    [
                      ['all', 'Все'],
                      ['active', 'В процессе'],
                      ['completed', 'Завершили'],
                      ['violations', 'С нарушениями'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStatusFilter(val)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                        statusFilter === val
                          ? 'bg-[#253240] text-white'
                          : 'text-[#8EA0B0] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={exportCsv}
                disabled={filteredSessions.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#344656] bg-[#161E27] text-xs font-medium text-[#E6EDF3] hover:border-[#9ED164] transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 rounded-xl border border-[#24303C] bg-[#161E27] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#24303C] bg-[#121820] text-[11px] font-mono text-[#8EA0B0]">
                        <th className="py-3 px-4 font-medium">Студент</th>
                        <th className="py-3 px-4 font-medium">Группа</th>
                        <th className="py-3 px-4 font-medium">Статус</th>
                        <th className="py-3 px-4 font-medium text-right">Прогресс</th>
                        <th className="py-3 px-4 font-medium text-right">Результат</th>
                        <th className="py-3 px-4 font-medium text-right">Нарушения</th>
                        <th className="py-3 px-4 font-medium text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2A35] text-xs">
                      {filteredSessions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-[#7C8D9C]">
                            Нет данных по выбранным фильтрам.
                          </td>
                        </tr>
                      ) : (
                        filteredSessions.map((s) => (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedSession(s)}
                            className="hover:bg-[#1C2632] transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{s.studentName}</div>
                              {s.testTitle && (
                                <div className="text-[11px] text-[#7C8D9C] truncate max-w-[200px]">
                                  {s.testTitle}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#9FB0C0]">{s.group}</td>
                            <td className="py-3 px-4">
                              {s.status === 'violation_paused' && (
                                <span className="inline-flex items-center gap-1 text-[#FFB8BE] font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5 text-[#E06C75]" />
                                  Нарушение
                                </span>
                              )}
                              {s.status === 'in_progress' && (
                                <span className="text-[#7CC4FA] font-medium">В процессе</span>
                              )}
                              {s.status === 'completed' && (
                                <span className="text-[#9ED164] font-medium">
                                  {s.timedOut ? 'Завершил (таймер)' : 'Завершил'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-[#D7E0E8]">
                              {s.currentQuestion}/{s.totalQuestions}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                              {s.percentage !== null ? (
                                <span
                                  className={
                                    s.percentage >= 50 ? 'text-[#9ED164]' : 'text-[#E06C75]'
                                  }
                                >
                                  {s.score}/{s.totalQuestions} ({s.percentage}%)
                                </span>
                              ) : (
                                <span className="text-[#6C7E8E]">—</span>
                              )}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                                s.violationsCount > 0 ? 'text-[#E06C75]' : 'text-[#8EA0B0]'
                              }`}
                            >
                              {s.violationsCount}
                            </td>
                            <td
                              className="py-3 px-4 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => removeSession(s.id)}
                                title="Удалить запись"
                                className="p-1.5 rounded text-[#7C8D9C] hover:text-[#E06C75] hover:bg-[#2D181B] transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="xl:col-span-4 rounded-xl border border-[#422328] bg-[#161216] flex flex-col overflow-hidden max-h-[540px]">
                <div className="px-4 py-3.5 border-b border-[#2F1D21] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#FFB8BE]">
                    <ShieldAlert className="w-4 h-4 text-[#E06C75]" />
                    <span>Журнал нарушений</span>
                  </div>
                  <span className="font-mono text-xs text-[#C78C92] tabular-nums">
                    {violations.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[#28191C]">
                  {violations.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#8EA0B0]">
                      Нарушений пока нет. Попытки покинуть окно теста появятся здесь мгновенно.
                    </div>
                  ) : (
                    violations.map((v) => (
                      <div key={v.id} className="px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-white">{v.studentName}</span>
                          <span className="font-mono text-[#E5A454] tabular-nums">
                            {v.timestamp}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9FB0C0]">
                          {v.group} · Вопрос {v.questionNumber}
                        </div>
                        <div className="text-xs text-[#FFB8BE]">{v.label}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1.5: Test Access, Group Scheduling & Timer */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Управление тестами, таймером и датами по группам
                </h2>
                <p className="text-xs text-[#9FB0C0] mt-0.5">
                  По умолчанию тесты заблокированы. Назначьте дату проведения для каждой группы и нажимайте «Разблокировать», когда группа готова к началу работы.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewTestForm((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{showNewTestForm ? 'Скрыть форму' : 'Добавить новый тест'}</span>
              </button>
            </div>

            {testsSaveMsg && (
              <div className="p-3 rounded-lg border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
                {testsSaveMsg}
              </div>
            )}

            {showNewTestForm && (
              <form
                onSubmit={handleCreateTest}
                className="p-5 rounded-xl border border-[#344656] bg-[#161E27] space-y-4"
              >
                <h3 className="text-sm font-bold text-white">Создание нового теста</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                      Название теста
                    </label>
                    <input
                      type="text"
                      required
                      value={newTestTitle}
                      onChange={(e) => setNewTestTitle(e.target.value)}
                      placeholder="Например: Рубежный контроль №2 — Физика и UI"
                      className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                      Таймер на прохождение (мин)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={newTestDuration}
                      onChange={(e) => setNewTestDuration(Number(e.target.value) || 20)}
                      className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                    Описание для студентов
                  </label>
                  <input
                    type="text"
                    value={newTestDesc}
                    onChange={(e) => setNewTestDesc(e.target.value)}
                    placeholder="Кратко укажите темы, входящие в этот тест"
                    className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                  />
                </div>

                <div>
                  <div className="text-xs font-mono text-[#8EA0B0] mb-2">
                    Разделы вопросов (если не выбрано ничего — включаются все {questions.length} заданий)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {allQuestionSections.map((sec) => {
                      const checked = newTestSections.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() =>
                            setNewTestSections((prev) =>
                              prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
                            )
                          }
                          className={`px-3 py-2 rounded-md border text-left text-xs transition-colors cursor-pointer ${
                            checked
                              ? 'bg-[#213124] border-[#9ED164] text-[#CBEF9C]'
                              : 'bg-[#11171D] border-[#24303C] text-[#9FB0C0] hover:border-[#45586B]'
                          }`}
                        >
                          {sec}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewTestForm(false)}
                    className="px-4 py-2 rounded-md border border-[#344656] text-xs text-[#9FB0C0] hover:text-white cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
                  >
                    Создать тест
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-5">
              {tests.map((test) => {
                const qCount =
                  test.questionIds.length > 0 ? test.questionIds.length : questions.length;

                return (
                  <div
                    key={test.id}
                    className="rounded-xl border border-[#2A3744] bg-[#161E27] overflow-hidden"
                  >
                    <div className="p-5 border-b border-[#24303C] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                          <span className="text-[#9ED164]">{qCount} заданий</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              test.isUnlocked ? 'text-[#9ED164]' : 'text-[#E5A454]'
                            }
                          >
                            {test.isUnlocked
                              ? 'Открыт для всех групп'
                              : 'Общий доступ закрыт (по расписанию / кнопке)'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">{test.title}</h3>
                        <p className="text-xs text-[#9FB0C0]">{test.description}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[#2A3744] bg-[#11171D] text-xs">
                          <Clock className="w-3.5 h-3.5 text-[#E5A454]" />
                          <span className="text-[#8EA0B0]">Таймер (мин):</span>
                          <input
                            type="number"
                            min={1}
                            max={180}
                            value={test.durationMinutes}
                            onChange={(e) =>
                              handleUpdateTestDuration(test.id, Number(e.target.value))
                            }
                            className="w-14 bg-[#0F141A] border border-[#344656] rounded px-2 py-0.5 text-xs font-mono text-white text-center focus:outline-none focus:border-[#9ED164]"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => handleToggleGlobalTestLock(test.id)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                            test.isUnlocked
                              ? 'border border-[#E5A454] bg-[#251E15] text-[#F3D3A7] hover:bg-[#33291D]'
                              : 'bg-[#9ED164] text-[#111912] hover:bg-[#B4E07F]'
                          }`}
                        >
                          {test.isUnlocked ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Заблокировать для всех</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Разблокировать для всех</span>
                            </>
                          )}
                        </button>

                        {tests.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTest(test.id)}
                            title="Удалить тест"
                            className="p-2 rounded-md border border-[#2A3744] text-[#7C8D9C] hover:text-[#E06C75] hover:border-[#E06C75]/40 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Per-group schedule table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#24303C] bg-[#121820] text-[11px] font-mono text-[#8EA0B0]">
                            <th className="py-2.5 px-5 font-medium">Группа</th>
                            <th className="py-2.5 px-4 font-medium">Назначить тест</th>
                            <th className="py-2.5 px-4 font-medium">Дата и время проведения</th>
                            <th className="py-2.5 px-4 font-medium">Как видит студент</th>
                            <th className="py-2.5 px-5 font-medium text-right">Доступ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1F2A35] text-xs">
                          {roster.map((grp) => {
                            const gs = test.groupSchedules?.[grp.name] || {
                              assigned: false,
                              scheduledAt: '',
                              unlocked: false,
                            };
                            const isOpenForGroup = test.isUnlocked || gs.unlocked;

                            return (
                              <tr key={grp.id} className="hover:bg-[#1A2430]">
                                <td className="py-3 px-5 font-semibold text-white">
                                  {grp.name}
                                </td>
                                <td className="py-3 px-4">
                                  <label className="inline-flex items-center gap-2 cursor-pointer text-[#D7E0E8]">
                                    <input
                                      type="checkbox"
                                      checked={gs.assigned}
                                      onChange={(e) =>
                                        handleUpdateGroupSchedule(
                                          test.id,
                                          grp.name,
                                          { assigned: e.target.checked },
                                          e.target.checked
                                            ? `Тест назначен группе «${grp.name}».`
                                            : `Назначение для группы «${grp.name}» снято.`
                                        )
                                      }
                                      className="accent-[#9ED164] w-4 h-4 rounded"
                                    />
                                    <span>Показывать в расписании</span>
                                  </label>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <CalendarClock className="w-3.5 h-3.5 text-[#8EA0B0] shrink-0" />
                                    <input
                                      type="datetime-local"
                                      value={gs.scheduledAt}
                                      onChange={(e) =>
                                        handleUpdateGroupSchedule(
                                          test.id,
                                          grp.name,
                                          {
                                            assigned: e.target.value ? true : gs.assigned,
                                            scheduledAt: e.target.value,
                                          },
                                          e.target.value
                                            ? `Дата для «${grp.name}» установлена: ${formatScheduledDateRu(e.target.value)}`
                                            : `Дата для «${grp.name}» очищена.`
                                        )
                                      }
                                      className="bg-[#0F141A] border border-[#344656] rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                                    />
                                    {gs.scheduledAt && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateGroupSchedule(
                                            test.id,
                                            grp.name,
                                            { scheduledAt: '' },
                                            `Дата для «${grp.name}» сброшена.`
                                          )
                                        }
                                        className="text-[#7C8D9C] hover:text-white cursor-pointer"
                                        title="Очистить дату"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px]">
                                  {isOpenForGroup ? (
                                    <span className="text-[#9ED164]">
                                      Открыт{gs.scheduledAt ? ` (${formatScheduledDateRu(gs.scheduledAt)})` : ''}
                                    </span>
                                  ) : gs.scheduledAt ? (
                                    <span className="text-[#E5A454]">
                                      Будет {formatScheduledDateRu(gs.scheduledAt)} (Закрыт)
                                    </span>
                                  ) : (
                                    <span className="text-[#7C8D9C]">Заблокирован</span>
                                  )}
                                </td>
                                <td className="py-3 px-5 text-right">
                                  <button
                                    type="button"
                                    disabled={test.isUnlocked}
                                    onClick={() =>
                                      handleUpdateGroupSchedule(
                                        test.id,
                                        grp.name,
                                        { unlocked: !gs.unlocked },
                                        !gs.unlocked
                                          ? `Доступ для группы «${grp.name}» разблокирован.`
                                          : `Доступ для группы «${grp.name}» закрыт.`
                                      )
                                    }
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                                      gs.unlocked
                                        ? 'border border-[#E5A454]/60 bg-[#251E15] text-[#F3D3A7] hover:bg-[#33291D]'
                                        : 'bg-[#213124] border border-[#5D8247] text-[#CBEF9C] hover:bg-[#9ED164] hover:text-[#111912]'
                                    }`}
                                  >
                                    {gs.unlocked ? (
                                      <>
                                        <Lock className="w-3 h-3" />
                                        <span>Закрыть</span>
                                      </>
                                    ) : (
                                      <>
                                        <Unlock className="w-3 h-3" />
                                        <span>Разблокировать</span>
                                      </>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Winter Semester Gradebook, Attendance, Defense Dates & Classroom Timer */}
        {activeTab === 'course' && (
          <div className="space-y-6">
            {/* Full-Width Group Gradebook Card */}
            <div className="rounded-xl border border-[#24303C] bg-[#161E27] overflow-hidden">
              <div className="p-5 border-b border-[#24303C] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164] mb-1">
                    <GraduationCap className="w-4 h-4" />
                    <span>{gradebook.semesterLabel} · Успеваемость и допуск</span>
                  </div>
                  <h2 className="text-base font-bold text-white">
                    Ведомость студентов по группам
                  </h2>
                  <p className="text-xs text-[#9FB0C0] mt-0.5">
                    Выставляйте оценки за 6 лаб, промежуточный тест, предзащиту и % посещаемости — необходимость итогового теста №2 и итоговая оценка считаются автоматически.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePullTestScores}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#11171D] text-xs font-medium text-[#CBEF9C] hover:border-[#9ED164] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Подтянуть баллы из тестов</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportGradebookCsv}
                    disabled={!activeGradebookGroup}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#11171D] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV группы</span>
                  </button>
                </div>
              </div>

              {/* Semester Rules & Group Tabs */}
              <div className="p-4 border-b border-[#24303C] bg-[#121820] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {roster.map((grp) => (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => setGradebookGroupId(grp.id)}
                        className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          activeGradebookGroup?.id === grp.id
                            ? 'bg-[#213124] border-[#9ED164] text-[#CBEF9C]'
                            : 'bg-[#161E27] border-[#2A3744] text-[#9FB0C0] hover:text-white'
                        }`}
                      >
                        {grp.name} ({grp.students.length})
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#6C7E8E] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={gradebookSearch}
                      onChange={(e) => setGradebookSearch(e.target.value)}
                      placeholder="Поиск студента..."
                      className="bg-[#0F141A] border border-[#2A3744] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                    />
                  </div>
                </div>

                {/* Settings Bar: Attendance Threshold & Linked Tests */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-[#24303C] bg-[#0F141A] text-xs">
                    <span className="text-[#8EA0B0]">Порог посещ. (без тест №2):</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={gradebook.attendanceThreshold}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          persistGradebook({ ...gradebook, attendanceThreshold: val });
                        }}
                        className="w-14 bg-[#161E27] border border-[#344656] rounded px-2 py-0.5 text-xs font-mono text-white text-center focus:outline-none focus:border-[#9ED164]"
                      />
                      <span className="font-mono text-[#8EA0B0]">%</span>
                    </div>
                  </label>

                  <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-[#24303C] bg-[#0F141A] text-xs">
                    <span className="text-[#8EA0B0]">Кол-во лаб:</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={gradebook.labsCount}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(12, Number(e.target.value) || 6));
                        persistGradebook({ ...gradebook, labsCount: val });
                      }}
                      className="w-14 bg-[#161E27] border border-[#344656] rounded px-2 py-0.5 text-xs font-mono text-white text-center focus:outline-none focus:border-[#9ED164]"
                    />
                  </label>

                  <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#24303C] bg-[#0F141A] text-xs">
                    <span className="text-[#8EA0B0] shrink-0">Промеж.:</span>
                    <select
                      value={gradebook.midtermTestId}
                      onChange={(e) =>
                        persistGradebook({ ...gradebook, midtermTestId: e.target.value })
                      }
                      className="flex-1 min-w-0 bg-[#161E27] border border-[#344656] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                    >
                      <option value="">Любой пройденный</option>
                      {tests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#24303C] bg-[#0F141A] text-xs">
                    <span className="text-[#8EA0B0] shrink-0">Итоговый:</span>
                    <select
                      value={gradebook.finalTestId}
                      onChange={(e) =>
                        persistGradebook({ ...gradebook, finalTestId: e.target.value })
                      }
                      className="flex-1 min-w-0 bg-[#161E27] border border-[#344656] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                    >
                      <option value="">Не привязан</option>
                      {tests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {gradebookMsg && (
                  <div className="p-2.5 rounded border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
                    {gradebookMsg}
                  </div>
                )}
              </div>

              {/* Group Gradebook Table */}
              {activeGradebookGroup ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#24303C] bg-[#121820] text-[11px] font-mono text-[#8EA0B0]">
                        <th className="py-3 px-4 font-medium min-w-[170px]">Студент</th>
                        {Array.from({ length: Math.max(1, gradebook.labsCount || 6) }, (_, i) => (
                          <th key={i} className="py-3 px-1.5 font-medium text-center">
                            Л{i + 1}
                          </th>
                        ))}
                        <th className="py-3 px-2 font-medium text-center">Промеж.</th>
                        <th className="py-3 px-2 font-medium text-center">Посещ.%</th>
                        <th className="py-3 px-3 font-medium min-w-[160px]">Итоговый тест №2</th>
                        <th className="py-3 px-2 font-medium text-center">Предзащита</th>
                        <th className="py-3 px-4 font-medium min-w-[175px]">Итог за семестр</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2A35] text-xs">
                      {activeGradebookGroup.students
                        .filter((st) =>
                          gradebookSearch.trim()
                            ? st.toLowerCase().includes(gradebookSearch.trim().toLowerCase())
                            : true
                        )
                        .map((studentName) => {
                          const labsTotal = Math.max(1, gradebook.labsCount || 6);
                          const key = makeGradebookKey(activeGradebookGroup.name, studentName);
                          const rec = normalizeStudentRecord(gradebook.records[key], labsTotal);
                          const summary = computeStudentSemesterSummary(rec, gradebook);

                          const gradeCellSelectClass = (val: GradeValue) =>
                            `rounded border px-1.5 py-1 text-xs font-mono text-center focus:outline-none focus:border-[#9ED164] cursor-pointer ${
                              val === 5 || val === 'pass'
                                ? 'bg-[#1D2D21] border-[#4E7A45] text-[#CBEF9C]'
                                : val === 4
                                  ? 'bg-[#172634] border-[#396187] text-[#9ED3FF]'
                                  : val === 3
                                    ? 'bg-[#261E14] border-[#78572D] text-[#F3D3A7]'
                                    : val === 2
                                      ? 'bg-[#2D181B] border-[#7D3A42] text-[#FFB8BE]'
                                      : 'bg-[#0F141A] border-[#2A3744] text-[#7C8D9C]'
                            }`;

                          return (
                            <tr key={studentName} className="hover:bg-[#1A2430]">
                              <td className="py-2.5 px-4 font-semibold text-white">
                                {studentName}
                              </td>

                              {rec.labs.map((labVal, idx) => (
                                <td key={idx} className="py-2.5 px-1 text-center">
                                  <select
                                    value={encodeGradeSelect(labVal)}
                                    onChange={(e) =>
                                      updateStudentGradeField(
                                        activeGradebookGroup.name,
                                        studentName,
                                        (prev) => {
                                          const nextLabs = [...prev.labs];
                                          nextLabs[idx] = parseGradeSelect(e.target.value);
                                          return { ...prev, labs: nextLabs };
                                        }
                                      )
                                    }
                                    className={gradeCellSelectClass(labVal)}
                                  >
                                    <option value="">—</option>
                                    <option value="5">5</option>
                                    <option value="4">4</option>
                                    <option value="3">3</option>
                                    <option value="2">2</option>
                                    <option value="pass">Зч</option>
                                  </select>
                                </td>
                              ))}

                              <td className="py-2.5 px-2 text-center">
                                <select
                                  value={encodeGradeSelect(rec.midtermTest)}
                                  onChange={(e) =>
                                    updateStudentGradeField(
                                      activeGradebookGroup.name,
                                      studentName,
                                      (prev) => ({
                                        ...prev,
                                        midtermTest: parseGradeSelect(e.target.value),
                                      })
                                    )
                                  }
                                  className={gradeCellSelectClass(rec.midtermTest)}
                                >
                                  <option value="">—</option>
                                  <option value="5">5</option>
                                  <option value="4">4</option>
                                  <option value="3">3</option>
                                  <option value="2">2</option>
                                </select>
                              </td>

                              <td className="py-2.5 px-2 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="—"
                                  value={rec.attendance === null ? '' : rec.attendance}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const parsed =
                                      raw === ''
                                        ? null
                                        : Math.max(0, Math.min(100, Math.round(Number(raw))));
                                    updateStudentGradeField(
                                      activeGradebookGroup.name,
                                      studentName,
                                      (prev) => ({ ...prev, attendance: parsed })
                                    );
                                  }}
                                  className={`w-14 rounded border px-1.5 py-1 text-xs font-mono text-center focus:outline-none focus:border-[#9ED164] tabular-nums ${
                                    rec.attendance === null
                                      ? 'bg-[#0F141A] border-[#2A3744] text-[#7C8D9C]'
                                      : rec.attendance >= gradebook.attendanceThreshold
                                        ? 'bg-[#1D2D21] border-[#4E7A45] text-[#CBEF9C]'
                                        : 'bg-[#261E14] border-[#78572D] text-[#F3D3A7]'
                                  }`}
                                />
                              </td>

                              <td className="py-2.5 px-3">
                                {summary.needsFinalTest === null ? (
                                  <span className="text-[11px] font-mono text-[#7C8D9C]">
                                    Укажите посещ. %
                                  </span>
                                ) : summary.needsFinalTest === false ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1D2D21] border border-[#4E7A45] text-[11px] font-mono text-[#CBEF9C]">
                                    Освобождён
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-mono text-[#F3D3A7]">
                                      Сдаёт:
                                    </span>
                                    <select
                                      value={encodeGradeSelect(rec.finalTest)}
                                      onChange={(e) =>
                                        updateStudentGradeField(
                                          activeGradebookGroup.name,
                                          studentName,
                                          (prev) => ({
                                            ...prev,
                                            finalTest: parseGradeSelect(e.target.value),
                                          })
                                        )
                                      }
                                      className={gradeCellSelectClass(rec.finalTest)}
                                    >
                                      <option value="">—</option>
                                      <option value="5">5</option>
                                      <option value="4">4</option>
                                      <option value="3">3</option>
                                      <option value="2">2</option>
                                    </select>
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-2 text-center">
                                <select
                                  value={encodeGradeSelect(rec.projectDefense)}
                                  onChange={(e) =>
                                    updateStudentGradeField(
                                      activeGradebookGroup.name,
                                      studentName,
                                      (prev) => ({
                                        ...prev,
                                        projectDefense: parseGradeSelect(e.target.value),
                                      })
                                    )
                                  }
                                  className={gradeCellSelectClass(rec.projectDefense)}
                                >
                                  <option value="">—</option>
                                  <option value="5">5</option>
                                  <option value="4">4</option>
                                  <option value="3">3</option>
                                  <option value="2">2</option>
                                  <option value="pass">Зч</option>
                                </select>
                              </td>

                              <td className="py-2.5 px-4">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <div
                                      className={`font-semibold ${
                                        summary.isEligibleForPass
                                          ? 'text-[#9ED164]'
                                          : summary.semesterGradeShort === 'Долг'
                                            ? 'text-[#FFB8BE]'
                                            : 'text-[#8EA0B0]'
                                      }`}
                                    >
                                      {summary.semesterGradeLabel}
                                    </div>
                                    {summary.missingItems.length > 0 && (
                                      <div className="text-[10px] text-[#7C8D9C] truncate max-w-[150px]">
                                        {summary.missingItems.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                  <select
                                    value={rec.manualSemesterGrade || ''}
                                    onChange={(e) =>
                                      updateStudentGradeField(
                                        activeGradebookGroup.name,
                                        studentName,
                                        (prev) => ({
                                          ...prev,
                                          manualSemesterGrade: e.target.value || null,
                                        })
                                      )
                                    }
                                    title="Авто или ручная корректировка итога"
                                    className="bg-[#0F141A] border border-[#2A3744] rounded px-1.5 py-0.5 text-[11px] font-mono text-[#9FB0C0] focus:outline-none focus:border-[#9ED164]"
                                  >
                                    <option value="">Авто</option>
                                    <option value="5">5</option>
                                    <option value="4">4</option>
                                    <option value="3">3</option>
                                    <option value="2">2</option>
                                    <option value="Зачёт">Зачёт</option>
                                    <option value="Незачёт">Незачёт</option>
                                  </select>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-[#8EA0B0]">
                  Добавьте учебную группу во вкладке «Группы и студенты».
                </div>
              )}
            </div>

            {/* Secondary Row: Global Classroom Timer, Project Defense Dates, Student Feedback */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Global Classroom Timer Control */}
              <div className="p-5 rounded-xl border border-[#24303C] bg-[#161E27] space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#E5A454]" />
                    <span>Общий таймер класса</span>
                  </h2>
                  {globalTimer?.isActive && (
                    <span className="text-xs font-mono text-[#9ED164]">Активен</span>
                  )}
                </div>
                <p className="text-xs text-[#9FB0C0] leading-relaxed">
                  Запускает полноэкранный обратный отсчёт со списком целей у всех студентов на портале одновременно.
                </p>

                {timerMsg && (
                  <div className="p-2.5 rounded border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
                    {timerMsg}
                  </div>
                )}

                <form onSubmit={handleStartGlobalTimer} className="space-y-3">
                  <div>
                    <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                      Длительность (минут)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={timerMinutes}
                      onChange={(e) => setTimerMinutes(Number(e.target.value) || 1)}
                      className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                      Цели (каждая с новой строки)
                    </label>
                    <textarea
                      rows={3}
                      value={timerGoalsText}
                      onChange={(e) => setTimerGoalsText(e.target.value)}
                      className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-3 rounded-md bg-[#E5A454] text-[#1A140C] text-xs font-semibold hover:bg-[#F0B469] cursor-pointer"
                    >
                      Запустить таймер
                    </button>
                    {globalTimer?.isActive && (
                      <button
                        type="button"
                        onClick={() => stopGlobalTimer()}
                        className="px-3 py-2.5 rounded-md bg-[#E06C75] text-[#1A0D0F] text-xs font-semibold hover:bg-[#EA858D] cursor-pointer inline-flex items-center gap-1"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Стоп</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Project Defense Dates Quick Card */}
              <div className="p-5 rounded-xl border border-[#24303C] bg-[#161E27] space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Presentation className="w-4 h-4 text-[#9ED164]" />
                    <span>Предзащита проектов (1 семестр)</span>
                  </h2>
                  <button
                    type="button"
                    onClick={onOpenProjectGuide}
                    className="text-xs font-mono text-[#9ED164] hover:underline cursor-pointer"
                  >
                    Методичка
                  </button>
                </div>
                <p className="text-xs text-[#9FB0C0] leading-relaxed">
                  Назначьте индивидуальные даты предзащиты презентаций для каждой группы.
                </p>
                {guideSaveMsg && (
                  <div className="p-2.5 rounded border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
                    {guideSaveMsg}
                  </div>
                )}
                <div className="space-y-2.5">
                  {roster.map((grp) => {
                    const entry = projectGuide.groupDates?.[grp.name] || { date: '', note: '' };
                    return (
                      <div
                        key={grp.id}
                        className="p-3 rounded-lg border border-[#24303C] bg-[#11171D] space-y-2"
                      >
                        <div className="text-xs font-semibold text-white">{grp.name}</div>
                        <input
                          type="datetime-local"
                          value={entry.date}
                          onChange={(e) =>
                            handleUpdateDefenseDate(grp.name, { date: e.target.value })
                          }
                          className="w-full bg-[#0F141A] border border-[#344656] rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                        />
                        <input
                          type="text"
                          value={entry.note}
                          onChange={(e) =>
                            handleUpdateDefenseDate(grp.name, { note: e.target.value })
                          }
                          placeholder="Ауд. или формат защиты"
                          className="w-full bg-[#0F141A] border border-[#344656] rounded px-2.5 py-1.5 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feedback list */}
              <div className="rounded-xl border border-[#24303C] bg-[#161E27] overflow-hidden flex flex-col max-h-[460px]">
                <div className="px-5 py-4 border-b border-[#24303C] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#9ED164]" />
                    <h2 className="text-sm font-bold text-white">Идеи и отзывы студентов</h2>
                  </div>
                  <span className="text-xs font-mono text-[#8EA0B0] tabular-nums">
                    {allFeedback.length}
                  </span>
                </div>
                <div className="divide-y divide-[#1F2A35] overflow-y-auto flex-1">
                  {allFeedback.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#7C8D9C]">
                      Предложений пока нет.
                    </div>
                  ) : (
                    allFeedback.map((fb) => (
                      <div key={fb.id} className="px-5 py-3.5 space-y-1 text-xs">
                        <div className="font-semibold text-white">{fb.studentName}</div>
                        <p className="text-[#B7C5D3] leading-relaxed">{fb.feedback}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Bonus Submissions Overview */}
            <div className="rounded-xl border border-[#24303C] bg-[#161E27] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#24303C] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#9ED164]" />
                  <h2 className="text-sm font-bold text-white">
                    Выполненные дополнительные задания ({bonusSubmissions.length})
                  </h2>
                </div>
              </div>
              <div className="divide-y divide-[#1F2A35] max-h-[300px] overflow-y-auto">
                {bonusSubmissions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#7C8D9C]">
                    Студенты пока не сдавали дополнительное задание.
                  </div>
                ) : (
                  bonusSubmissions.map((b) => (
                    <div
                      key={b.id}
                      className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-white">
                          {b.studentName} · <span className="text-[#8EA0B0]">{b.group}</span>
                        </div>
                        <div className="text-[#9FB0C0]">
                          {b.kind === 'quiz'
                            ? `Код-челлендж: ${b.score}/${b.total} (${b.percentage}%)`
                            : `Проект GitHub: ${b.note || 'Без комментария'}`}
                        </div>
                        {b.repoLink && (
                          <a
                            href={b.repoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block font-mono text-[#7CC4FA] hover:underline break-all"
                          >
                            {b.repoLink}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded border border-[#5D8247] bg-[#213124] font-mono text-[11px] text-[#CBEF9C]">
                          {b.gradeLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteBonusSubmission(b.id)}
                          title="Удалить запись"
                          className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-[#E06C75] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Wheel of Fortune Spins Log */}
            <div className="rounded-xl border border-[#24303C] bg-[#161E27] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#24303C] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#E5A454]" />
                  <h2 className="text-sm font-bold text-white">
                    Журнал «Колеса удачи» ({wheelSpins.length})
                  </h2>
                </div>
              </div>
              <div className="divide-y divide-[#1F2A35] max-h-[300px] overflow-y-auto">
                {wheelSpins.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#7C8D9C]">
                    Студенты пока не крутили колесо удачи.
                  </div>
                ) : (
                  wheelSpins.map((w) => (
                    <div
                      key={w.id}
                      className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-white">
                          {w.userName} ·{' '}
                          <span className="text-[#9ED164]">{w.labName}</span> ·{' '}
                          <span className="text-[#E5A454]">{w.tierLabel}</span>
                        </div>
                        <div className={w.won ? 'text-[#9ED164]' : 'text-[#FFB8BE]'}>
                          {w.outcomeText}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded border font-mono text-[11px] ${
                            w.won
                              ? 'border-[#5D8247] bg-[#213124] text-[#CBEF9C]'
                              : 'border-[#7D3A42] bg-[#2D181B] text-[#FFB8BE]'
                          }`}
                        >
                          {w.won ? 'Победа' : 'Проигрыш'}
                        </span>
                        <span className="font-mono text-[11px] text-[#7C8D9C]">
                          {w.dateKey}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Web Mission & Tutorial Editor */}
        {activeTab === 'missions' && (
          <MissionEditorPanel missions={missions} customDocs={customDocs} />
        )}

        {/* TAB 3: Roster Management */}
        {activeTab === 'roster' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-xl border border-[#24303C] bg-[#161E27] space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#9ED164]" />
                  <span>Учебные группы</span>
                </h2>

                <form onSubmit={handleAddGroup} className="flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Название группы (напр. ИТ-31)"
                    className="flex-1 bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить</span>
                  </button>
                </form>

                <div className="space-y-2">
                  {roster.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedRosterGroupId(g.id)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        activeRosterGroup?.id === g.id
                          ? 'bg-[#213124] border-[#9ED164] text-white'
                          : 'bg-[#11171D] border-[#24303C] text-[#D7E0E8] hover:border-[#45586B]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{g.name}</div>
                        <div className="text-[11px] font-mono text-[#8EA0B0] tabular-nums">
                          {g.students.length} студентов
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(g.id);
                        }}
                        className="p-1.5 text-[#7C8D9C] hover:text-[#E06C75] cursor-pointer"
                        title="Удалить группу"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {rosterSaveMsg && (
                <div className="p-3 rounded-lg border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
                  {rosterSaveMsg}
                </div>
              )}

              {activeRosterGroup ? (
                <div className="p-5 rounded-xl border border-[#24303C] bg-[#161E27] space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">{activeRosterGroup.name}</h2>
                      <p className="text-xs text-[#8EA0B0]">
                        Студенты этой группы отображаются в выпадающем списке перед началом теста.
                      </p>
                    </div>
                    <span className="font-mono text-xs text-[#9ED164] tabular-nums">
                      Всего: {activeRosterGroup.students.length}
                    </span>
                  </div>

                  <form onSubmit={handleAddStudentsBulk} className="space-y-2.5">
                    <label className="block text-xs font-mono text-[#8EA0B0]">
                      Добавить студентов (каждое имя с новой строки)
                    </label>
                    <textarea
                      rows={3}
                      value={bulkStudentsText}
                      onChange={(e) => setBulkStudentsText(e.target.value)}
                      placeholder={'Иванов Иван\nПетрова Мария\nСидоров Алексей'}
                      className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
                    >
                      Добавить в группу
                    </button>
                  </form>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                    {activeRosterGroup.students.map((st) => (
                      <div
                        key={st}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-[#11171D] border border-[#24303C] text-xs"
                      >
                        <span className="truncate text-[#E6EDF3]">{st}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(activeRosterGroup.id, st)}
                          className="text-[#7C8D9C] hover:text-[#E06C75] shrink-0 cursor-pointer"
                          title="Удалить студента"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-[#24303C] bg-[#161E27] text-center text-sm text-[#8EA0B0]">
                  Создайте группу слева, чтобы добавить студентов.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Web Question Constructor */}
        {activeTab === 'questions' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Веб-конструктор вопросов тестирования
                </h2>
                <p className="text-xs text-[#9FB0C0] mt-0.5">
                  Редактируйте существующие задания, создавайте новые вопросы любых форматов или экспортируйте базу в JSON без правки кода.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportQuestionsJson}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#161E27] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Импорт JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportQuestionsJson}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#161E27] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Экспорт JSON</span>
                </button>
                {confirmResetQ ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setConfirmResetQ(false);
                      await persistQuestions(
                        DEFAULT_QUESTIONS,
                        'Восстановлены 27 стандартных вопросов.'
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#E06C75] text-[#1A0D0F] text-xs font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Точно сбросить?</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmResetQ(true);
                      window.setTimeout(() => setConfirmResetQ(false), 4000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#161E27] text-xs font-medium text-[#9FB0C0] hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Сброс</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingQuestion('new')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Добавить вопрос</span>
                </button>
              </div>
            </div>

            {qSaveMsg && (
              <div className="p-3 rounded-lg border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
                {qSaveMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="w-4 h-4 text-[#6C7E8E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={qSearch}
                  onChange={(e) => setQSearch(e.target.value)}
                  placeholder="Поиск вопроса по тексту или разделу..."
                  className="w-full bg-[#161E27] border border-[#2A3744] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                />
              </div>
              <select
                value={qSectionFilter}
                onChange={(e) => setQSectionFilter(e.target.value)}
                className="bg-[#161E27] border border-[#2A3744] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              >
                <option value="all">Все разделы ({questions.length})</option>
                {allQuestionSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-[#24303C] bg-[#161E27] space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-mono text-[#9ED164]">
                      Задание {String(q.id).padStart(2, '0')} · {q.section} · {q.type} ({q.kind})
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(q)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#344656] bg-[#11171D] text-xs text-[#D7E0E8] hover:border-[#9ED164] hover:text-white cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Изменить</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateQuestion(q)}
                        title="Дублировать вопрос"
                        className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-white cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          title="Удалить вопрос"
                          className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-[#E06C75] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white">{q.title}</h3>
                  <p className="text-xs text-[#9FB0C0]">{q.desc}</p>
                  <div className="text-xs bg-[#11171D] border border-[#24303C] rounded-md p-3 space-y-1">
                    <div className="text-[#9ED164] font-mono break-words">
                      Ключ:{' '}
                      {typeof q.correct === 'object'
                        ? JSON.stringify(q.correct)
                        : String(q.correct)}
                    </div>
                    <div className="text-[#A4B4C4]">{q.explanation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {editingQuestion !== null && (
        <QuestionEditorModal
          initialQuestion={editingQuestion === 'new' ? null : editingQuestion}
          nextId={nextQuestionId}
          existingSections={allQuestionSections}
          onClose={() => setEditingQuestion(null)}
          onSave={handleSaveQuestionFromModal}
        />
      )}

      {/* Student Detail Modal */}
      {selectedSession && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-[#344656] bg-[#161E27] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#24303C] pb-4">
              <div>
                <div className="text-xs font-mono text-[#9ED164] mb-1">
                  {selectedSession.group}
                </div>
                <h2 className="text-xl font-bold text-white">{selectedSession.studentName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="p-2 rounded-md border border-[#2A3744] text-[#8EA0B0] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#11171D] border border-[#24303C]">
                <div className="text-[#8EA0B0]">Прогресс</div>
                <div className="text-base font-bold font-mono text-white mt-0.5 tabular-nums">
                  {selectedSession.currentQuestion} / {selectedSession.totalQuestions}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#11171D] border border-[#24303C]">
                <div className="text-[#8EA0B0]">Результат</div>
                <div className="text-base font-bold font-mono text-[#9ED164] mt-0.5 tabular-nums">
                  {selectedSession.percentage !== null
                    ? `${selectedSession.score}/${selectedSession.totalQuestions} (${selectedSession.percentage}%)`
                    : 'Ещё не завершён'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#11171D] border border-[#24303C]">
                <div className="text-[#8EA0B0]">Нарушения</div>
                <div className="text-base font-bold font-mono text-[#E06C75] mt-0.5 tabular-nums">
                  {selectedSession.violationsCount}
                </div>
              </div>
            </div>

            {selectedSession.violations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono text-[#FFB8BE]">История нарушений</h3>
                <div className="space-y-1.5">
                  {selectedSession.violations.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-[#231417] border border-[#4A282D] text-xs"
                    >
                      <span className="text-[#FFB8BE]">
                        Вопрос {v.questionNumber}: {v.label}
                      </span>
                      <span className="font-mono text-[#E5A454] tabular-nums shrink-0">
                        {v.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedSession.details && selectedSession.details.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono text-[#8EA0B0]">Детализация по вопросам</h3>
                <div className="space-y-1.5">
                  {selectedSession.details.map((d) => (
                    <div
                      key={d.questionId}
                      className="flex items-start gap-2.5 p-2.5 rounded bg-[#11171D] border border-[#24303C] text-xs"
                    >
                      {d.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-[#9ED164] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#E06C75] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white">
                          {d.questionId}. {d.title}
                        </div>
                        <div className="text-[#9FB0C0] font-mono mt-0.5 break-words">
                          Ответ: {d.userAnswerFormatted}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

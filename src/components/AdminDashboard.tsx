import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Maximize2,
  MessageSquare,
  Monitor,
  Plus,
  Search,
  ShieldAlert,
  Square,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import { QUESTIONS } from '../data/questions';
import {
  FeedbackEntry,
  GlobalTimerState,
  Mission,
  MissionSubmission,
  stopGlobalTimer,
  triggerGlobalTimer,
} from '../services/courseService';
import {
  removeSession,
  saveRoster,
  StudentSession,
  SyncStatus,
  ViolationEvent,
} from '../services/telemetryService';

interface AdminDashboardProps {
  sessions: StudentSession[];
  violations: ViolationEvent[];
  syncStatus: SyncStatus;
  roster: GroupRoster[];
  missions: Mission[];
  allSubmissions: MissionSubmission[];
  allFeedback: FeedbackEntry[];
  globalTimer: GlobalTimerState | null;
  adminLabel: string;
  onBackToPortal: () => void;
  onOpenSecondScreenInPlace: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  sessions,
  violations,
  syncStatus,
  roster,
  missions,
  allSubmissions,
  allFeedback,
  globalTimer,
  adminLabel,
  onBackToPortal,
  onOpenSecondScreenInPlace,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'course' | 'roster' | 'questions'>('live');
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

  const missionTitleMap = useMemo(
    () => new Map(missions.map((m) => [m.id, m.title])),
    [missions]
  );

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
              onClick={() => setActiveTab('course')}
              className={`py-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'course'
                  ? 'border-[#9ED164] text-[#9ED164]'
                  : 'border-transparent text-[#8EA0B0] hover:text-white'
              }`}
            >
              Курс: отчёты и таймер ({allSubmissions.length})
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
              Вопросы и ключи ({QUESTIONS.length})
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
                            <td className="py-3 px-4 font-semibold text-white">
                              {s.studentName}
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
                                <span className="text-[#9ED164] font-medium">Завершил</span>
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

        {/* TAB 2: Course Submissions, Feedback & Global Classroom Timer */}
        {activeTab === 'course' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 cols: Student Mission Submissions */}
            <div className="lg:col-span-8 space-y-6">
              <div className="rounded-xl border border-[#24303C] bg-[#161E27] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#24303C] flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">
                    Сданные проекты по миссиям (GitHub)
                  </h2>
                  <span className="text-xs font-mono text-[#9ED164] tabular-nums">
                    Всего: {allSubmissions.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#24303C] bg-[#121820] text-[11px] font-mono text-[#8EA0B0]">
                        <th className="py-3 px-4 font-medium">Студент</th>
                        <th className="py-3 px-4 font-medium">Миссия</th>
                        <th className="py-3 px-4 font-medium text-right">Репозиторий</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2A35] text-xs">
                      {allSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-10 text-center text-[#7C8D9C]">
                            Отчёты по миссиям ещё не поступали.
                          </td>
                        </tr>
                      ) : (
                        allSubmissions.map((sub) => (
                          <tr key={sub.id} className="hover:bg-[#1C2632]">
                            <td className="py-3 px-4 font-semibold text-white">
                              {sub.studentName}
                            </td>
                            <td className="py-3 px-4 text-[#D7E0E8]">
                              {missionTitleMap.get(sub.topicId) || sub.topicId}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <a
                                href={sub.repository}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-mono text-[#7CC4FA] hover:underline"
                              >
                                <span>Открыть</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feedback list */}
              <div className="rounded-xl border border-[#24303C] bg-[#161E27] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#24303C] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#9ED164]" />
                    <h2 className="text-sm font-bold text-white">Идеи и отзывы студентов</h2>
                  </div>
                  <span className="text-xs font-mono text-[#8EA0B0] tabular-nums">
                    {allFeedback.length}
                  </span>
                </div>
                <div className="divide-y divide-[#1F2A35]">
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

            {/* Right 4 cols: Global Classroom Timer Control */}
            <div className="lg:col-span-4 space-y-4">
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
            </div>
          </div>
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

        {/* TAB 4: Questions Reference */}
        {activeTab === 'questions' && (
          <div className="space-y-3">
            {QUESTIONS.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-[#24303C] bg-[#161E27] space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono text-[#9ED164]">
                    Задание {String(q.id).padStart(2, '0')} · {q.section} · {q.type}
                  </div>
                </div>
                <h3 className="text-sm font-bold text-white">{q.title}</h3>
                <p className="text-xs text-[#9FB0C0]">{q.desc}</p>
                <div className="text-xs bg-[#11171D] border border-[#24303C] rounded-md p-3 space-y-1">
                  <div className="text-[#9ED164] font-mono">
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
        )}
      </main>

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

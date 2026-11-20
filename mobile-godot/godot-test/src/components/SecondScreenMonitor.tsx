import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Maximize2,
  Minimize2,
  ShieldAlert,
} from 'lucide-react';
import { StudentSession, SyncStatus, ViolationEvent } from '../services/telemetryService';

interface SecondScreenMonitorProps {
  sessions: StudentSession[];
  violations: ViolationEvent[];
  syncStatus: SyncStatus;
  groups: string[];
  onExit?: () => void;
  isStandaloneWindow?: boolean;
}

export const SecondScreenMonitor: React.FC<SecondScreenMonitorProps> = ({
  sessions,
  violations,
  syncStatus,
  groups,
  onExit,
  isStandaloneWindow = false,
}) => {
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 2000);
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => groupFilter === 'all' || s.group === groupFilter)
      .sort((a, b) => {
        // Put active violation_paused first, then in_progress, then completed
        const rank = (st: StudentSession['status']) =>
          st === 'violation_paused' ? 0 : st === 'in_progress' ? 1 : 2;
        const rDiff = rank(a.status) - rank(b.status);
        if (rDiff !== 0) return rDiff;
        return b.updatedAtMs - a.updatedAtMs;
      });
  }, [sessions, groupFilter]);

  const filteredViolations = useMemo(() => {
    return violations.filter((v) => groupFilter === 'all' || v.group === groupFilter);
  }, [violations, groupFilter]);

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
    return {
      active,
      completedCount: completed.length,
      avgScore,
      totalViolations,
    };
  }, [filteredSessions]);

  const getStatusDisplay = (s: StudentSession) => {
    if (s.status === 'violation_paused') {
      return {
        label: 'Нарушение фокуса',
        cls: 'text-[#FFB8BE] bg-[#3B2125] border-[#E06C75]/50',
      };
    }
    if (s.status === 'completed') {
      return {
        label: 'Завершил тест',
        cls: 'text-[#CBEF9C] bg-[#213124] border-[#5D8247]/60',
      };
    }
    return {
      label: 'Выполняет',
      cls: 'text-[#9AD0F5] bg-[#162938] border-[#3B6C91]/60',
    };
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#E6EDF3] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#222D38] bg-[#121820] px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[#324252] bg-[#161F28] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>В панель</span>
              </button>
            )}
            {isStandaloneWindow && (
              <a
                href="?"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[#324252] bg-[#161F28] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>На главную</span>
              </a>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Мониторинг тестирования — Второй экран
                </h1>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[#9ED164]">
                  <span className="w-2 h-2 rounded-full bg-[#9ED164]" aria-hidden="true" />
                  <span>
                    {syncStatus === 'connected' ? 'Прямой эфир (Firestore)' : 'Локальный эфир'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              aria-label="Фильтр по группе"
              className="bg-[#0B0F14] border border-[#344656] rounded-md px-3 py-2 text-xs text-[#F1F6FA] focus:outline-none focus:border-[#9ED164]"
            >
              <option value="all">Все группы</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#344656] bg-[#161F28] text-xs font-medium text-[#E6EDF3] hover:border-[#9ED164] transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span>Свернуть</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span>Полный экран</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Monitor Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 flex flex-col gap-6">
        {/* Big Tabular KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-[#24303C] bg-[#121820]">
            <div className="text-xs text-[#8EA0B0] mb-1">Выполняют сейчас</div>
            <div className="text-3xl font-bold font-mono text-[#7CC4FA] tabular-nums">
              {stats.active}
            </div>
          </div>
          <div className="p-5 rounded-xl border border-[#24303C] bg-[#121820]">
            <div className="text-xs text-[#8EA0B0] mb-1">Завершили тест</div>
            <div className="text-3xl font-bold font-mono text-[#9ED164] tabular-nums">
              {stats.completedCount}
            </div>
          </div>
          <div className="p-5 rounded-xl border border-[#24303C] bg-[#121820]">
            <div className="text-xs text-[#8EA0B0] mb-1">Средний результат</div>
            <div className="text-3xl font-bold font-mono text-[#F1F6FA] tabular-nums">
              {stats.avgScore !== null ? `${stats.avgScore}%` : '—'}
            </div>
          </div>
          <div className="p-5 rounded-xl border border-[#24303C] bg-[#121820]">
            <div className="text-xs text-[#8EA0B0] mb-1">Всего нарушений</div>
            <div
              className={`text-3xl font-bold font-mono tabular-nums ${
                stats.totalViolations > 0 ? 'text-[#E06C75]' : 'text-[#9ED164]'
              }`}
            >
              {stats.totalViolations}
            </div>
          </div>
        </div>

        {/* 2-Column Live Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          {/* Left 7 cols: Live Students Progress */}
          <section className="lg:col-span-7 rounded-xl border border-[#24303C] bg-[#121820] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#222D38] flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Активность студентов</h2>
              <span className="text-xs font-mono text-[#8EA0B0] tabular-nums">
                Записей: {filteredSessions.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#1D2630]">
              {filteredSessions.length === 0 ? (
                <div className="p-12 text-center text-sm text-[#7C8D9C]">
                  Ожидание подключения студентов. Как только кто-то начнёт тест, данные появятся здесь автоматически.
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const st = getStatusDisplay(s);
                  const pct =
                    s.status === 'completed'
                      ? 100
                      : Math.round((s.answeredCount / Math.max(1, s.totalQuestions)) * 100);
                  return (
                    <div
                      key={s.id}
                      className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        s.status === 'violation_paused' ? 'bg-[#261417]/60' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-base font-semibold text-white truncate">
                            {s.studentName}
                          </span>
                          <span className="text-xs font-mono text-[#8EA0B0]">{s.group}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-medium ${st.cls}`}
                          >
                            {s.status === 'violation_paused' && (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            {s.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {s.status === 'in_progress' && <Clock className="w-3.5 h-3.5" />}
                            <span>{st.label}</span>
                          </span>

                          <span className="text-xs font-mono text-[#9FB0C0] tabular-nums">
                            Вопрос {s.currentQuestion} / {s.totalQuestions}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 shrink-0">
                        <div className="w-32">
                          <div className="flex justify-between text-[11px] font-mono text-[#8EA0B0] mb-1 tabular-nums">
                            <span>Прогресс</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#222D38] overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                s.status === 'completed' ? 'bg-[#9ED164]' : 'bg-[#7CC4FA]'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-right min-w-[68px]">
                          <div className="text-[11px] text-[#8EA0B0]">Балл</div>
                          <div className="text-base font-bold font-mono text-white tabular-nums">
                            {s.percentage !== null ? `${s.percentage}%` : '—'}
                          </div>
                        </div>

                        <div className="text-right min-w-[74px]">
                          <div className="text-[11px] text-[#8EA0B0]">Нарушения</div>
                          <div
                            className={`text-base font-bold font-mono tabular-nums ${
                              s.violationsCount > 0 ? 'text-[#E06C75]' : 'text-[#9ED164]'
                            }`}
                          >
                            {s.violationsCount}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Right 5 cols: Real-time Violations Feed */}
          <section className="lg:col-span-5 rounded-xl border border-[#422328] bg-[#141115] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#321E22] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#FFB8BE]">
                <ShieldAlert className="w-5 h-5 text-[#E06C75]" />
                <h2 className="text-base font-bold">Лента нарушений</h2>
              </div>
              <span className="text-xs font-mono text-[#D6969C] tabular-nums">
                Инцидентов: {filteredViolations.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#29191C]">
              {filteredViolations.length === 0 ? (
                <div className="p-12 text-center text-sm text-[#8E9BA8]">
                  Нарушений не зафиксировано. Если студент переключит вкладку или уйдёт из окна теста, событие мгновенно появится здесь.
                </div>
              ) : (
                filteredViolations.map((v) => {
                  const isFresh = nowMs - v.createdAtMs < 15000;
                  return (
                    <div
                      key={v.id}
                      className={`px-5 py-4 transition-colors ${
                        isFresh ? 'bg-[#3B191E]' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-base text-white">
                          {v.studentName}
                        </span>
                        <span className="font-mono text-xs text-[#E5A454] tabular-nums">
                          {v.timestamp}
                        </span>
                      </div>
                      <div className="text-xs text-[#9FB0C0] mb-1.5">
                        {v.group} · Задание {v.questionNumber}
                      </div>
                      <div className="text-sm font-medium text-[#FFB8BE]">{v.label}</div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

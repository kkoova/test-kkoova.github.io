import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock, Lock, ShieldAlert, ShieldCheck, Unlock } from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import {
  formatScheduledDateRu,
  getTestGroupAccess,
  hasAnyUnlockedAccess,
  TestDefinition,
} from '../services/telemetryService';

interface TestCatalogGridProps {
  tests: TestDefinition[];
  totalAvailableQuestions: number;
  selectedTestId?: string | null;
  onSelectTest: (test: TestDefinition) => void;
  compact?: boolean;
}

export const TestCatalogGrid: React.FC<TestCatalogGridProps> = ({
  tests,
  totalAvailableQuestions,
  selectedTestId,
  onSelectTest,
  compact = false,
}) => {
  return (
    <div className={compact ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
      {tests.map((test) => {
        const anyOpen = hasAnyUnlockedAccess(test);
        const isSelected = selectedTestId === test.id && anyOpen;
        const qCount =
          test.questionIds.length > 0 ? test.questionIds.length : totalAvailableQuestions;

        const scheduleEntries = Object.entries(test.groupSchedules || {}).filter(
          ([, gs]) => gs.assigned || Boolean(gs.scheduledAt) || gs.unlocked
        );

        return (
          <div
            key={test.id}
            className={`rounded-xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
              isSelected
                ? 'border-[#9ED164] bg-[#19231D]'
                : anyOpen
                  ? 'border-[#2A3744] bg-[#161E27] hover:border-[#62854B]'
                  : 'border-[#242E39] bg-[#131921]'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#8EA0B0] tabular-nums">
                    <span>{qCount} заданий</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#D7E0E8]">
                      <Clock className="w-3.5 h-3.5 text-[#E5A454]" />
                      <span>{test.durationMinutes} мин</span>
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#F1F6FA] leading-snug">
                    {test.title}
                  </h3>
                </div>

                {anyOpen ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#9ED164] shrink-0">
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{test.isUnlocked ? 'Открыт' : 'По группам'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#E5A454] shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Закрыт</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-[#9FB0C0] leading-relaxed">{test.description}</p>

              {(scheduleEntries.length > 0 || test.defaultScheduledAt) && (
                <div className="p-3 rounded-lg border border-[#24303C] bg-[#0F141A] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8EA0B0]">
                    <CalendarClock className="w-3.5 h-3.5 text-[#E5A454]" />
                    <span>Расписание для групп</span>
                  </div>
                  {scheduleEntries.length > 0 ? (
                    <div className="space-y-1">
                      {scheduleEntries.map(([gName, gs]) => {
                        const groupOpen = test.isUnlocked || gs.unlocked;
                        return (
                          <div
                            key={gName}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-[#E6EDF3] font-medium truncate">{gName}</span>
                            <span
                              className={`font-mono text-[11px] shrink-0 ${
                                groupOpen ? 'text-[#9ED164]' : 'text-[#E5A454]'
                              }`}
                            >
                              {gs.scheduledAt
                                ? `${formatScheduledDateRu(gs.scheduledAt)} · ${groupOpen ? 'Открыт' : 'Закрыт'}`
                                : groupOpen
                                  ? 'Открыт'
                                  : 'Ожидает открытия'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-[#E5A454]">
                      Дата проведения: {formatScheduledDateRu(test.defaultScheduledAt)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {anyOpen ? (
              <button
                type="button"
                onClick={() => onSelectTest(test)}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#9ED164] text-[#111912]'
                    : 'border border-[#4A683B] bg-[#213124] text-[#CBEF9C] hover:bg-[#9ED164] hover:text-[#111912]'
                }`}
              >
                {isSelected ? 'Выбран для прохождения' : 'Перейти к выбору группы'}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-lg border border-[#2A3744] bg-[#10161D] text-xs font-medium text-[#7C8D9C] inline-flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Заблокировано до открытия преподавателем</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface StartScreenProps {
  tests: TestDefinition[];
  roster: GroupRoster[];
  totalQuestions: number;
  initialTestId?: string | null;
  defaultStudentHint?: string | null;
  onStartTest: (params: { test: TestDefinition; group: string; studentName: string }) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  tests,
  roster,
  totalQuestions,
  initialTestId,
  defaultStudentHint,
  onStartTest,
}) => {
  const [selectedTestId, setSelectedTestId] = useState<string>(() => {
    if (initialTestId) {
      const found = tests.find((t) => t.id === initialTestId && hasAnyUnlockedAccess(t));
      if (found) return found.id;
    }
    const firstOpen = tests.find((t) => hasAnyUnlockedAccess(t));
    return firstOpen?.id || tests[0]?.id || '';
  });

  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTestId) {
      const found = tests.find((t) => t.id === initialTestId && hasAnyUnlockedAccess(t));
      if (found) setSelectedTestId(found.id);
    }
  }, [initialTestId, tests]);

  const selectedTest = useMemo(() => {
    return tests.find((t) => t.id === selectedTestId) || tests[0] || null;
  }, [tests, selectedTestId]);

  const isSelectedTestOpenForAnyGroup = selectedTest
    ? hasAnyUnlockedAccess(selectedTest)
    : false;

  const groupAccess = useMemo(() => {
    if (!selectedTest || !selectedGroup) return null;
    return getTestGroupAccess(selectedTest, selectedGroup);
  }, [selectedTest, selectedGroup]);

  const studentsInGroup = useMemo(() => {
    const found = roster.find((g) => g.name === selectedGroup);
    return found ? found.students : [];
  }, [roster, selectedGroup]);

  const handleGroupChange = (groupName: string) => {
    setSelectedGroup(groupName);
    const groupObj = roster.find((g) => g.name === groupName);
    if (defaultStudentHint && groupObj) {
      const hintLower = defaultStudentHint.toLowerCase();
      const match = groupObj.students.find((s) => s.toLowerCase() === hintLower);
      setSelectedStudent(match || '');
    } else {
      setSelectedStudent('');
    }
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTest || !isSelectedTestOpenForAnyGroup) {
      setFormError('Выбранный тест пока закрыт преподавателем.');
      return;
    }
    if (!selectedGroup) {
      setFormError('Пожалуйста, выберите вашу учебную группу.');
      return;
    }
    if (groupAccess && !groupAccess.allowed) {
      setFormError(groupAccess.reason);
      return;
    }
    if (!selectedStudent) {
      setFormError('Пожалуйста, выберите ваше имя из списка.');
      return;
    }
    setFormError(null);
    onStartTest({
      test: selectedTest,
      group: selectedGroup,
      studentName: selectedStudent,
    });
  };

  const canStart =
    Boolean(selectedTest) &&
    isSelectedTestOpenForAnyGroup &&
    Boolean(selectedGroup) &&
    Boolean(groupAccess?.allowed) &&
    Boolean(selectedStudent);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="space-y-1.5">
        <div className="text-xs font-mono text-[#9ED164]">Практический контроль знаний</div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F6FA]">
          Тестирования по Godot Engine
        </h1>
        <p className="text-sm text-[#9FB0C0] max-w-2xl leading-relaxed">
          Выберите доступный тест, укажите учебную группу и ваше имя. Если тест назначен на определённую дату или закрыт преподавателем, перейти к выполнению можно только после разблокировки.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Test Catalog with Locks & Group Dates */}
        <div className="lg:col-span-7 space-y-3">
          <div className="text-xs font-mono text-[#8EA0B0]">
            Доступные и запланированные тесты ({tests.length})
          </div>
          <TestCatalogGrid
            tests={tests}
            totalAvailableQuestions={totalQuestions}
            selectedTestId={selectedTest?.id}
            compact
            onSelectTest={(t) => {
              setSelectedTestId(t.id);
              setFormError(null);
            }}
          />
        </div>

        {/* Right: Group & Name Entry Form */}
        <div className="lg:col-span-5 rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-7 shadow-xl space-y-5">
          {selectedTest ? (
            <>
              <div className="border-b border-[#24303C] pb-4 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-[#9ED164]">Выбранный тест</span>
                  <span className="inline-flex items-center gap-1 text-[#E5A454] tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{selectedTest.durationMinutes} мин</span>
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">{selectedTest.title}</h2>
              </div>

              {!isSelectedTestOpenForAnyGroup ? (
                <div className="p-5 rounded-lg border border-[#344656] bg-[#11171D] text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-[#251E15] border border-[#E5A454]/40 flex items-center justify-center text-[#E5A454]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    Тестирование сейчас заблокировано
                  </div>
                  <p className="text-xs text-[#9FB0C0] leading-relaxed">
                    Перейти к выполнению заданий можно только после того, как преподаватель нажмёт кнопку разблокировки.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="group-select"
                      className="block text-xs font-mono text-[#8EA0B0] mb-1.5"
                    >
                      Учебная группа
                    </label>
                    <select
                      id="group-select"
                      value={selectedGroup}
                      onChange={(e) => handleGroupChange(e.target.value)}
                      className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-3 text-sm text-[#F1F6FA] focus:outline-none focus:border-[#9ED164]"
                    >
                      <option value="">— Выберите группу —</option>
                      {roster.map((g) => {
                        const acc = getTestGroupAccess(selectedTest, g.name);
                        const suffix = acc.allowed
                          ? 'Открыт'
                          : acc.scheduledAt
                            ? `${formatScheduledDateRu(acc.scheduledAt)} (Закрыт)`
                            : 'Закрыт';
                        return (
                          <option key={g.id} value={g.name}>
                            {g.name} · {suffix}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {groupAccess && !groupAccess.allowed && (
                    <div className="p-3.5 rounded-lg border border-[#E5A454]/50 bg-[#251E15] text-xs text-[#F3D3A7] flex items-start gap-2.5 leading-relaxed">
                      <Lock className="w-4 h-4 text-[#E5A454] shrink-0 mt-0.5" />
                      <span>{groupAccess.reason}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="student-select"
                      className="block text-xs font-mono text-[#8EA0B0] mb-1.5"
                    >
                      Фамилия и имя студента
                    </label>
                    <select
                      id="student-select"
                      value={selectedStudent}
                      disabled={!selectedGroup || (groupAccess !== null && !groupAccess.allowed)}
                      onChange={(e) => {
                        setSelectedStudent(e.target.value);
                        setFormError(null);
                      }}
                      className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-3 text-sm text-[#F1F6FA] focus:outline-none focus:border-[#9ED164] disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {!selectedGroup
                          ? '— Сначала выберите группу —'
                          : groupAccess && !groupAccess.allowed
                            ? '— Доступ для группы закрыт —'
                            : '— Выберите ваше имя —'}
                      </option>
                      {studentsInGroup.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formError && (
                    <div className="text-xs text-[#E06C75] bg-[#2D181B] border border-[#E06C75]/40 rounded-md px-3 py-2">
                      {formError}
                    </div>
                  )}

                  <div className="p-4 rounded-lg border border-[#2A3744] bg-[#11171D] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#E5A454]">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Таймер и контроль фокуса</span>
                    </div>
                    <p className="text-xs text-[#91A2B2] leading-relaxed">
                      Время ограничено:{' '}
                      <strong className="text-[#E6EDF3]">
                        {selectedTest.durationMinutes} мин
                      </strong>
                      . По истечении таймера тест завершится автоматически и покажет вашу итоговую оценку. Выход из окна фиксируется в журнале.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={!canStart}
                    className="w-full py-3.5 px-5 rounded-lg bg-[#9ED164] text-[#111912] font-semibold text-sm hover:bg-[#B4E07F] transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Начать тестирование</span>
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="text-xs text-[#8EA0B0]">Нет настроенных тестирований.</div>
          )}
        </div>
      </div>
    </div>
  );
};

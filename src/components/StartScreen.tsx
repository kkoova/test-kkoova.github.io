import React, { useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';

interface StartScreenProps {
  roster: GroupRoster[];
  totalQuestions: number;
  defaultStudentHint?: string | null;
  onStartTest: (params: { group: string; studentName: string }) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  roster,
  totalQuestions,
  defaultStudentHint,
  onStartTest,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const studentsInGroup = useMemo(() => {
    const found = roster.find((g) => g.name === selectedGroup);
    return found ? found.students : [];
  }, [roster, selectedGroup]);

  const handleGroupChange = (groupName: string) => {
    setSelectedGroup(groupName);
    // Try auto-matching GitHub display name if present in selected group
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
    if (!selectedGroup) {
      setFormError('Пожалуйста, выберите вашу учебную группу.');
      return;
    }
    if (!selectedStudent) {
      setFormError('Пожалуйста, выберите ваше имя из списка.');
      return;
    }
    setFormError(null);
    onStartTest({ group: selectedGroup, studentName: selectedStudent });
  };

  return (
    <div className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-7 sm:p-8 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164] mb-2">
            <span>Практический контроль</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{totalQuestions} заданий</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F6FA] mb-3">
            Тестирование по Godot Engine
          </h1>
          <p className="text-sm text-[#9FB0C0] leading-relaxed mb-6">
            Выберите свою группу и имя из списка, чтобы начать тестирование. Проверка всех ответов и разбор ошибок выполняются автоматически после завершения последнего задания.
          </p>

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
                {roster.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name} ({g.students.length} чел.)
                  </option>
                ))}
              </select>
            </div>

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
                disabled={!selectedGroup}
                onChange={(e) => {
                  setSelectedStudent(e.target.value);
                  setFormError(null);
                }}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-3 text-sm text-[#F1F6FA] focus:outline-none focus:border-[#9ED164] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <option value="">
                  {selectedGroup ? '— Выберите ваше имя —' : '— Сначала выберите группу —'}
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
                <span>Контроль академической честности</span>
              </div>
              <p className="text-xs text-[#91A2B2] leading-relaxed">
                Во время прохождения теста запрещено переключать вкладки, сворачивать браузер или выходить из окна тестирования. Каждая попытка автоматически фиксируется в журнале преподавателя в реальном времени.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-5 rounded-lg bg-[#9ED164] text-[#111912] font-semibold text-sm hover:bg-[#B4E07F] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Начать тестирование</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

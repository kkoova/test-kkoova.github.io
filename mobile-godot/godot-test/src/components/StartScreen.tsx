import React, { useMemo, useState } from 'react';
import { Monitor, ShieldAlert, ShieldCheck, LogIn, LogOut, Users } from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';

interface StartScreenProps {
  roster: GroupRoster[];
  totalQuestions: number;
  isAdmin: boolean;
  adminEmailOrName: string | null;
  authLoading: boolean;
  authError: string | null;
  onAdminGitHubSignIn: () => void;
  onAdminPreviewFallback: () => void;
  onAdminSignOut: () => void;
  onOpenAdminPanel: () => void;
  onStartTest: (params: { group: string; studentName: string }) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  roster,
  totalQuestions,
  isAdmin,
  adminEmailOrName,
  authLoading,
  authError,
  onAdminGitHubSignIn,
  onAdminPreviewFallback,
  onAdminSignOut,
  onOpenAdminPanel,
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
    setSelectedStudent('');
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
    <div className="min-h-screen flex flex-col bg-[#0F141A]">
      {/* Top Bar */}
      <header className="w-full border-b border-[#222D38] bg-[#131A22]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="w-9 h-9 rounded-md bg-[#213124] border border-[#5D8247] flex items-center justify-center font-mono font-bold text-[#CBEF9C]">
              G
            </div>
            <span className="text-base font-bold tracking-tight text-[#F1F6FA]">
              Godot System Check
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isAdmin ? (
              <>
                <span className="hidden sm:inline text-xs text-[#8EA0B0] font-mono">
                  Администратор: {adminEmailOrName || 'Преподаватель'}
                </span>
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>Панель преподавателя</span>
                </button>
                <a
                  href="?view=monitor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#344656] bg-[#161F28] text-[#D7E0E8] text-xs font-medium hover:border-[#9ED164] transition-colors whitespace-nowrap shrink-0"
                >
                  <Monitor className="w-4 h-4" />
                  <span>2-й экран</span>
                </a>
                <button
                  type="button"
                  onClick={onAdminSignOut}
                  title="Выйти из режима администратора"
                  className="p-2 rounded-md border border-[#2A3744] text-[#8EA0B0] hover:text-white hover:border-[#495F73] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={authLoading}
                onClick={onAdminGitHubSignIn}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#2F4050] bg-[#161F28] text-[#B7C5D3] text-xs font-medium hover:border-[#5D8247] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Проверка входа...' : 'Вход для преподавателя'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          {authError && (
            <div className="mb-5 p-4 rounded-lg border border-[#E5A454]/50 bg-[#251E15] text-sm text-[#F3D3A7] space-y-2.5">
              <div className="font-semibold text-[#E5A454]">Авторизация GitHub в текущем окне ограничена</div>
              <p className="text-xs leading-relaxed text-[#D8C2A2]">{authError}</p>
              <button
                type="button"
                onClick={onAdminPreviewFallback}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#E5A454] text-[#1A140C] text-xs font-semibold hover:bg-[#F0B469] cursor-pointer"
              >
                Открыть панель преподавателя в режиме предпросмотра
              </button>
            </div>
          )}

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

            {/* Student Group & Name Selection Form */}
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

              {/* Anti-Cheat Notice */}
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
      </main>
    </div>
  );
};

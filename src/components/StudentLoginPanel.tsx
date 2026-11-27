import React, { useMemo, useState } from 'react';
import { KeyRound, Lock, LogIn, ShieldCheck, UserCheck } from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import {
  loginOrRegisterStudent,
  makeStudentAccountId,
  StudentAccount,
  StudentSessionUser,
} from '../services/studentAuthService';

interface StudentLoginPanelProps {
  roster: GroupRoster[];
  accounts: Record<string, StudentAccount>;
  authLoading: boolean;
  onStudentLoginSuccess: (session: StudentSessionUser) => void;
  onTeacherSignIn: () => void;
}

export const StudentLoginPanel: React.FC<StudentLoginPanelProps> = ({
  roster,
  accounts,
  authLoading,
  onStudentLoginSuccess,
  onTeacherSignIn,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>(roster[0]?.name || '');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const studentsInGroup = useMemo(() => {
    return roster.find((g) => g.name === selectedGroup)?.students || [];
  }, [roster, selectedGroup]);

  const selectedAccount = useMemo(() => {
    if (!selectedGroup || !selectedStudent) return null;
    const id = makeStudentAccountId(selectedGroup, selectedStudent);
    return accounts[id] || null;
  }, [accounts, selectedGroup, selectedStudent]);

  const isExistingAccount = Boolean(selectedAccount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await loginOrRegisterStudent({
        group: selectedGroup,
        studentName: selectedStudent,
        password,
        confirmPassword: isExistingAccount ? undefined : confirmPassword,
        cachedAccounts: accounts,
      });
      if (!res.ok || !res.session) {
        setError(res.error || 'Не удалось выполнить вход.');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      onStudentLoginSuccess(res.session);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-8 space-y-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="w-11 h-11 rounded-lg bg-[#213124] border border-[#5D8247] flex items-center justify-center font-mono text-xl font-bold text-[#CBEF9C]">
          G
        </div>
        <button
          type="button"
          disabled={authLoading}
          onClick={onTeacherSignIn}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#344656] bg-[#11171D] text-[11px] font-medium text-[#9FB0C0] hover:text-white hover:border-[#9ED164] transition-colors cursor-pointer disabled:opacity-50"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#9ED164]" />
          <span>{authLoading ? 'Вход...' : 'Вход для преподавателя'}</span>
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-mono text-[#9ED164]">Авторизация студента</div>
        <h1 className="text-2xl font-bold text-white">Mobile Godot</h1>
        <p className="text-xs text-[#9FB0C0] leading-relaxed">
          Выберите вашу группу, ФИО и введите пароль. При первом входе пароль сохранится за вами, и другие студенты не смогут зайти под вашим именем.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
            Учебная группа
          </label>
          <select
            value={selectedGroup}
            onChange={(e) => {
              setSelectedGroup(e.target.value);
              setSelectedStudent('');
              setPassword('');
              setConfirmPassword('');
              setError(null);
            }}
            className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#9ED164]"
          >
            <option value="">— Выберите группу —</option>
            {roster.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
            Ваше ФИО
          </label>
          <select
            value={selectedStudent}
            disabled={!selectedGroup}
            onChange={(e) => {
              setSelectedStudent(e.target.value);
              setPassword('');
              setConfirmPassword('');
              setError(null);
            }}
            className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#9ED164] disabled:opacity-45"
          >
            <option value="">— Выберите ФИО из списка —</option>
            {studentsInGroup.map((name) => {
              const id = makeStudentAccountId(selectedGroup, name);
              const claimed = Boolean(accounts[id]);
              return (
                <option key={name} value={name}>
                  {name} {claimed ? '🔒 (пароль задан)' : '✨ (первый вход)'}
                </option>
              );
            })}
          </select>
        </div>

        {selectedStudent && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              isExistingAccount
                ? 'border-[#344656] bg-[#11171D] text-[#B7C5D3]'
                : 'border-[#5D8247]/70 bg-[#18241C] text-[#CBEF9C]'
            }`}
          >
            {isExistingAccount ? (
              <>
                <Lock className="w-4 h-4 text-[#E5A454] shrink-0 mt-0.5" />
                <span>
                  Аккаунт уже активирован. Введите пароль, сохранённый при первом входе.
                </span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 text-[#9ED164] shrink-0 mt-0.5" />
                <span>
                  Первый вход! Придумайте пароль (от 4 символов) — он навсегда закрепит это ФИО за вами.
                </span>
              </>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
            {isExistingAccount ? 'Пароль' : 'Придумайте пароль'}
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-[#6C7E8E] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              disabled={!selectedStudent}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isExistingAccount ? 'Введите ваш пароль' : 'Минимум 4 символа'
              }
              className="w-full bg-[#0F141A] border border-[#344656] rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164] disabled:opacity-45"
            />
          </div>
        </div>

        {selectedStudent && !isExistingAccount && (
          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
              Повторите пароль
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
            />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border border-[#E06C75]/50 bg-[#2D181B] text-xs text-[#FFB8BE]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !selectedGroup || !selectedStudent || !password}
          className="w-full py-3.5 px-4 rounded-lg bg-[#9ED164] text-[#111912] text-sm font-bold hover:bg-[#B4E07F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <LogIn className="w-4 h-4" />
          <span>
            {submitting
              ? 'Проверка...'
              : isExistingAccount
                ? 'Войти в аккаунт'
                : 'Сохранить пароль и войти'}
          </span>
        </button>
      </form>
    </div>
  );
};

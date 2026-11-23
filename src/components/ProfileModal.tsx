import React, { useMemo } from 'react';
import { Award, CheckCircle2, GraduationCap, X } from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import { Mission } from '../services/courseService';
import {
  computeStudentSemesterSummary,
  formatGradeValue,
  GradebookConfig,
  makeGradebookKey,
  normalizeStudentRecord,
  StudentSession,
} from '../services/telemetryService';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  displayName: string;
  email: string;
  photoUrl: string | null;
  missions: Mission[];
  gradebook: GradebookConfig;
  roster: GroupRoster[];
  testSessions: StudentSession[];
  onOpenProjectGuide: () => void;
}

function readStoredStudentSelection(): { group: string; student: string } | null {
  try {
    const raw = localStorage.getItem('godot_selected_student_grade_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.group === 'string' && typeof parsed.student === 'string') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  onClose,
  displayName,
  email,
  photoUrl,
  missions,
  gradebook,
  roster,
  testSessions,
  onOpenProjectGuide,
}) => {
  const selection = useMemo(() => {
    const stored = readStoredStudentSelection();
    if (stored?.group && stored?.student) return stored;
    const hintLower = displayName.trim().toLowerCase();
    for (const grp of roster) {
      const match = grp.students.find((s) => s.toLowerCase() === hintLower);
      if (match) return { group: grp.name, student: match };
    }
    return null;
  }, [displayName, roster, open]);

  if (!open) return null;

  const completedTests = testSessions.filter((s) => s.status === 'completed');
  const labsTotal = Math.max(1, gradebook.labsCount || 6);
  const record = selection
    ? normalizeStudentRecord(
        gradebook.records[makeGradebookKey(selection.group, selection.student)],
        labsTotal
      )
    : null;
  const summary = record ? computeStudentSemesterSummary(record, gradebook) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-xl border border-[#344656] bg-[#161E27] p-6 space-y-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#24303C] pb-4">
          <h2 className="text-base font-bold text-white">Профиль студента</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md border border-[#2A3744] text-[#8EA0B0] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl border border-[#344656] object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl border border-[#5D8247] bg-[#213124] flex items-center justify-center font-mono text-xl font-bold text-[#CBEF9C]">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-lg font-bold text-white truncate">{displayName}</div>
            <div className="text-xs font-mono text-[#8EA0B0] truncate">
              {email || 'GitHub аккаунт'}
            </div>
          </div>
        </div>

        {/* Winter Semester Summary */}
        <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164]">
              <GraduationCap className="w-4 h-4" />
              <span>{gradebook.semesterLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProjectGuide();
              }}
              className="text-xs font-mono text-[#7CC4FA] hover:underline cursor-pointer"
            >
              Подробнее
            </button>
          </div>

          {selection && record && summary ? (
            <div className="space-y-2.5 text-xs">
              <div className="text-[#D7E0E8]">
                <strong className="text-white">{selection.student}</strong> · {selection.group}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded border border-[#24303C] bg-[#161E27]">
                  <div className="text-[11px] text-[#8EA0B0]">Лабы</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {summary.labsCompleted}/{summary.labsTotal}
                  </div>
                </div>
                <div className="p-2.5 rounded border border-[#24303C] bg-[#161E27]">
                  <div className="text-[11px] text-[#8EA0B0]">Промеж.</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {formatGradeValue(record.midtermTest)}
                  </div>
                </div>
                <div className="p-2.5 rounded border border-[#24303C] bg-[#161E27]">
                  <div className="text-[11px] text-[#8EA0B0]">Посещ.</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {record.attendance !== null ? `${record.attendance}%` : '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded border border-[#24303C] bg-[#161E27]">
                  <div className="text-[11px] text-[#8EA0B0]">Итог</div>
                  <div className="font-mono font-bold text-[#9ED164] mt-0.5">
                    {summary.semesterGradeShort}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#8EA0B0]">
              Откройте раздел «Зачёт и проект» и выберите своё ФИО в группе, чтобы видеть сводку оценок и статус итогового теста.
            </p>
          )}
        </div>

        {/* Course Modules count */}
        <div className="p-3.5 rounded-lg border border-[#24303C] bg-[#11171D] flex items-center justify-between text-xs">
          <span className="text-[#9FB0C0] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#9ED164]" />
            <span>Доступно практических модулей курса</span>
          </span>
          <span className="font-mono font-bold text-white tabular-nums">{missions.length}</span>
        </div>

        {/* Godot Test Results */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-mono text-[#8EA0B0]">
            Результаты тестирования ({completedTests.length})
          </h3>
          {completedTests.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-[#2A3744] text-xs text-[#7C8D9C] text-center">
              Тестирование ещё не пройдено. Перейдите во вкладку «Тестирования».
            </div>
          ) : (
            <div className="space-y-2">
              {completedTests.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-3 rounded-lg border border-[#24303C] bg-[#11171D] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Award className="w-4 h-4 text-[#9ED164] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {t.studentName} · {t.group}
                      </div>
                      <div className="text-[#8EA0B0] font-mono tabular-nums">
                        {t.gradeLabel} · Нарушений: {t.violationsCount}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#9ED164] tabular-nums shrink-0">
                    {t.score}/{t.totalQuestions} ({t.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

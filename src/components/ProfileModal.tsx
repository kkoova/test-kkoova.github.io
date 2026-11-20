import React from 'react';
import { ExternalLink, CheckCircle2, Award, X } from 'lucide-react';
import { Mission, MissionSubmission } from '../services/courseService';
import { StudentSession } from '../services/telemetryService';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  displayName: string;
  email: string;
  photoUrl: string | null;
  missions: Mission[];
  submissions: MissionSubmission[];
  testSessions: StudentSession[];
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  open,
  onClose,
  displayName,
  email,
  photoUrl,
  missions,
  submissions,
  testSessions,
}) => {
  if (!open) return null;

  const totalMissions = Math.max(1, missions.length);
  const completedCount = submissions.length;
  const percent = Math.min(100, Math.round((completedCount / totalMissions) * 100));

  const missionTitleMap = new Map(missions.map((m) => [m.id, m.title]));
  const completedTests = testSessions.filter((s) => s.status === 'completed');

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
          <h2 className="text-base font-bold text-white">Профиль разработчика</h2>
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
            <div className="text-xs font-mono text-[#8EA0B0] truncate">{email || 'GitHub аккаунт'}</div>
          </div>
        </div>

        {/* Course Progress */}
        <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#9FB0C0]">Прогресс по миссиям курса</span>
            <span className="font-mono font-bold text-[#9ED164] tabular-nums">
              {completedCount} / {totalMissions} ({percent}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#222D38] overflow-hidden">
            <div
              className="h-full bg-[#9ED164] transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Submitted Missions */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-mono text-[#8EA0B0]">
            Сданные проекты ({submissions.length})
          </h3>
          {submissions.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-[#2A3744] text-xs text-[#7C8D9C] text-center">
              Пока нет сданных миссий. Выберите миссию на карте и прикрепите ссылку на GitHub.
            </div>
          ) : (
            <div className="divide-y divide-[#222D38] rounded-lg border border-[#24303C] bg-[#11171D]">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-[#9ED164] shrink-0" />
                    <span className="font-medium text-[#E6EDF3] truncate">
                      {missionTitleMap.get(sub.topicId) || sub.topicId}
                    </span>
                  </div>
                  <a
                    href={sub.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[#7CC4FA] hover:underline shrink-0"
                  >
                    <span>Репозиторий</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Godot Test Results */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-mono text-[#8EA0B0]">
            Результаты итогового тестирования ({completedTests.length})
          </h3>
          {completedTests.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-[#2A3744] text-xs text-[#7C8D9C] text-center">
              Тестирование ещё не пройдено. Перейдите во вкладку «Тестирование».
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

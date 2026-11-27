import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Gamepad2,
  LayoutGrid,
  Network,
  Play,
  X,
} from 'lucide-react';
import { Mission } from '../services/courseService';
import { GroupRoster } from '../data/defaultRoster';
import { GradebookConfig, ProjectGuideConfig } from '../services/telemetryService';
import { ProjectGuideBanner } from './ProjectGuideView';

interface CoursePortalViewProps {
  missions: Mission[];
  fallbackName: string;
  projectGuide: ProjectGuideConfig;
  gradebook: GradebookConfig;
  roster: GroupRoster[];
  lockedStudent?: { group: string; studentName: string } | null;
  onOpenLesson: (tutorialDoc: string) => void;
  onOpenTest: () => void;
  onOpenProjectGuide: () => void;
}

const STEPS_STORAGE_KEY = 'mobile_godot_steps_progress_v1';

function readStepsProgress(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(STEPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export const CoursePortalView: React.FC<CoursePortalViewProps> = ({
  missions,
  fallbackName,
  projectGuide,
  gradebook,
  roster,
  lockedStudent = null,
  onOpenLesson,
  onOpenTest,
  onOpenProjectGuide,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [hoveredMission, setHoveredMission] = useState<{
    mission: Mission;
    index: number;
  } | null>(null);

  // Mission step checklist state persisted locally
  const [stepsProgress, setStepsProgress] = useState<Record<string, number[]>>(() =>
    readStepsProgress()
  );

  const totalStepsAll = useMemo(
    () => missions.reduce((sum, m) => sum + m.steps.length, 0),
    [missions]
  );
  const completedStepsAll = useMemo(
    () =>
      missions.reduce(
        (sum, m) => sum + Math.min(m.steps.length, stepsProgress[m.id]?.length || 0),
        0
      ),
    [missions, stepsProgress]
  );
  const courseProgressPct =
    totalStepsAll > 0 ? Math.round((completedStepsAll / totalStepsAll) * 100) : 0;

  // Deterministic snake graph coordinates for Map view
  const graphNodes = useMemo(() => {
    const cols = 3;
    const offsets = [
      { dx: -2, dy: -2 },
      { dx: 3, dy: 2 },
      { dx: -3, dy: 3 },
      { dx: 2, dy: -3 },
      { dx: 0, dy: 2 },
    ];
    return missions.map((mission, index) => {
      const row = Math.floor(index / cols);
      let col = index % cols;
      if (row % 2 !== 0) col = cols - 1 - col;
      const off = offsets[index % offsets.length];
      const x = 18 + col * 32 + off.dx;
      const y = 14 + row * 24 + off.dy;
      return { mission, index, x, y };
    });
  }, [missions]);

  const toggleStep = (missionId: string, stepIdx: number) => {
    setStepsProgress((prev) => {
      const current = new Set(prev[missionId] || []);
      if (current.has(stepIdx)) current.delete(stepIdx);
      else current.add(stepIdx);
      const next = { ...prev, [missionId]: Array.from(current) };
      try {
        localStorage.setItem(STEPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const openMissionModal = (m: Mission) => {
    setActiveMission(m);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Course Hero & Summary */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164]">
            <span>Курс мобильной разработки</span>
            <span aria-hidden="true">·</span>
            <span>Godot Engine 4</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F6FA]">
            Миссии и практические проекты
          </h1>
          <p className="text-sm text-[#9FB0C0] leading-relaxed">
            Открывайте интерактивные сборки, изучайте методические инструкции и отмечайте выполненные этапы по каждой практической работе.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
          <div className="p-3.5 rounded-lg border border-[#26323F] bg-[#11171D] min-w-[230px]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#8EA0B0]">Пройдено этапов</span>
              <span className="font-mono font-bold text-[#9ED164] tabular-nums">
                {completedStepsAll} / {totalStepsAll} ({courseProgressPct}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#222D38] overflow-hidden">
              <div
                className="h-full bg-[#9ED164] transition-all duration-300"
                style={{ width: `${courseProgressPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-1 rounded-lg bg-[#11171D] border border-[#26323F]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#253240] text-white'
                    : 'text-[#8EA0B0] hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Карточки</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-[#253240] text-white'
                    : 'text-[#8EA0B0] hover:text-white'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Карта графа</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenTest}
              className="px-4 py-2 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors whitespace-nowrap cursor-pointer"
            >
              Пройти тест
            </button>
          </div>
        </div>
      </section>

      {/* Prominent Semester 1 Credit Requirements, Grades & Project Defense Banner */}
      <ProjectGuideBanner
        guide={projectGuide}
        gradebook={gradebook}
        roster={roster}
        defaultStudentHint={fallbackName}
        lockedStudent={lockedStudent}
        onOpenGuide={onOpenProjectGuide}
      />

      {/* VIEW 1: Clean Cards Grid */}
      {viewMode === 'grid' && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {missions.map((mission, idx) => {
            const checkedSteps = stepsProgress[mission.id]?.length || 0;
            const totalSteps = mission.steps.length;
            const allStepsDone = totalSteps > 0 && checkedSteps >= totalSteps;

            return (
              <div
                key={mission.id}
                onClick={() => openMissionModal(mission)}
                className="group rounded-xl border border-[#2A3744] bg-[#161E27] overflow-hidden flex flex-col hover:border-[#62854B] transition-colors cursor-pointer"
              >
                <div className="relative h-44 bg-[#0B0F14] border-b border-[#24303C] overflow-hidden">
                  {mission.preview_img ? (
                    <img
                      src={`./${mission.preview_img}`}
                      alt={mission.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform duration-200"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#161E27] via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[#CBEF9C] tabular-nums">
                      Модуль {String(idx + 1).padStart(2, '0')}
                    </span>
                    {allStepsDone && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#9ED164]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Этапы пройдены</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-[#F1F6FA] mb-1.5 group-hover:text-[#CBEF9C] transition-colors">
                      {mission.title}
                    </h2>
                    <p className="text-xs text-[#9FB0C0] leading-relaxed line-clamp-2">
                      {mission.subtitle}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#222D38] flex items-center justify-between text-xs">
                    <span className="font-mono text-[#8EA0B0] tabular-nums">
                      Этапы: {checkedSteps}/{totalSteps}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#9ED164]">
                      <Play className="w-3.5 h-3.5" />
                      <span>Открыть</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* VIEW 2: Interactive Connected Node Map */}
      {viewMode === 'map' && (
        <section className="rounded-xl border border-[#2A3744] bg-[#11171D] p-6 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="text-xs font-mono text-[#8EA0B0]">
              Нажмите на узел графа, чтобы открыть интерактивную сборку и шаги миссии
            </div>
            {hoveredMission && (
              <div className="text-xs text-[#CBEF9C] font-medium">
                {hoveredMission.mission.title} — {hoveredMission.mission.subtitle}
              </div>
            )}
          </div>

          <div className="relative w-full h-[640px] rounded-lg border border-[#222D38] bg-[#0B0F14] overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {graphNodes.slice(0, -1).map((p1, i) => {
                const p2 = graphNodes[i + 1];
                const dx = Math.abs(p2.x - p1.x);
                const cx1 = p1.x + dx * 0.5;
                const cy1 = p1.y;
                const cx2 = p2.x - dx * 0.5;
                const cy2 = p2.y;
                const isHighlighted =
                  hoveredMission &&
                  (hoveredMission.index === i || hoveredMission.index === i + 1);

                return (
                  <path
                    key={`${p1.mission.id}-${p2.mission.id}`}
                    d={`M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    stroke={isHighlighted ? '#9ED164' : '#2C3A48'}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    strokeDasharray="4 4"
                  />
                );
              })}
            </svg>

            {graphNodes.map(({ mission, index, x, y }) => {
              const checkedSteps = stepsProgress[mission.id]?.length || 0;
              const allStepsDone = mission.steps.length > 0 && checkedSteps >= mission.steps.length;
              const isHovered = hoveredMission?.mission.id === mission.id;

              return (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => openMissionModal(mission)}
                  onMouseEnter={() => setHoveredMission({ mission, index })}
                  onMouseLeave={() => setHoveredMission(null)}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-32 p-3 rounded-xl border text-center transition-colors cursor-pointer ${
                    isHovered
                      ? 'bg-[#213124] border-[#9ED164] z-20'
                      : allStepsDone
                        ? 'bg-[#16231A] border-[#4A7039] z-10'
                        : 'bg-[#161E27] border-[#2A3744] hover:border-[#62854B] z-10'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 font-mono text-base font-bold text-[#F1F6FA] tabular-nums">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {allStepsDone && <CheckCircle2 className="w-3.5 h-3.5 text-[#9ED164]" />}
                  </div>
                  <div className="mt-1 text-[11px] text-[#9FB0C0] truncate">{mission.title}</div>
                </button>
              );
            })}

            {/* Hover Preview Box */}
            {hoveredMission && (
              <div className="hidden lg:block absolute right-4 bottom-4 w-72 rounded-xl border border-[#344656] bg-[#161E27]/95 backdrop-blur-md overflow-hidden shadow-2xl pointer-events-none z-30">
                {hoveredMission.mission.preview_img && (
                  <img
                    src={`./${hoveredMission.mission.preview_img}`}
                    alt={hoveredMission.mission.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover border-b border-[#24303C]"
                  />
                )}
                <div className="p-3.5 space-y-1">
                  <div className="text-xs font-bold text-[#CBEF9C]">
                    {hoveredMission.mission.title}
                  </div>
                  <div className="text-[11px] text-[#9FB0C0] leading-relaxed">
                    {hoveredMission.mission.subtitle}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Mission Workspace Modal */}
      {activeMission && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
          onClick={() => setActiveMission(null)}
        >
          <div
            className="w-full max-w-6xl h-[86vh] rounded-xl border border-[#344656] bg-[#161E27] flex flex-col lg:flex-row overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left 2/3: Godot Build Iframe */}
            <div className="flex-[2] flex flex-col border-b lg:border-b-0 lg:border-r border-[#2A3744] bg-[#0B0F14] min-h-[280px]">
              <div className="px-4 py-3 border-b border-[#222D38] bg-[#131A22] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Gamepad2 className="w-4 h-4 text-[#9ED164] shrink-0" />
                  <span className="text-sm font-bold text-white truncate">
                    {activeMission.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveMission(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#344656] text-xs text-[#9FB0C0] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Закрыть</span>
                </button>
              </div>

              {activeMission.godot_path ? (
                <iframe
                  title={activeMission.title}
                  src={`./${activeMission.godot_path}`}
                  className="w-full flex-1 bg-black border-0"
                  allow="fullscreen"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <Gamepad2 className="w-10 h-10 text-[#6C7E8E]" />
                  <div className="text-sm font-semibold text-white">
                    Индивидуальный проект студента
                  </div>
                  <p className="text-xs text-[#8EA0B0] max-w-md leading-relaxed">
                    Для этой миссии нет готового демо-примера. Разработайте собственную игру в Godot Engine по предложенным этапам и подготовьте к предзащите.
                  </p>
                </div>
              )}
            </div>

            {/* Right 1/3: Steps Checklist + Lesson + Submit */}
            <div className="flex-1 flex flex-col justify-between bg-[#161E27] p-5 overflow-y-auto gap-5">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-mono text-[#9ED164] mb-1">План миссии</div>
                  <p className="text-xs text-[#9FB0C0] leading-relaxed">
                    {activeMission.subtitle}
                  </p>
                </div>

                {(() => {
                  const doneList = stepsProgress[activeMission.id] || [];
                  const total = Math.max(1, activeMission.steps.length);
                  const pct = Math.round((doneList.length / total) * 100);
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono text-[#8EA0B0] tabular-nums">
                        <span>Прогресс шагов</span>
                        <span className="text-[#9ED164]">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#222D38] overflow-hidden">
                        <div
                          className="h-full bg-[#9ED164] transition-all duration-200"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  {activeMission.steps.map((step, sIdx) => {
                    const checked = (stepsProgress[activeMission.id] || []).includes(sIdx);
                    return (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => toggleStep(activeMission.id, sIdx)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          checked
                            ? 'bg-[#213124] border-[#5D8247] text-[#E6EDF3]'
                            : 'bg-[#11171D] border-[#24303C] text-[#B7C5D3] hover:border-[#45586B]'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 shrink-0 rounded flex items-center justify-center border ${
                            checked
                              ? 'bg-[#9ED164] border-[#9ED164] text-[#111912]'
                              : 'border-[#45586B] bg-[#0F141A]'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        <span className={checked ? 'line-through opacity-75' : ''}>{step}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              {activeMission.tutorial_url && (
                <div className="pt-4 border-t border-[#24303C]">
                  <button
                    type="button"
                    onClick={() => {
                      const docUrl = activeMission.tutorial_url;
                      setActiveMission(null);
                      onOpenLesson(docUrl);
                    }}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Открыть методичку</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

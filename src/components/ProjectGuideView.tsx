import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  FileText,
  GraduationCap,
  Layers,
  Presentation,
  Save,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import {
  computeStudentSemesterSummary,
  formatGradeValue,
  formatScheduledDateRu,
  getDefaultStudentRecord,
  GradebookConfig,
  GradeValue,
  makeGradebookKey,
  normalizeStudentRecord,
  ProjectGuideConfig,
  saveProjectGuide,
} from '../services/telemetryService';

const SELECTED_STUDENT_STORAGE_KEY = 'godot_selected_student_grade_v1';

function readStoredStudentSelection(): { group: string; student: string } | null {
  try {
    const raw = localStorage.getItem(SELECTED_STUDENT_STORAGE_KEY);
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

function saveStoredStudentSelection(group: string, student: string) {
  try {
    localStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, JSON.stringify({ group, student }));
  } catch {
    // ignore
  }
}

function useSelectedStudent(roster: GroupRoster[], defaultStudentHint?: string | null) {
  const [selectedGroup, setSelectedGroup] = useState<string>(() => {
    const stored = readStoredStudentSelection();
    if (stored && roster.some((g) => g.name === stored.group)) return stored.group;
    return roster[0]?.name || '';
  });

  const [selectedStudent, setSelectedStudent] = useState<string>(() => {
    const stored = readStoredStudentSelection();
    if (stored?.student) return stored.student;
    return '';
  });

  useEffect(() => {
    if (!roster.some((g) => g.name === selectedGroup)) {
      const firstGroup = roster[0]?.name || '';
      setSelectedGroup(firstGroup);
    }
  }, [roster, selectedGroup]);

  useEffect(() => {
    if (selectedStudent || !defaultStudentHint) return;
    const hintLower = defaultStudentHint.trim().toLowerCase();
    for (const grp of roster) {
      const found = grp.students.find((s) => s.toLowerCase() === hintLower);
      if (found) {
        setSelectedGroup(grp.name);
        setSelectedStudent(found);
        saveStoredStudentSelection(grp.name, found);
        break;
      }
    }
  }, [defaultStudentHint, roster, selectedStudent]);

  const groupStudents = useMemo(() => {
    return roster.find((g) => g.name === selectedGroup)?.students || [];
  }, [roster, selectedGroup]);

  const handleGroupChange = (grpName: string) => {
    setSelectedGroup(grpName);
    setSelectedStudent('');
    saveStoredStudentSelection(grpName, '');
  };

  const handleStudentChange = (stName: string) => {
    setSelectedStudent(stName);
    saveStoredStudentSelection(selectedGroup, stName);
  };

  return {
    selectedGroup,
    selectedStudent,
    groupStudents,
    handleGroupChange,
    handleStudentChange,
  };
}

function gradeBadgeClasses(val: GradeValue): string {
  if (val === 5 || val === 'pass') {
    return 'bg-[#1D2D21] border-[#4E7A45] text-[#CBEF9C]';
  }
  if (val === 4) {
    return 'bg-[#172634] border-[#396187] text-[#9ED3FF]';
  }
  if (val === 3) {
    return 'bg-[#261E14] border-[#78572D] text-[#F3D3A7]';
  }
  if (val === 2) {
    return 'bg-[#2D181B] border-[#7D3A42] text-[#FFB8BE]';
  }
  return 'bg-[#11171D] border-[#26323F] text-[#7C8D9C]';
}

interface ProjectGuideBannerProps {
  guide: ProjectGuideConfig;
  gradebook: GradebookConfig;
  roster: GroupRoster[];
  defaultStudentHint?: string | null;
  onOpenGuide: () => void;
}

export const ProjectGuideBanner: React.FC<ProjectGuideBannerProps> = ({
  guide,
  gradebook,
  roster,
  defaultStudentHint,
  onOpenGuide,
}) => {
  const {
    selectedGroup,
    selectedStudent,
    groupStudents,
    handleGroupChange,
    handleStudentChange,
  } = useSelectedStudent(roster, defaultStudentHint);

  const scheduledGroups = roster
    .map((g) => ({
      group: g.name,
      info: guide.groupDates?.[g.name],
    }))
    .filter((item) => item.info?.date);

  const labsTotal = Math.max(1, gradebook.labsCount || 6);
  const studentRecord = useMemo(() => {
    if (!selectedGroup || !selectedStudent) return null;
    const raw = gradebook.records[makeGradebookKey(selectedGroup, selectedStudent)];
    return normalizeStudentRecord(raw, labsTotal);
  }, [gradebook.records, labsTotal, selectedGroup, selectedStudent]);

  const studentSummary = useMemo(() => {
    if (!studentRecord) return null;
    return computeStudentSemesterSummary(studentRecord, gradebook);
  }, [studentRecord, gradebook]);

  return (
    <section className="rounded-xl border border-[#4A683B] bg-gradient-to-br from-[#19241C] via-[#151D25] to-[#161E27] p-5 sm:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="space-y-2.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#9ED164]">
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span>{gradebook.semesterLabel || 'Зимний семестр'}</span>
            <span aria-hidden="true">·</span>
            <span>Требования к зачёту и предзащита проекта</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#F1F6FA]">
            Условия зачёта, оценки и предзащита проекта
          </h2>

          {/* Credit Requirements Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="px-3 py-2 rounded-lg border border-[#2C3D34] bg-[#101814]">
              <div className="text-[11px] font-mono text-[#8EA0B0]">Практика</div>
              <div className="text-xs font-bold text-white mt-0.5">
                {labsTotal} лаб. работ
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg border border-[#2C3D34] bg-[#101814]">
              <div className="text-[11px] font-mono text-[#8EA0B0]">Контроль 1</div>
              <div className="text-xs font-bold text-white mt-0.5">1 промеж. тест</div>
            </div>
            <div className="px-3 py-2 rounded-lg border border-[#4A3B28] bg-[#181511]">
              <div className="text-[11px] font-mono text-[#E5A454]">
                Посещ. &lt; {gradebook.attendanceThreshold}%
              </div>
              <div className="text-xs font-bold text-[#F3D3A7] mt-0.5">2 итоговый тест</div>
            </div>
            <div className="px-3 py-2 rounded-lg border border-[#2C3D34] bg-[#101814]">
              <div className="text-[11px] font-mono text-[#8EA0B0]">{guide.slidesRange}</div>
              <div className="text-xs font-bold text-[#CBEF9C] mt-0.5">Предзащита проекта</div>
            </div>
          </div>

          {scheduledGroups.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-2">
              {scheduledGroups.map(({ group, info }) => (
                <div
                  key={group}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#32463A] bg-[#101814] text-[11px]"
                >
                  <CalendarClock className="w-3.5 h-3.5 text-[#E5A454] shrink-0" />
                  <span className="font-semibold text-white">{group}:</span>
                  <span className="font-mono text-[#CBEF9C]">
                    {formatScheduledDateRu(info!.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2.5">
          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Мои оценки, зачёт и методичка</span>
          </button>
          <span className="text-[11px] text-[#9FB0C0] font-mono text-center sm:text-right">
            {guide.pitchDuration}
          </span>
        </div>
      </div>

      {/* Inline Quick Student Grade Lookup */}
      <div className="pt-4 border-t border-[#2B3B33] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <UserCheck className="w-4 h-4 text-[#9ED164] shrink-0" />
            <span>Быстрая проверка моих оценок и статуса итогового теста:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedGroup}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="bg-[#0F141A] border border-[#344656] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9ED164]"
            >
              {roster.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={selectedStudent}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="bg-[#0F141A] border border-[#344656] rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9ED164] min-w-[190px]"
            >
              <option value="">Выберите ФИО студента...</option>
              {groupStudents.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedStudent && studentRecord && studentSummary && (
          <div className="p-3.5 rounded-lg border border-[#2B3946] bg-[#10161D] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs items-center">
            <div>
              <div className="text-[11px] text-[#8EA0B0]">Лабораторные</div>
              <div className="font-mono font-bold text-white tabular-nums mt-0.5">
                {studentSummary.labsCompleted} / {studentSummary.labsTotal}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8EA0B0]">Промеж. тест</div>
              <div className="font-mono font-bold text-white mt-0.5">
                {formatGradeValue(studentRecord.midtermTest)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8EA0B0]">Посещаемость</div>
              <div
                className={`font-mono font-bold tabular-nums mt-0.5 ${
                  studentRecord.attendance === null
                    ? 'text-[#7C8D9C]'
                    : studentRecord.attendance >= gradebook.attendanceThreshold
                      ? 'text-[#9ED164]'
                      : 'text-[#E5A454]'
                }`}
              >
                {studentRecord.attendance !== null ? `${studentRecord.attendance}%` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8EA0B0]">Итоговый тест №2</div>
              <div className="font-mono font-semibold mt-0.5">
                {studentSummary.needsFinalTest === null ? (
                  <span className="text-[#7C8D9C]">Уточняется</span>
                ) : studentSummary.needsFinalTest ? (
                  <span className="text-[#F3D3A7]">
                    Сдаёт ({formatGradeValue(studentRecord.finalTest)})
                  </span>
                ) : (
                  <span className="text-[#9ED164]">Освобождён</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8EA0B0]">Предзащита</div>
              <div className="font-mono font-bold text-white mt-0.5">
                {formatGradeValue(studentRecord.projectDefense)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#8EA0B0]">Оценка за семестр</div>
              <div
                className={`font-mono font-bold mt-0.5 ${
                  studentSummary.isEligibleForPass
                    ? 'text-[#9ED164]'
                    : studentSummary.semesterGradeShort === 'Долг'
                      ? 'text-[#FFB8BE]'
                      : 'text-[#9FB0C0]'
                }`}
              >
                {studentSummary.semesterGradeLabel}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

interface ProjectGuideViewProps {
  guide: ProjectGuideConfig;
  gradebook: GradebookConfig;
  roster: GroupRoster[];
  isAdmin: boolean;
  defaultStudentHint?: string | null;
  onBack: () => void;
}

const SLIDE_PLAN = [
  {
    num: '01',
    title: 'Титульный слайд',
    desc: 'Название приложения/игры, ФИО автора (или команды), учебная группа, краткий слоган в 1 строку.',
  },
  {
    num: '02',
    title: 'Идея и аудитория',
    desc: 'Какую задачу решает приложение или в чём главная механика игры. Для кого создаётся проект и зачем он пользователю.',
  },
  {
    num: '03',
    title: 'Аналоги и уникальность',
    desc: '2–3 существующих приложения или игры, и чем ваш проект отличается (управление, стиль, фича, формат).',
  },
  {
    num: '04',
    title: 'Ключевой сценарий (MVP)',
    desc: 'Что именно умеет первая версия: основные экраны, базовый игровой цикл или пользовательский путь из 3–4 шагов.',
  },
  {
    num: '05',
    title: 'Наработки 1 семестра',
    desc: 'Скриншоты сцен/макетов, прототип, эскизы, структура папок или уже работающие механики на текущий момент.',
  },
  {
    num: '06',
    title: 'Техническая реализация',
    desc: 'Выбранный стек и инструменты (Godot / движок / язык), ключевые узлы или модули, где хранятся данные.',
  },
  {
    num: '07',
    title: 'Трудности и решения',
    desc: 'С чем столкнулись при проектировании или прототипировании и как решили эти задачи.',
  },
  {
    num: '08',
    title: 'План на 2 семестр',
    desc: 'Конкретные этапы доработки до полноценного релиза: новый функционал, полировка UI, тестирование, сборка.',
  },
];

export const ProjectGuideView: React.FC<ProjectGuideViewProps> = ({
  guide,
  gradebook,
  roster,
  isAdmin,
  defaultStudentHint,
  onBack,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectGuideConfig>(guide);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    selectedGroup,
    selectedStudent,
    groupStudents,
    handleGroupChange,
    handleStudentChange,
  } = useSelectedStudent(roster, defaultStudentHint);

  const labsTotal = Math.max(1, gradebook.labsCount || 6);
  const studentRecord = useMemo(() => {
    if (!selectedGroup || !selectedStudent) return getDefaultStudentRecord(labsTotal);
    const raw = gradebook.records[makeGradebookKey(selectedGroup, selectedStudent)];
    return normalizeStudentRecord(raw, labsTotal);
  }, [gradebook.records, labsTotal, selectedGroup, selectedStudent]);

  const studentSummary = useMemo(
    () => computeStudentSemesterSummary(studentRecord, gradebook),
    [studentRecord, gradebook]
  );

  const groupDefenseInfo = selectedGroup ? guide.groupDates?.[selectedGroup] : undefined;

  const openEditor = () => {
    setDraft(guide);
    setEditing(true);
    setSaveMsg(null);
  };

  const handleGroupDateChange = (
    groupName: string,
    field: 'date' | 'note',
    val: string
  ) => {
    setDraft((prev) => {
      const current = prev.groupDates?.[groupName] || { date: '', note: '' };
      return {
        ...prev,
        groupDates: {
          ...(prev.groupDates || {}),
          [groupName]: { ...current, [field]: val },
        },
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProjectGuide(draft);
      setSaveMsg('Изменения сохранены и видны всем группам.');
      setEditing(false);
    } catch {
      setSaveMsg('Сохранено локально (проверьте права записи Firestore).');
      setEditing(false);
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#344656] bg-[#161E27] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к порталу</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : openEditor())}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors cursor-pointer"
          >
            {editing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span>{editing ? 'Отменить редактирование' : 'Настроить даты и требования'}</span>
          </button>
        )}
      </div>

      {saveMsg && (
        <div className="p-3.5 rounded-lg border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
          {saveMsg}
        </div>
      )}

      {/* Admin Inline Editor */}
      {isAdmin && editing && (
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-[#5D8247] bg-[#161E27] p-6 space-y-5 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-[#24303C] pb-3">
            <h2 className="text-base font-bold text-white">
              Редактирование методички и дат предзащиты по группам
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">Заголовок</label>
              <input
                type="text"
                value={draft.semesterTitle}
                onChange={(e) => setDraft({ ...draft, semesterTitle: e.target.value })}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Объём презентации
              </label>
              <input
                type="text"
                value={draft.slidesRange}
                onChange={(e) => setDraft({ ...draft, slidesRange: e.target.value })}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Тайминг защиты
              </label>
              <input
                type="text"
                value={draft.pitchDuration}
                onChange={(e) => setDraft({ ...draft, pitchDuration: e.target.value })}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
              Краткое описание задачи на 1 семестр
            </label>
            <textarea
              rows={2}
              value={draft.overview}
              onChange={(e) => setDraft({ ...draft, overview: e.target.value })}
              className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
              Комментарий преподавателя / акцент при оценивании
            </label>
            <textarea
              rows={2}
              value={draft.teacherNote}
              onChange={(e) => setDraft({ ...draft, teacherNote: e.target.value })}
              className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
            />
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-mono text-[#9ED164]">
              Даты сдачи и предзащиты для каждой группы
            </div>
            <div className="space-y-2">
              {roster.map((grp) => {
                const entry = draft.groupDates?.[grp.name] || { date: '', note: '' };
                return (
                  <div
                    key={grp.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 rounded-lg border border-[#24303C] bg-[#11171D]"
                  >
                    <div className="md:col-span-4 text-xs font-semibold text-white">
                      {grp.name}
                    </div>
                    <div className="md:col-span-4 flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={entry.date}
                        onChange={(e) => handleGroupDateChange(grp.name, 'date', e.target.value)}
                        className="w-full bg-[#0F141A] border border-[#344656] rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                      />
                      {entry.date && (
                        <button
                          type="button"
                          onClick={() => handleGroupDateChange(grp.name, 'date', '')}
                          className="text-[#7C8D9C] hover:text-white cursor-pointer"
                          title="Очистить дату"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="md:col-span-4">
                      <input
                        type="text"
                        value={entry.note}
                        onChange={(e) => handleGroupDateChange(grp.name, 'note', e.target.value)}
                        placeholder="Аудитория или формат (напр. Очно на паре)"
                        className="w-full bg-[#0F141A] border border-[#344656] rounded px-2.5 py-1.5 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-md border border-[#344656] text-xs text-[#9FB0C0] hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Сохранение...' : 'Сохранить изменения'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SECTION 1: Student Personal Gradebook & Semester Status */}
      <section className="rounded-xl border border-[#4A683B] bg-[#161E27] p-6 sm:p-7 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#24303C] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164]">
              <Award className="w-4 h-4" />
              <span>{gradebook.semesterLabel} · Личная ведомость</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Мои оценки, посещаемость и зачёт
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedGroup}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
            >
              {roster.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={selectedStudent}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164] min-w-[210px]"
            >
              <option value="">Выберите свою фамилию и имя...</option>
              {groupStudents.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!selectedStudent ? (
          <div className="p-6 rounded-lg border border-dashed border-[#344656] bg-[#11171D] text-center space-y-1.5">
            <div className="text-sm font-semibold text-white">
              Выберите группу и своё ФИО в списке справа
            </div>
            <p className="text-xs text-[#8EA0B0]">
              Здесь отобразятся ваши оценки за 6 лабораторных работ, промежуточный тест, посещаемость, необходимость сдавать итоговый тест и итоговая оценка за семестр.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Top Summary Banner: Semester Grade + Attendance & Final Test Rule */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 p-4 rounded-xl border border-[#2A3744] bg-[#11171D] flex flex-col justify-between gap-2">
                <div className="text-xs font-mono text-[#8EA0B0]">
                  Оценка за зимний семестр
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <div
                    className={`text-2xl font-bold ${
                      studentSummary.isEligibleForPass
                        ? 'text-[#9ED164]'
                        : studentSummary.semesterGradeShort === 'Долг'
                          ? 'text-[#FFB8BE]'
                          : 'text-[#9FB0C0]'
                    }`}
                  >
                    {studentSummary.semesterGradeLabel}
                  </div>
                  {studentSummary.numericAverage !== null && (
                    <span className="text-xs font-mono text-[#9FB0C0] tabular-nums">
                      Ср. балл: {studentSummary.numericAverage}
                    </span>
                  )}
                </div>
                {studentSummary.missingItems.length > 0 ? (
                  <div className="text-[11px] text-[#E5A454]">
                    Осталось закрыть: {studentSummary.missingItems.join(', ')}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#9ED164]">
                    Все требования семестра выполнены
                  </div>
                )}
              </div>

              <div className="md:col-span-7 p-4 rounded-xl border border-[#2A3744] bg-[#11171D] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono text-[#8EA0B0]">
                    Посещаемость (порог без итогового теста: {gradebook.attendanceThreshold}%)
                  </span>
                  <span
                    className={`text-base font-mono font-bold tabular-nums ${
                      studentRecord.attendance === null
                        ? 'text-[#7C8D9C]'
                        : studentRecord.attendance >= gradebook.attendanceThreshold
                          ? 'text-[#9ED164]'
                          : 'text-[#E5A454]'
                    }`}
                  >
                    {studentRecord.attendance !== null ? `${studentRecord.attendance}%` : 'Не указана'}
                  </span>
                </div>

                <div className="h-2 rounded-full bg-[#222D38] overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-300 ${
                      studentRecord.attendance !== null &&
                      studentRecord.attendance >= gradebook.attendanceThreshold
                        ? 'bg-[#9ED164]'
                        : 'bg-[#E5A454]'
                    }`}
                    style={{ width: `${studentRecord.attendance ?? 0}%` }}
                  />
                </div>

                <div className="text-xs">
                  {studentSummary.needsFinalTest === null ? (
                    <span className="text-[#8EA0B0]">
                      Когда преподаватель выставит процент посещаемости, здесь автоматически отобразится, нужно ли сдавать Итоговый тест №2.
                    </span>
                  ) : studentSummary.needsFinalTest ? (
                    <span className="text-[#F3D3A7] font-medium">
                      Посещаемость ниже {gradebook.attendanceThreshold}% — сдача Итогового теста №2 обязательна.
                    </span>
                  ) : (
                    <span className="text-[#CBEF9C] font-medium">
                      Хорошая посещаемость (≥ {gradebook.attendanceThreshold}%) — от сдачи Итогового теста №2 вы освобождены.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 6 Labs Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-[#8EA0B0]">
                <span>Лабораторные работы ({studentSummary.labsCompleted} из {labsTotal})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {studentRecord.labs.map((val, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border text-center space-y-1 ${gradeBadgeClasses(val)}`}
                  >
                    <div className="text-[11px] font-mono opacity-80">Лаб {idx + 1}</div>
                    <div className="text-base font-bold font-mono tabular-nums">
                      {formatGradeValue(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tests & Project Pre-Defense */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className={`p-4 rounded-lg border space-y-1 ${gradeBadgeClasses(
                  studentRecord.midtermTest
                )}`}
              >
                <div className="text-xs font-mono opacity-85">1. Промежуточный тест</div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  {formatGradeValue(studentRecord.midtermTest)}
                </div>
                <div className="text-[11px] opacity-75">Обязателен для всех студентов</div>
              </div>

              <div
                className={`p-4 rounded-lg border space-y-1 ${
                  studentSummary.needsFinalTest === false
                    ? 'bg-[#17241A] border-[#4A683B] text-[#CBEF9C]'
                    : studentSummary.needsFinalTest === true
                      ? gradeBadgeClasses(studentRecord.finalTest)
                      : 'bg-[#11171D] border-[#26323F] text-[#8EA0B0]'
                }`}
              >
                <div className="text-xs font-mono opacity-85">2. Итоговый тест</div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  {studentSummary.needsFinalTest === false
                    ? 'Освобождён'
                    : studentSummary.needsFinalTest === true
                      ? formatGradeValue(studentRecord.finalTest)
                      : 'По посещаемости'}
                </div>
                <div className="text-[11px] opacity-75">
                  {studentSummary.needsFinalTest === false
                    ? `Посещ. ≥ ${gradebook.attendanceThreshold}%`
                    : studentSummary.needsFinalTest === true
                      ? `Обязателен (посещ. < ${gradebook.attendanceThreshold}%)`
                      : `Сдают при посещаемости < ${gradebook.attendanceThreshold}%`}
                </div>
              </div>

              <div
                className={`p-4 rounded-lg border space-y-1 ${gradeBadgeClasses(
                  studentRecord.projectDefense
                )}`}
              >
                <div className="text-xs font-mono opacity-85">Предзащита проекта</div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  {formatGradeValue(studentRecord.projectDefense)}
                </div>
                <div className="text-[11px] opacity-75">
                  {groupDefenseInfo?.date
                    ? `Дата: ${formatScheduledDateRu(groupDefenseInfo.date)}`
                    : 'Презентация и наработки'}
                </div>
              </div>
            </div>

            {studentRecord.note && (
              <div className="p-3.5 rounded-lg border border-[#2A3744] bg-[#11171D] text-xs text-[#C7D3DF]">
                <strong className="text-[#9ED164]">Комментарий преподавателя: </strong>
                {studentRecord.note}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 2: Winter Semester Credit Requirements */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#9ED164]" />
          <h2 className="text-lg font-bold text-white">
            Требования к зачёту ({gradebook.semesterLabel})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-1">
            <div className="text-xs font-mono text-[#9ED164]">01 · Практика</div>
            <div className="text-sm font-bold text-white">
              {labsTotal} лабораторных работ
            </div>
            <p className="text-xs text-[#9FB0C0] leading-relaxed">
              Необходимо сдать все практические работы семестра на положительную оценку.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-1">
            <div className="text-xs font-mono text-[#7CC4FA]">02 · Контроль №1</div>
            <div className="text-sm font-bold text-white">1 промежуточный тест</div>
            <p className="text-xs text-[#9FB0C0] leading-relaxed">
              Обязательный срез базовых знаний по узлам, сценам и основам GDScript.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-[#4A3B28] bg-[#181410] space-y-1">
            <div className="text-xs font-mono text-[#E5A454]">03 · Контроль №2</div>
            <div className="text-sm font-bold text-white">2 итоговый тест</div>
            <p className="text-xs text-[#D8C2A2] leading-relaxed">
              Сдают студенты, у которых посещаемость ниже {gradebook.attendanceThreshold}%. При высокой посещаемости — освобождение.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-1">
            <div className="text-xs font-mono text-[#CBEF9C]">04 · Проект</div>
            <div className="text-sm font-bold text-white">Предзащита проекта</div>
            <p className="text-xs text-[#9FB0C0] leading-relaxed">
              Защита презентации собственной идеи приложения/игры и демонстрация первых наработок.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3: Pre-Defense Presentation Hero Overview */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-8 space-y-5">
        <div className="space-y-2">
          <div className="text-xs font-mono text-[#9ED164]">
            Методические рекомендации · Индивидуальный или командный проект
          </div>
          <h2 className="text-2xl font-bold text-white">{guide.semesterTitle}</h2>
          <p className="text-sm text-[#A9B9C8] leading-relaxed">{guide.overview}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#8EA0B0]">
              <Layers className="w-4 h-4 text-[#9ED164]" />
              <span>Объём презентации</span>
            </div>
            <div className="text-lg font-bold text-white">{guide.slidesRange}</div>
            <div className="text-[11px] text-[#7C8D9C]">Формат 16:9 (PDF / Slides / Figma)</div>
          </div>

          <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#8EA0B0]">
              <Clock className="w-4 h-4 text-[#E5A454]" />
              <span>Регламент выступления</span>
            </div>
            <div className="text-lg font-bold text-white">{guide.pitchDuration}</div>
            <div className="text-[11px] text-[#7C8D9C]">Питч + показ прототипа/макетов</div>
          </div>

          <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#8EA0B0]">
              <Sparkles className="w-4 h-4 text-[#7CC4FA]" />
              <span>Ожидаемый результат</span>
            </div>
            <div className="text-lg font-bold text-white">Идея + первые наработки</div>
            <div className="text-[11px] text-[#7C8D9C]">Полный релиз переносится на 2 семестр</div>
          </div>
        </div>

        {guide.teacherNote && (
          <div className="p-4 rounded-lg border border-[#4A683B]/60 bg-[#19241C] text-xs text-[#D3E7BC] leading-relaxed">
            <strong className="text-[#9ED164]">Важно от преподавателя: </strong>
            {guide.teacherNote}
          </div>
        )}
      </section>

      {/* Per-Group Defense Dates */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#24303C] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Presentation className="w-4 h-4 text-[#E5A454]" />
            <h2 className="text-base font-bold text-white">Даты сдачи и предзащиты по группам</h2>
          </div>
          <span className="text-xs font-mono text-[#8EA0B0]">Уточняйте дату своей группы</span>
        </div>
        <div className="divide-y divide-[#1F2A35]">
          {roster.map((grp) => {
            const info = guide.groupDates?.[grp.name];
            return (
              <div
                key={grp.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="font-semibold text-white">{grp.name}</div>
                <div className="flex flex-wrap items-center gap-3">
                  {info?.note && <span className="text-[#9FB0C0]">{info.note}</span>}
                  {info?.date ? (
                    <span className="font-mono font-semibold text-[#9ED164] tabular-nums">
                      {formatScheduledDateRu(info.date)}
                    </span>
                  ) : (
                    <span className="font-mono text-[#7C8D9C]">Дата будет объявлена</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recommended Slide-by-Slide Structure */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-8 space-y-5">
        <div>
          <div className="text-xs font-mono text-[#9ED164] mb-1">Пошаговый план</div>
          <h2 className="text-lg font-bold text-white">Рекомендуемая структура презентации</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {SLIDE_PLAN.map((slide) => (
            <div
              key={slide.num}
              className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] flex items-start gap-3"
            >
              <span className="font-mono text-xs font-bold text-[#9ED164] bg-[#213124] border border-[#4A683B] rounded px-2 py-1 shrink-0 tabular-nums">
                {slide.num}
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">{slide.title}</h3>
                <p className="text-xs text-[#9FB0C0] leading-relaxed">{slide.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Formatting Rules & Student Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-3">
          <h2 className="text-base font-bold text-white">Требования к оформлению</h2>
          <ul className="space-y-2.5 text-xs text-[#B7C5D3] leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#9ED164] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Минимум текста:</strong> 3–6 коротких тезисов на слайд. Не копируйте абзацы сплошного текста.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#9ED164] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Крупный шрифт и контраст:</strong> заголовки от 24 pt, основной текст от 16 pt; текст должен легко читаться с проектора.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#9ED164] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Визуальные материалы:</strong> обязательно добавьте скриншоты сцен, схемы экранов, наброски интерфейса или гифку/видео прототипа.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#9ED164] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Единый стиль:</strong> 2–3 согласованных цвета, ровные отступы и нумерация слайдов.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-3">
          <h2 className="text-base font-bold text-white">Что подготовить к сдаче</h2>
          <ul className="space-y-2.5 text-xs text-[#B7C5D3] leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#7CC4FA] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Файл или ссылка на презентацию:</strong> PDF / Google Slides / Figma, чтобы быстро открыть на защите без поломки шрифтов.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#7CC4FA] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Текущие наработки:</strong> запущенный прототип (даже из 1–2 сцен), макеты экранов или эскизы.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#7CC4FA] shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">Устная речь на 5–7 минут:</strong> заранее проговорите, как покажете идею, наработки и ответите на вопросы о дальнейших планах.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

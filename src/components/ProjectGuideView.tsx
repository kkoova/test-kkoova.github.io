import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Layers,
  Presentation,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import {
  formatScheduledDateRu,
  ProjectGuideConfig,
  saveProjectGuide,
} from '../services/telemetryService';

interface ProjectGuideBannerProps {
  guide: ProjectGuideConfig;
  roster: GroupRoster[];
  onOpenGuide: () => void;
}

export const ProjectGuideBanner: React.FC<ProjectGuideBannerProps> = ({
  guide,
  roster,
  onOpenGuide,
}) => {
  const scheduledGroups = roster
    .map((g) => ({
      group: g.name,
      info: guide.groupDates?.[g.name],
    }))
    .filter((item) => item.info?.date);

  return (
    <section className="rounded-xl border border-[#4A683B] bg-gradient-to-br from-[#19241C] via-[#151D25] to-[#161E27] p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#9ED164]">
            <Presentation className="w-4 h-4 shrink-0" />
            <span>Методичка итогового проекта</span>
            <span aria-hidden="true">·</span>
            <span>{guide.slidesRange}</span>
            <span aria-hidden="true">·</span>
            <span>{guide.pitchDuration}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#F1F6FA]">
            {guide.semesterTitle}
          </h2>
          <p className="text-xs text-[#B7C5D3] leading-relaxed">{guide.overview}</p>

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

        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Требования к презентации и даты сдачи</span>
          </button>
        </div>
      </div>
    </section>
  );
};

interface ProjectGuideViewProps {
  guide: ProjectGuideConfig;
  roster: GroupRoster[];
  isAdmin: boolean;
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
  roster,
  isAdmin,
  onBack,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectGuideConfig>(guide);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
              Редактирование методички и дат защиты по группам
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
              Даты сдачи и защиты для каждой группы
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

      {/* Hero Overview */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-8 space-y-5">
        <div className="space-y-2">
          <div className="text-xs font-mono text-[#9ED164]">
            Методические рекомендации · Индивидуальный или командный проект
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{guide.semesterTitle}</h1>
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
            <CalendarClock className="w-4 h-4 text-[#E5A454]" />
            <h2 className="text-base font-bold text-white">Даты сдачи и защиты по группам</h2>
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
                <strong className="text-white">Текущие наработки:</strong> запущенный прототип (даже из 1–2 сцен), репозиторий GitHub или макеты экранов.
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

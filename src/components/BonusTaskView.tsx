import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Code2,
  Edit3,
  FolderGit2,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import {
  BonusConfig,
  BonusSubmission,
  DEFAULT_BONUS_CONFIG,
  deleteBonusSubmission,
  saveBonusConfig,
  submitBonusAssignment,
} from '../services/courseService';

interface BonusChallenge {
  id: number;
  title: string;
  prompt: string;
  code: string;
  options: { key: string; label: string }[];
  correct: string;
  explanation: string;
}

const BONUS_CHALLENGES: BonusChallenge[] = [
  {
    id: 1,
    title: 'Движение персонажа в Godot 4',
    prompt: 'Почему этот скрипт выдаёт ошибку в Godot 4 и не двигает CharacterBody2D?',
    code: `extends CharacterBody2D\n\nfunc _physics_process(delta):\n    var dir = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")\n    velocity = move_and_slide(dir * 250)`,
    options: [
      {
        key: 'A',
        label:
          'В Godot 4 move_and_slide() не принимает аргументы — сначала нужно присвоить velocity = dir * 250, а затем вызвать move_and_slide()',
      },
      { key: 'B', label: 'Нужно заменить _physics_process на _ready' },
      { key: 'C', label: 'Input.get_vector возвращает строку вместо Vector2' },
    ],
    correct: 'A',
    explanation:
      'В Godot 4 velocity — это встроенное свойство CharacterBody2D, а move_and_slide() вызывается без параметров.',
  },
  {
    id: 2,
    title: 'Плавная анимация кнопки через Tween',
    prompt: 'Как правильно плавно увеличить кнопку при наведении за 0.15 секунды?',
    code: `var tw = create_tween()\n# Какая строка задаст плавный переход scale к Vector2(1.1, 1.1)?`,
    options: [
      { key: 'A', label: 'tw.tween_property(self, "scale", Vector2(1.1, 1.1), 0.15)' },
      { key: 'B', label: 'tw.animate_scale(Vector2(1.1, 1.1), 0.15)' },
      { key: 'C', label: 'self.scale = tw.lerp(1.1, 0.15)' },
    ],
    correct: 'A',
    explanation:
      'Метод tween_property(object, "property", final_val, duration) — стандартный способ анимации свойств через SceneTreeTween в Godot 4.',
  },
  {
    id: 3,
    title: 'Сохранение рекорда на телефон',
    prompt:
      'Какой путь нужно использовать для записи файла рекорда, чтобы он работал на Android и в браузере?',
    code: `var cfg = ConfigFile.new()\ncfg.set_value("progress", "best_score", score)\ncfg.save(???)`,
    options: [
      { key: 'A', label: '"res://save.cfg"' },
      { key: 'B', label: '"user://save.cfg"' },
      { key: 'C', label: '"C:/Users/Public/save.cfg"' },
    ],
    correct: 'B',
    explanation:
      'Папка res:// доступна только для чтения после экспорта игры. Для пользовательских сохранений всегда используется user://.',
  },
  {
    id: 4,
    title: 'Утечка памяти и таймеры',
    prompt: 'Пули улетают за пределы экрана и продолжают жить бесконечно. Как это исправить?',
    code: `extends Area2D\n# Узел VisibleOnScreenNotifier2D добавлен как дочерний`,
    options: [
      {
        key: 'A',
        label: 'Подключить сигнал screen_exited() у VisibleOnScreenNotifier2D и вызвать queue_free()',
      },
      { key: 'B', label: 'Вызвать hide() в _ready()' },
      { key: 'C', label: 'Поставить get_tree().paused = true' },
    ],
    correct: 'A',
    explanation:
      'VisibleOnScreenNotifier2D отправляет сигнал screen_exited, когда объект покидает экран — в обработчике вызывается queue_free().',
  },
  {
    id: 5,
    title: 'Независимость от FPS',
    prompt:
      'В _process(delta) объект перемещается строкой position.x += 5. Почему на 120 Гц он бежит в 2 раза быстрее, чем на 60 Гц?',
    code: `func _process(delta):\n    position.x += 5`,
    options: [
      { key: 'A', label: 'Не умножено на delta — нужно position.x += speed * delta' },
      { key: 'B', label: 'Нужно использовать position.y вместо position.x' },
      { key: 'C', label: 'Число 5 слишком маленькое для float' },
    ],
    correct: 'A',
    explanation:
      'delta хранит время между кадрами в секундах. Умножение скорости на delta делает движение одинаковым при любом FPS.',
  },
];

interface BonusTaskViewProps {
  roster: GroupRoster[];
  defaultStudentHint?: string | null;
  isAdmin: boolean;
  bonusConfig: BonusConfig;
  bonusSubmissions: BonusSubmission[];
}

export const BonusTaskView: React.FC<BonusTaskViewProps> = ({
  roster,
  defaultStudentHint,
  isAdmin,
  bonusConfig,
  bonusSubmissions,
}) => {
  const [mode, setMode] = useState<'quiz' | 'project'>(() =>
    bonusConfig.showQuiz ? 'quiz' : 'project'
  );
  const [selectedGroup, setSelectedGroup] = useState<string>(roster[0]?.name || '');
  const [selectedStudent, setSelectedStudent] = useState<string>(() => {
    if (!defaultStudentHint) return '';
    const lower = defaultStudentHint.trim().toLowerCase();
    for (const grp of roster) {
      const m = grp.students.find((s) => s.toLowerCase() === lower);
      if (m) return m;
    }
    return '';
  });

  // Teacher editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<BonusConfig>(bonusConfig);
  const [requirementsText, setRequirementsText] = useState<string>(
    bonusConfig.projectRequirements.join('\n')
  );
  const [editorMsg, setEditorMsg] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Results filter
  const [resultsGroupFilter, setResultsGroupFilter] = useState<string>('all');

  useEffect(() => {
    setDraftConfig(bonusConfig);
    setRequirementsText(bonusConfig.projectRequirements.join('\n'));
  }, [bonusConfig]);

  useEffect(() => {
    if (mode === 'quiz' && !bonusConfig.showQuiz && bonusConfig.showProject) {
      setMode('project');
    } else if (mode === 'project' && !bonusConfig.showProject && bonusConfig.showQuiz) {
      setMode('quiz');
    }
  }, [mode, bonusConfig.showQuiz, bonusConfig.showProject]);

  // Mode A: 5-question interactive bonus challenge
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<{
    score: number;
    total: number;
    percentage: number;
    gradeLabel: string;
    saved: boolean;
  } | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Mode B: GitHub practical bonus submission
  const [repoLink, setRepoLink] = useState('');
  const [note, setNote] = useState('');
  const [projectStatus, setProjectStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [submittingProject, setSubmittingProject] = useState(false);

  const studentsInGroup = useMemo(() => {
    return roster.find((g) => g.name === selectedGroup)?.students || [];
  }, [roster, selectedGroup]);

  const allQuizAnswered = BONUS_CHALLENGES.every((q) => Boolean(answers[q.id]));

  const filteredSubmissions = useMemo(() => {
    return bonusSubmissions.filter((b) => {
      if (!bonusConfig.showResultsToStudents && !isAdmin) {
        if (!selectedStudent) return false;
        if (b.studentName !== selectedStudent) return false;
      }
      if (resultsGroupFilter !== 'all' && b.group !== resultsGroupFilter) return false;
      return true;
    });
  }, [bonusSubmissions, bonusConfig.showResultsToStudents, isAdmin, selectedStudent, resultsGroupFilter]);

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    const reqs = requirementsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const nextConfig: BonusConfig = {
      ...draftConfig,
      projectRequirements: reqs,
    };
    try {
      await saveBonusConfig(nextConfig);
      setEditorMsg('Настройки дополнительного задания сохранены для всех студентов.');
    } catch {
      setEditorMsg('Сохранено локально (проверьте права записи Firestore).');
    } finally {
      setSavingConfig(false);
      window.setTimeout(() => setEditorMsg(null), 3500);
    }
  };

  const handleResetEditor = async () => {
    setSavingConfig(true);
    try {
      await saveBonusConfig(DEFAULT_BONUS_CONFIG);
      setDraftConfig(DEFAULT_BONUS_CONFIG);
      setRequirementsText(DEFAULT_BONUS_CONFIG.projectRequirements.join('\n'));
      setEditorMsg('Восстановлены стандартные настройки доп. задания.');
    } catch {
      setEditorMsg('Восстановлено локально.');
    } finally {
      setSavingConfig(false);
      window.setTimeout(() => setEditorMsg(null), 3500);
    }
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !selectedStudent) {
      setQuizError('Выберите группу и ваше ФИО, чтобы преподаватель засчитал оценку.');
      return;
    }
    if (!allQuizAnswered) {
      setQuizError('Ответьте на все 5 заданий перед проверкой.');
      return;
    }
    setQuizError(null);
    setSubmittingQuiz(true);

    const score = BONUS_CHALLENGES.filter((q) => answers[q.id] === q.correct).length;
    const total = BONUS_CHALLENGES.length;
    const percentage = Math.round((score / total) * 100);
    let gradeLabel = 'Не зачтено (нужно ≥3 из 5)';
    if (score === 5) gradeLabel = 'Отлично (5) · 100% зачёт';
    else if (score === 4) gradeLabel = 'Хорошо (4) · зачёт доп. задания';
    else if (score === 3) gradeLabel = 'Удовлетворительно (3)';

    try {
      await submitBonusAssignment({
        studentName: selectedStudent,
        group: selectedGroup,
        kind: 'quiz',
        score,
        total,
        percentage,
        gradeLabel,
      });
      setQuizResult({ score, total, percentage, gradeLabel, saved: true });
    } catch {
      setQuizResult({ score, total, percentage, gradeLabel, saved: false });
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !selectedStudent) {
      setProjectStatus({ ok: false, message: 'Выберите группу и ваше ФИО.' });
      return;
    }
    const cleanLink = repoLink.trim();
    if (!/^https?:\/\/.+/i.test(cleanLink)) {
      setProjectStatus({
        ok: false,
        message: 'Укажите корректную ссылку на GitHub (начинается с https://).',
      });
      return;
    }

    setSubmittingProject(true);
    setProjectStatus(null);
    try {
      const saved: BonusSubmission = await submitBonusAssignment({
        studentName: selectedStudent,
        group: selectedGroup,
        kind: 'project',
        gradeLabel: 'На проверке (практика на 5)',
        repoLink: cleanLink,
        note: note.trim(),
      });
      setProjectStatus({
        ok: true,
        message: `Дополнительная работа для «${saved.studentName}» отправлена преподавателю!`,
      });
      setRepoLink('');
      setNote('');
    } catch {
      setProjectStatus({ ok: false, message: 'Не удалось сохранить. Попробуйте ещё раз.' });
    } finally {
      setSubmittingProject(false);
    }
  };

  const showBothDisabled = !bonusConfig.showQuiz && !bonusConfig.showProject;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#9ED164]">
            <Award className="w-4 h-4" />
            <span>{bonusConfig.heroBadge}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{bonusConfig.heroTitle}</h1>
          <p className="text-xs text-[#9FB0C0] max-w-2xl leading-relaxed">
            {bonusConfig.heroSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start">
          {(bonusConfig.showQuiz || bonusConfig.showProject) && (
            <div className="inline-flex p-1 rounded-lg bg-[#11171D] border border-[#26323F]">
              {bonusConfig.showQuiz && (
                <button
                  type="button"
                  onClick={() => setMode('quiz')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    mode === 'quiz'
                      ? 'bg-[#9ED164] text-[#111912]'
                      : 'text-[#9FB0C0] hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{bonusConfig.quizTabLabel}</span>
                </button>
              )}
              {bonusConfig.showProject && (
                <button
                  type="button"
                  onClick={() => setMode('project')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    mode === 'project'
                      ? 'bg-[#9ED164] text-[#111912]'
                      : 'text-[#9FB0C0] hover:text-white'
                  }`}
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>{bonusConfig.projectTabLabel}</span>
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setEditorOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                editorOpen
                  ? 'border-[#E5A454] bg-[#251E15] text-[#F3D3A7]'
                  : 'border-[#344656] bg-[#11171D] text-[#D7E0E8] hover:border-[#9ED164]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editorOpen ? 'Скрыть редактор' : 'Редактировать'}</span>
            </button>
          )}
        </div>
      </section>

      {/* Teacher Inline Config Editor */}
      {isAdmin && editorOpen && (
        <form
          onSubmit={handleSaveEditor}
          className="rounded-xl border border-[#E5A454]/50 bg-[#181B20] p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A3744] pb-3">
            <div>
              <div className="text-xs font-mono text-[#E5A454]">Режим преподавателя</div>
              <h2 className="text-base font-bold text-white">
                Редактирование текста и видимости блоков
              </h2>
            </div>
            <button
              type="button"
              onClick={handleResetEditor}
              disabled={savingConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#344656] bg-[#11171D] text-xs text-[#9FB0C0] hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить по умолчанию</span>
            </button>
          </div>

          {editorMsg && (
            <div className="p-3 rounded-lg border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
              {editorMsg}
            </div>
          )}

          {/* Visibility Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#2A3744] bg-[#11171D] text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.showQuiz}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, showQuiz: e.target.checked }))
                }
                className="accent-[#9ED164]"
              />
              <span>Показывать «Код-челлендж»</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#2A3744] bg-[#11171D] text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.showProject}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, showProject: e.target.checked }))
                }
                className="accent-[#9ED164]"
              />
              <span>Показывать «ТЗ на GitHub»</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-[#2A3744] bg-[#11171D] text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.showResultsToStudents}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    showResultsToStudents: e.target.checked,
                  }))
                }
                className="accent-[#9ED164]"
              />
              <span>Показывать таблицу результатов студентам</span>
            </label>
          </div>

          {/* Editable Header & Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Надзаголовок
              </label>
              <input
                type="text"
                value={draftConfig.heroBadge}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, heroBadge: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Главный заголовок
              </label>
              <input
                type="text"
                value={draftConfig.heroTitle}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, heroTitle: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Описание под заголовком
              </label>
              <textarea
                rows={2}
                value={draftConfig.heroSubtitle}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, heroSubtitle: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Название вкладки 1 (Код-челлендж)
              </label>
              <input
                type="text"
                value={draftConfig.quizTabLabel}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, quizTabLabel: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Название вкладки 2 (Практическое ТЗ)
              </label>
              <input
                type="text"
                value={draftConfig.projectTabLabel}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, projectTabLabel: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
          </div>

          {/* Editable Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#24303C]">
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Бейдж практического ТЗ
              </label>
              <input
                type="text"
                value={draftConfig.projectBadge}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, projectBadge: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Заголовок практического ТЗ
              </label>
              <input
                type="text"
                value={draftConfig.projectTitle}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, projectTitle: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Вводный текст ТЗ
              </label>
              <textarea
                rows={2}
                value={draftConfig.projectSubtitle}
                onChange={(e) =>
                  setDraftConfig((prev) => ({ ...prev, projectSubtitle: e.target.value }))
                }
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Пункты требований ТЗ (каждый пункт с новой строки)
              </label>
              <textarea
                rows={4}
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-bold hover:bg-[#B4E07F] cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Сохранение...' : 'Сохранить изменения'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Student Identification Bar */}
      {!showBothDisabled && (
        <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
              Ваша учебная группа
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setSelectedStudent('');
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
              Фамилия и имя
            </label>
            <select
              value={selectedStudent}
              disabled={!selectedGroup}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#9ED164] disabled:opacity-45"
            >
              <option value="">— Выберите ваше ФИО —</option>
              {studentsInGroup.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {showBothDisabled && (
        <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-8 text-center text-xs text-[#9FB0C0]">
          Форматы дополнительного задания сейчас скрыты преподавателем. Проверьте результаты ниже или загляните позже.
        </div>
      )}

      {/* Mode A: Interactive 5-Challenge Quiz */}
      {bonusConfig.showQuiz && mode === 'quiz' && (
        <form onSubmit={handleSubmitQuiz} className="space-y-4">
          {BONUS_CHALLENGES.map((q, idx) => {
            const picked = answers[q.id];
            const showReview = quizResult !== null;
            const isCorrect = picked === q.correct;

            return (
              <div
                key={q.id}
                className={`rounded-xl border p-6 space-y-4 ${
                  showReview
                    ? isCorrect
                      ? 'border-[#5D8247] bg-[#142018]'
                      : 'border-[#E06C75]/60 bg-[#1F1518]'
                    : 'border-[#2A3744] bg-[#161E27]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-[#9ED164]">
                    Бонус-задача {idx + 1} / {BONUS_CHALLENGES.length}
                  </span>
                  {showReview && (
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isCorrect ? 'text-[#9ED164]' : 'text-[#FFB8BE]'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Верно</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          <span>Ошибка (правильно: {q.correct})</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-base font-bold text-white">{q.title}</h2>
                  <p className="text-xs text-[#A9B9C8] mt-1">{q.prompt}</p>
                </div>

                <pre className="p-3.5 rounded-lg border border-[#24303C] bg-[#0B0F14] text-xs font-mono text-[#D0D9E2] overflow-x-auto">
                  <code>{q.code}</code>
                </pre>

                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const active = picked === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={showReview}
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: opt.key }))
                        }
                        className={`w-full p-3 rounded-lg border text-left text-xs transition-colors flex items-start gap-2.5 cursor-pointer disabled:cursor-default ${
                          active
                            ? 'border-[#9ED164] bg-[#213124] text-white'
                            : 'border-[#24303C] bg-[#11171D] text-[#C7D3DF] hover:border-[#45586B]'
                        }`}
                      >
                        <span className="font-mono font-bold text-[#9ED164] shrink-0">
                          {opt.key})
                        </span>
                        <span className="leading-relaxed">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {showReview && (
                  <div className="p-3 rounded-lg bg-[#0F141A] border border-[#24303C] text-xs text-[#B7C5D3]">
                    <strong className="text-[#9ED164]">Разбор: </strong>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}

          {quizError && (
            <div className="p-3.5 rounded-lg border border-[#E06C75]/50 bg-[#2D181B] text-xs text-[#FFB8BE]">
              {quizError}
            </div>
          )}

          {quizResult ? (
            <div className="rounded-xl border border-[#5D8247] bg-[#17251B] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-mono text-[#9ED164]">
                  {quizResult.saved
                    ? 'Результат сохранён для преподавателя'
                    : 'Результат подсчитан локально'}
                </div>
                <div className="text-xl font-bold text-white">
                  {quizResult.score} из {quizResult.total} ({quizResult.percentage}%) —{' '}
                  {quizResult.gradeLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setQuizResult(null);
                }}
                className="px-4 py-2.5 rounded-lg border border-[#5D8247] bg-[#213124] text-xs font-semibold text-[#CBEF9C] cursor-pointer"
              >
                Пройти заново
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submittingQuiz}
              className="w-full py-3.5 px-5 rounded-lg bg-[#9ED164] text-[#111912] font-bold text-sm hover:bg-[#B4E07F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {submittingQuiz ? 'Проверка...' : 'Проверить и отправить на оценку'}
              </span>
            </button>
          )}
        </form>
      )}

      {/* Mode B: Practical Game Feel Project Task */}
      {bonusConfig.showProject && mode === 'project' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <div className="text-xs font-mono text-[#E5A454]">
              {bonusConfig.projectBadge}
            </div>
            <h2 className="text-xl font-bold text-white">{bonusConfig.projectTitle}</h2>
            <p className="text-xs text-[#A9B9C8] leading-relaxed">
              {bonusConfig.projectSubtitle}
            </p>
            <div className="space-y-2.5 text-xs">
              {bonusConfig.projectRequirements.map((item, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-[#24303C] bg-[#11171D] text-[#D7E0E8]"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <form
            onSubmit={handleSubmitProject}
            className="lg:col-span-5 rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-white">Отправить работу на проверку</h3>

            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
                Ссылка на репозиторий GitHub
              </label>
              <input
                type="url"
                value={repoLink}
                onChange={(e) => setRepoLink(e.target.value)}
                placeholder="https://github.com/username/godot-juice-pack"
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1.5">
                Что именно добавили (кратко)
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Например: добавил Tween кнопок, частицы при сборе монет и ConfigFile в Кликер"
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
              />
            </div>

            {projectStatus && (
              <div
                className={`p-3 rounded-lg border text-xs ${
                  projectStatus.ok
                    ? 'border-[#5D8247] bg-[#213124] text-[#CBEF9C]'
                    : 'border-[#E06C75]/50 bg-[#2D181B] text-[#FFB8BE]'
                }`}
              >
                {projectStatus.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingProject}
              className="w-full py-3 px-4 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-bold hover:bg-[#B4E07F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submittingProject ? 'Отправка...' : 'Сдать доп. задание'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Student Submissions & Results Board */}
      {(isAdmin || bonusConfig.showResultsToStudents || filteredSubmissions.length > 0) && (
        <section className="rounded-xl border border-[#2A3744] bg-[#161E27] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#24303C] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-[#9ED164]" />
              <h2 className="text-base font-bold text-white">
                Результаты студентов ({filteredSubmissions.length})
              </h2>
            </div>

            <select
              value={resultsGroupFilter}
              onChange={(e) => setResultsGroupFilter(e.target.value)}
              className="bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9ED164]"
            >
              <option value="all">Все группы</option>
              {roster.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7C8D9C]">
              {!bonusConfig.showResultsToStudents && !isAdmin && !selectedStudent
                ? 'Выберите ваше ФИО выше, чтобы увидеть ваши результаты.'
                : 'Отправленных дополнительных заданий пока нет.'}
            </div>
          ) : (
            <div className="divide-y divide-[#1F2A35] max-h-[380px] overflow-y-auto">
              {filteredSubmissions.map((b) => (
                <div
                  key={b.id}
                  className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-white">
                      {b.studentName} · <span className="text-[#8EA0B0]">{b.group}</span>
                    </div>
                    <div className="text-[#9FB0C0]">
                      {b.kind === 'quiz'
                        ? `Код-челлендж: ${b.score}/${b.total} (${b.percentage}%)`
                        : `Проект GitHub: ${b.note || 'Без комментария'}`}
                    </div>
                    {b.repoLink && (
                      <a
                        href={b.repoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block font-mono text-[#7CC4FA] hover:underline break-all"
                      >
                        {b.repoLink}
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded border border-[#5D8247] bg-[#213124] font-mono text-[11px] text-[#CBEF9C]">
                      {b.gradeLabel}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void deleteBonusSubmission(b.id)}
                        title="Удалить результат"
                        className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-[#E06C75] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

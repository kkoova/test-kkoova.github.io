import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Code2,
  FolderGit2,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { GroupRoster } from '../data/defaultRoster';
import {
  BonusSubmission,
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
      { key: 'A', label: 'В Godot 4 move_and_slide() не принимает аргументы — сначала нужно присвоить velocity = dir * 250, а затем вызвать move_and_slide()' },
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
    prompt: 'Какой путь нужно использовать для записи файла рекорда, чтобы он работал на Android и в браузере?',
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
      { key: 'A', label: 'Подключить сигнал screen_exited() у VisibleOnScreenNotifier2D и вызвать queue_free()' },
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
    prompt: 'В _process(delta) объект перемещается строкой position.x += 5. Почему на 120 Гц он бежит в 2 раза быстрее, чем на 60 Гц?',
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
}

export const BonusTaskView: React.FC<BonusTaskViewProps> = ({
  roster,
  defaultStudentHint,
}) => {
  const [mode, setMode] = useState<'quiz' | 'project'>('quiz');
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
    if (score === 5) gradeLabel = 'Отлично (5) · +1 балл к практике';
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#9ED164]">
            <Award className="w-4 h-4" />
            <span>Дополнительное задание на оценку</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Заработать дополнительную «5» или закрыть долг
          </h1>
          <p className="text-xs text-[#9FB0C0] max-w-2xl leading-relaxed">
            Выберите формат: быстрый код-челлендж по Godot 4 прямо в браузере (автопроверка) или практическая доработка любой игры эффектами Game Feel. Результат сразу попадает преподавателю.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-[#11171D] border border-[#26323F] shrink-0 self-start">
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
            <span>Код-челлендж (5 задач)</span>
          </button>
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
            <span>ТЗ на GitHub (Game Feel)</span>
          </button>
        </div>
      </section>

      {/* Student Identification Bar */}
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

      {/* Mode A: Interactive 5-Challenge Quiz */}
      {mode === 'quiz' && (
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
      {mode === 'project' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <div className="text-xs font-mono text-[#E5A454]">
              Практическое ТЗ · Бонус-оценка «5»
            </div>
            <h2 className="text-xl font-bold text-white">
              Миссия «Game Feel & Juice Pack» для любой вашей игры
            </h2>
            <p className="text-xs text-[#A9B9C8] leading-relaxed">
              Возьмите любой свой проект из курса (Лабиринт, Кликер, Тетрис или Рыбалку) и добавьте 4 элемента «сочности» игры:
            </p>
            <div className="space-y-2.5 text-xs">
              {[
                '1. Плавный отклик UI через create_tween() (пружинка при нажатии кнопок или появлении окна).',
                '2. Эффект тряски камеры (Camera Shake) или вспышки при важном событии / столкновении.',
                '3. Частицы (GPUParticles2D или CPUParticles2D) + минимум 2 звуковых эффекта через AudioStreamPlayer.',
                '4. Сохранение лучшего результата в user:// через ConfigFile или JSON, чтобы рекорд не сбрасывался после перезапуска.',
              ].map((item, i) => (
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
    </div>
  );
};

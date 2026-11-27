import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  Trash2,
  Wind,
  Zap,
} from 'lucide-react';
import { Mission } from '../services/courseService';

interface AdhdTask {
  id: string;
  text: string;
  done: boolean;
}

const DEFAULT_MICRO_TASKS: AdhdTask[] = [
  { id: 't1', text: 'Открыть Godot Engine (просто запустить программу, без обязательств)', done: false },
  { id: 't2', text: 'Написать ровно 3 строки кода в текущем скрипте', done: false },
  { id: 't3', text: 'Нажать F5 и проверить, что сцена запускается без красных ошибок', done: false },
  { id: 't4', text: 'Сделать 1 коммит в GitHub с понятным названием', done: false },
];

const DOPAMINE_PHRASES = [
  'Отлично! Микро-шаг закрыт, мозг получил дофамин!',
  'Супер! Самое сложное — начать, и ты уже в потоке.',
  'Красота! Ещё один кусочек проекта готов.',
  'Есть! Продолжаем в комфортном темпе.',
];

const POP_COLORS = [
  'bg-[#9ED164] border-[#CBEF9C] text-[#111912]',
  'bg-[#7CC4FA] border-[#B6E1FF] text-[#0D1A24]',
  'bg-[#E5A454] border-[#F6CC94] text-[#1F1509]',
  'bg-[#C678DD] border-[#E3B2F2] text-[#1D0F22]',
  'bg-[#56B6C2] border-[#9CE0E8] text-[#0B1D20]',
];

export const AdhdZoneView: React.FC<{ missions: Mission[] }> = ({ missions }) => {
  // 1. Micro-Sprint Timer
  const [sprintPresetMin, setSprintPresetMin] = useState<number>(5);
  const [secondsLeft, setSecondsLeft] = useState<number>(5 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [sprintsDone, setSprintsDone] = useState<number>(0);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setSprintsDone((c) => c + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const selectPreset = (mins: number) => {
    setTimerRunning(false);
    setSprintPresetMin(mins);
    setSecondsLeft(mins * 60);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const timerPct =
    sprintPresetMin > 0
      ? Math.round(((sprintPresetMin * 60 - secondsLeft) / (sprintPresetMin * 60)) * 100)
      : 0;

  // 2. One-Task-At-A-Time Micro-Step Board
  const [tasks, setTasks] = useState<AdhdTask[]>(DEFAULT_MICRO_TASKS);
  const [newTaskText, setNewTaskText] = useState('');
  const [streak, setStreak] = useState<number>(0);
  const [praise, setPraise] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');

  const currentTask = useMemo(() => tasks.find((t) => !t.done) || null, [tasks]);
  const doneCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);

  const completeCurrentTask = () => {
    if (!currentTask) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === currentTask.id ? { ...t, done: true } : t))
    );
    setStreak((s) => s + 1);
    setPraise(DOPAMINE_PHRASES[Math.floor(Math.random() * DOPAMINE_PHRASES.length)]);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;
    setTasks((prev) => [...prev, { id: `adhd_${Date.now()}`, text, done: false }]);
    setNewTaskText('');
  };

  const loadMissionSteps = (missionId: string) => {
    setSelectedMissionId(missionId);
    const m = missions.find((x) => x.id === missionId);
    if (!m) return;
    const loaded: AdhdTask[] = m.steps.map((s, idx) => ({
      id: `${m.id}_${idx}_${Date.now()}`,
      text: `${m.title}: ${s}`,
      done: false,
    }));
    if (loaded.length > 0) {
      setTasks(loaded);
      setPraise(`Загружены шаги из «${m.title}». Фокус только на одном шаге!`);
    }
  };

  // 3. Pop-It 5x5 Fidget
  const [popped, setPopped] = useState<boolean[]>(() => Array(25).fill(false));
  const [popTotal, setPopTotal] = useState<number>(0);

  const togglePop = (idx: number) => {
    setPopped((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
    setPopTotal((c) => c + 1);
  };

  // 4. 4-4-4 Breathing Guide
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathTick, setBreathTick] = useState(0);

  useEffect(() => {
    if (!breathingActive) return;
    const id = window.setInterval(() => {
      setBreathTick((t) => (t + 1) % 12);
    }, 1000);
    return () => window.clearInterval(id);
  }, [breathingActive]);

  const breathPhase =
    breathTick < 4 ? 'Вдох...' : breathTick < 8 ? 'Задержка...' : 'Выдох...';
  const breathSec = (breathTick % 4) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#7CC4FA]">
            <Zap className="w-4 h-4" />
            <span>СДВГ-режим · Низкий порог входа</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Фокус-зона: один шаг за раз + анти-скука
          </h1>
          <p className="text-xs text-[#9FB0C0] max-w-2xl leading-relaxed">
            Без огромных стен текста и давления. Запустите короткий спринт на 2–5 минут, закрывайте по одной микро-задаче и занимайте руки тактильной «пупыркой», пока думаете над логикой.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-lg border border-[#5D8247] bg-[#1A261D] text-center">
            <div className="text-[11px] font-mono text-[#CBEF9C]">Серия шагов</div>
            <div className="text-lg font-bold font-mono text-[#9ED164] tabular-nums inline-flex items-center gap-1">
              <Flame className="w-4 h-4 text-[#E5A454]" />
              <span>{streak}</span>
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-lg border border-[#344656] bg-[#11171D] text-center">
            <div className="text-[11px] font-mono text-[#8EA0B0]">Спринтов</div>
            <div className="text-lg font-bold font-mono text-[#7CC4FA] tabular-nums">
              {sprintsDone}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: One-Task Focus + Micro-Sprint Timer */}
        <div className="lg:col-span-7 space-y-6">
          {/* One-Step Focus Card */}
          <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164]">
                <Sparkles className="w-4 h-4" />
                <span>ТОЛЬКО ОДИН ТЕКУЩИЙ ШАГ</span>
              </div>
              <span className="text-xs font-mono text-[#8EA0B0] tabular-nums">
                Выполнено: {doneCount} / {tasks.length}
              </span>
            </div>

            {praise && (
              <div className="px-3.5 py-2.5 rounded-lg border border-[#5D8247] bg-[#1D2D21] text-xs text-[#CBEF9C] font-medium">
                {praise}
              </div>
            )}

            {currentTask ? (
              <div className="p-6 rounded-xl border-2 border-[#9ED164]/70 bg-[#101814] space-y-4">
                <div className="text-xs font-mono text-[#8EA0B0]">Сейчас делаем только это:</div>
                <div className="text-lg sm:text-xl font-bold text-white leading-snug">
                  {currentTask.text}
                </div>
                <button
                  type="button"
                  onClick={completeCurrentTask}
                  className="w-full py-3.5 px-5 rounded-lg bg-[#9ED164] text-[#111912] font-bold text-sm hover:bg-[#B4E07F] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Готово! Следующий микро-шаг</span>
                </button>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-[#5D8247] bg-[#17241A] text-center space-y-3">
                <div className="text-lg font-bold text-[#CBEF9C]">
                  Все шаги в очереди закрыты!
                </div>
                <p className="text-xs text-[#A5C6A8]">
                  Можно сделать перерыв, загрузить шаги миссии или добавить новую мини-задачу.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setTasks((prev) => prev.map((t) => ({ ...t, done: false })))
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#5D8247] bg-[#213124] text-xs font-semibold text-[#CBEF9C] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Пройти список заново</span>
                </button>
              </div>
            )}

            {/* Import from Mission or Add Custom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#24303C]">
              <div>
                <label className="block text-[11px] font-mono text-[#8EA0B0] mb-1">
                  Подтянуть шаги из миссии курса
                </label>
                <select
                  value={selectedMissionId}
                  onChange={(e) => loadMissionSteps(e.target.value)}
                  className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                >
                  <option value="">— Выбрать миссию —</option>
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.steps.length} ш.)
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleAddTask}>
                <label className="block text-[11px] font-mono text-[#8EA0B0] mb-1">
                  Добавить свой микро-шаг
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Например: поменять цвет кнопки"
                    className="flex-1 bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-[#253240] text-white hover:bg-[#334558] cursor-pointer"
                    title="Добавить"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            {/* Compact Queue */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-[#8EA0B0]">
                Очередь шагов (чтобы не держать в голове)
              </div>
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                      t.done
                        ? 'border-[#24303C] bg-[#10161D] text-[#6C7E8E] line-through'
                        : t.id === currentTask?.id
                          ? 'border-[#9ED164]/60 bg-[#1B271F] text-white font-medium'
                          : 'border-[#24303C] bg-[#11171D] text-[#B7C5D3]'
                    }`}
                  >
                    <span className="truncate">{t.text}</span>
                    <button
                      type="button"
                      onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                      className="text-[#6C7E8E] hover:text-[#E06C75] cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Micro-Sprint Timer */}
          <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-[#E5A454]">
                <Timer className="w-4 h-4" />
                <span>Дофамин-спринт (без перегруза)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[2, 5, 10, 15, 25].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectPreset(m)}
                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer border ${
                      sprintPresetMin === m
                        ? 'bg-[#E5A454] text-[#1A140C] border-[#E5A454] font-bold'
                        : 'bg-[#11171D] text-[#9FB0C0] border-[#2A3744] hover:border-[#E5A454]'
                    }`}
                  >
                    {m}м
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#24303C] bg-[#11171D]">
              <div>
                <div className="font-mono text-4xl font-extrabold text-white tabular-nums">
                  {mm}:{ss}
                </div>
                <div className="text-xs text-[#8EA0B0] mt-1">
                  {secondsLeft === 0
                    ? 'Спринт завершён! Отдохни 1–2 минуты.'
                    : timerRunning
                      ? 'Идёт фокус — просто работаем до сигнала.'
                      : 'Попробуй всего 2 или 5 минут, остановиться можно в любой момент.'}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (secondsLeft === 0) setSecondsLeft(sprintPresetMin * 60);
                    setTimerRunning((r) => !r);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-bold hover:bg-[#B4E07F] cursor-pointer"
                >
                  {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{timerRunning ? 'Пауза' : 'Старт'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setSecondsLeft(sprintPresetMin * 60);
                  }}
                  className="p-2.5 rounded-lg border border-[#344656] bg-[#161E27] text-[#9FB0C0] hover:text-white cursor-pointer"
                  title="Сбросить таймер"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="h-2 rounded-full bg-[#222D38] overflow-hidden">
              <div
                className="h-full bg-[#E5A454] transition-all duration-500"
                style={{ width: `${timerPct}%` }}
              />
            </div>
          </section>
        </div>

        {/* Right 5 cols: Fidget Pop-It & Breathing */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white">Тактильная «Пупырка» 5×5</h2>
                <p className="text-xs text-[#8EA0B0]">
                  Занимает руки, пока слушаешь объяснение или ищешь баг
                </p>
              </div>
              <span className="font-mono text-xs text-[#9ED164] tabular-nums">
                Лопнуто: {popTotal}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2.5 p-4 rounded-xl border border-[#24303C] bg-[#0F141A]">
              {popped.map((isPopped, idx) => {
                const rowColor = POP_COLORS[Math.floor(idx / 5) % POP_COLORS.length];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => togglePop(idx)}
                    aria-label={`Пупырка ${idx + 1}`}
                    className={`aspect-square rounded-full border-2 transition-all duration-150 cursor-pointer flex items-center justify-center font-mono text-xs font-bold ${
                      isPopped
                        ? 'scale-90 bg-[#18212B] border-[#2E3C4B] text-[#5D7083] shadow-inner'
                        : `${rowColor} hover:scale-105 shadow-md`
                    }`}
                  >
                    {isPopped ? '•' : ''}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPopped(Array(25).fill(false))}
              className="w-full py-2 rounded-lg border border-[#344656] bg-[#11171D] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
            >
              Перевернуть пупырку (сбросить)
            </button>
          </section>

          <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-[#7CC4FA]">
                <Wind className="w-4 h-4" />
                <span>Перезагрузка внимания · 4-4-4</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBreathingActive((a) => !a);
                  setBreathTick(0);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#344656] bg-[#11171D] text-xs font-medium text-white hover:border-[#7CC4FA] cursor-pointer"
              >
                {breathingActive ? 'Остановить' : 'Запустить'}
              </button>
            </div>

            <div className="p-5 rounded-xl border border-[#24303C] bg-[#11171D] flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-white">
                  {breathingActive ? breathPhase : 'Готов к перезагрузке'}
                </div>
                <div className="text-xs text-[#8EA0B0] mt-1">
                  {breathingActive
                    ? `Счёт: ${breathSec} / 4`
                    : '12 секунд спокойного дыхания возвращают фокус'}
                </div>
              </div>
              <div
                className={`w-14 h-14 rounded-full border-2 border-[#7CC4FA] flex items-center justify-center font-mono text-lg font-bold text-[#7CC4FA] transition-transform duration-700 ${
                  breathingActive
                    ? breathTick < 4
                      ? 'scale-110 bg-[#172838]'
                      : breathTick < 8
                        ? 'scale-110 bg-[#1E3347]'
                        : 'scale-90 bg-[#11171D]'
                    : 'scale-100'
                }`}
              >
                {breathingActive ? breathSec : '4'}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

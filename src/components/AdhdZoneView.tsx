import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Video,
  Wind,
  Zap,
} from 'lucide-react';
import { Mission } from '../services/courseService';

interface CarpetVideoPreset {
  id: string;
  label: string;
  embedUrl: string;
  watchUrl: string;
}

const CARPET_VIDEOS: CarpetVideoPreset[] = [
  {
    id: 'rug1',
    label: 'Пушистый ковёр + пена',
    embedUrl: 'https://www.youtube-nocookie.com/embed/hJlV7xL-Mqg?rel=0',
    watchUrl: 'https://www.youtube.com/watch?v=hJlV7xL-Mqg',
  },
  {
    id: 'rug2',
    label: 'Грязный ковёр в речной воде',
    embedUrl: 'https://www.youtube-nocookie.com/embed/IFkZ1NhMHWM?rel=0',
    watchUrl: 'https://www.youtube.com/watch?v=IFkZ1NhMHWM',
  },
  {
    id: 'rug3',
    label: 'Мойка высоким давлением',
    embedUrl: 'https://www.youtube-nocookie.com/embed/SOaKJ6iYgCg?rel=0',
    watchUrl: 'https://www.youtube.com/watch?v=SOaKJ6iYgCg',
  },
];

function toEmbedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube-nocookie.com/embed/${v}?rel=0`;
      if (u.pathname.startsWith('/embed/')) return trimmed;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
  } catch {
    return null;
  }
  return null;
}

const POP_COLORS = [
  'bg-[#9ED164] border-[#CBEF9C] text-[#111912]',
  'bg-[#7CC4FA] border-[#B6E1FF] text-[#0D1A24]',
  'bg-[#E5A454] border-[#F6CC94] text-[#1F1509]',
  'bg-[#C678DD] border-[#E3B2F2] text-[#1D0F22]',
  'bg-[#56B6C2] border-[#9CE0E8] text-[#0B1D20]',
];

export const AdhdZoneView: React.FC<{ missions?: Mission[] }> = () => {
  // 1. Carpet Washing Satisfying Video Iframe
  const [selectedVideoId, setSelectedVideoId] = useState<string>(CARPET_VIDEOS[0].id);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string>(CARPET_VIDEOS[0].embedUrl);

  const selectedPreset =
    CARPET_VIDEOS.find((v) => v.id === selectedVideoId) || CARPET_VIDEOS[0];

  const handleApplyCustomVideo = (e: React.FormEvent) => {
    e.preventDefault();
    const converted = toEmbedUrl(customUrlInput);
    if (converted) {
      setSelectedVideoId('custom');
      setActiveEmbedUrl(converted);
    }
  };

  // 2. Micro-Sprint Timer
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
            <span>СДВГ-режим · Залипалово и анти-скука</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Фокус-зона: мойка ковров, спринты и пупырка
          </h1>
          <p className="text-xs text-[#9FB0C0] max-w-2xl leading-relaxed">
            Включите залипательную мойку ковров на фоне, запустите короткий таймер на 2–5 минут или разомните руки тактильной пупыркой, пока думаете над кодом.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-lg border border-[#5D8247] bg-[#1A261D] text-center">
            <div className="text-[11px] font-mono text-[#CBEF9C]">Пупырок</div>
            <div className="text-lg font-bold font-mono text-[#9ED164] tabular-nums">
              {popTotal}
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
        {/* Left 7 cols: Carpet Washing Iframe + Micro-Sprint Timer */}
        <div className="lg:col-span-7 space-y-6">
          {/* Carpet Cleaning Satisfying Video Iframe */}
          <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164]">
                <Video className="w-4 h-4" />
                <span>ЗАЛИПАЛОВО · МОЙКА КОВРОВ ASMR</span>
              </div>
              <a
                href={selectedPreset.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#7CC4FA] hover:underline"
              >
                <span>Открыть на YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Preset Switcher */}
            <div className="flex flex-wrap gap-2">
              {CARPET_VIDEOS.map((vid) => {
                const active = selectedVideoId === vid.id;
                return (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => {
                      setSelectedVideoId(vid.id);
                      setActiveEmbedUrl(vid.embedUrl);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-[#9ED164] bg-[#213124] text-[#CBEF9C]'
                        : 'border-[#24303C] bg-[#11171D] text-[#9FB0C0] hover:border-[#45586B] hover:text-white'
                    }`}
                  >
                    {vid.label}
                  </button>
                );
              })}
            </div>

            {/* Responsive 16:9 Iframe */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#2A3744] bg-[#0B0F14]">
              <iframe
                key={activeEmbedUrl}
                src={activeEmbedUrl}
                title="Мойка ковров ASMR"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            {/* Custom URL Input */}
            <form onSubmit={handleApplyCustomVideo} className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="Вставить свою ссылку на YouTube / видео..."
                className="flex-1 bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#253240] text-xs font-semibold text-white hover:bg-[#334558] cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#9ED164]" />
                <span>Включить видео</span>
              </button>
            </form>
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

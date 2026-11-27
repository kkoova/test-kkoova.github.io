import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Dice5,
  Eye,
  Info,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';

interface UpgradeTier {
  id: string;
  fromGrade: string;
  toGrade: string;
  displayedChance: number;
  realWinChance: number; // 0.01 = 1% win (99% rigged loss)
  riggedLossPct: number;
  label: string;
  failResult: string;
}

const UPGRADE_TIERS: UpgradeTier[] = [
  {
    id: '2_to_3',
    fromGrade: '2 (Незачёт)',
    toGrade: '3 (Удовл.)',
    displayedChance: 50,
    realWinChance: 0.05,
    riggedLossPct: 95,
    label: 'Спастись от долга: 2 → 3',
    failResult: 'Долг удвоен (виртуальная пересдача)',
  },
  {
    id: '3_to_4',
    fromGrade: '3 (Удовл.)',
    toGrade: '4 (Хорошо)',
    displayedChance: 35,
    realWinChance: 0.03,
    riggedLossPct: 97,
    label: 'Апгрейд на ударника: 3 → 4',
    failResult: 'Оценка упала до «2»',
  },
  {
    id: '4_to_5',
    fromGrade: '4 (Хорошо)',
    toGrade: '5 (Отлично)',
    displayedChance: 20,
    realWinChance: 0.01,
    riggedLossPct: 99,
    label: 'Охота за пятёркой: 4 → 5',
    failResult: 'Оценка скатилась до «2»',
  },
  {
    id: 'debt_to_auto',
    fromGrade: 'Хвосты',
    toGrade: 'Автомат «5»',
    displayedChance: 10,
    realWinChance: 0.01,
    riggedLossPct: 99,
    label: 'Рискнуть всем: Долги → Автомат',
    failResult: 'Виртуальная комиссия!',
  },
];

const LOSS_COMMENTS = [
  'Почти залетело! Остановилось буквально в миллиметре... Так работает эффект near-miss.',
  'Упс! Оценка сгорела. Добро пожаловать в математику азартных игр.',
  'Казино забрало ставку. Зато в реальном курсе GDScript работает честно!',
  'Накрутка 99% сделала своё дело. Ещё один повод не верить «легким апгрейдам».',
  'Минус оценка! Хочешь «5» со 100% шансом? Открой вкладку «Доп. задание».',
];

const WIN_COMMENTS = [
  'ШОК! Вы пробили шанс в 1–5%! Но помните: на дистанции казино всё равно заберёт всё.',
  'Невероятная случайность сработала. Не повторяйте это за деньги в реальной жизни!',
];

interface SpinLog {
  id: number;
  tierLabel: string;
  won: boolean;
  message: string;
  time: string;
}

export const GradeCasinoView: React.FC<{
  onOpenBonus: () => void;
  onOpenTests: () => void;
}> = ({ onOpenBonus, onOpenTests }) => {
  const [selectedTierId, setSelectedTierId] = useState<string>('4_to_5');
  const [virtualGrade, setVirtualGrade] = useState<number>(4);
  const [spinning, setSpinning] = useState(false);
  const [wheelDeg, setWheelDeg] = useState(0);
  const [showRiggedTruth, setShowRiggedTruth] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    title: string;
    detail: string;
  } | null>(null);
  const [stats, setStats] = useState({ spins: 0, wins: 0, losses: 0 });
  const [logs, setLogs] = useState<SpinLog[]>([]);

  const spinTimeoutRef = useRef<number | null>(null);

  const tier = useMemo(
    () => UPGRADE_TIERS.find((t) => t.id === selectedTierId) || UPGRADE_TIERS[2],
    [selectedTierId]
  );

  // Visual green sector size uses displayedChance so student sees the deceptive UI vs rigged math
  const greenAngle = Math.round((tier.displayedChance / 100) * 360);

  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setLastOutcome(null);

    const won = Math.random() < tier.realWinChance;

    // Pointer is at the top (0 deg). Green sector spans from 0 to greenAngle deg clockwise.
    // After rotating clockwise by `wheelDeg`, the sector under top pointer is `(360 - (wheelDeg % 360)) % 360`.
    let targetOffsetDeg: number;
    if (won) {
      targetOffsetDeg = 4 + Math.random() * Math.max(4, greenAngle - 8);
    } else {
      // Classic near-miss: 60% of losses land just 3-14 degrees outside the green zone!
      const isNearMiss = Math.random() < 0.65;
      if (isNearMiss) {
        targetOffsetDeg = Math.random() < 0.5 ? greenAngle + 3 + Math.random() * 10 : 347 + Math.random() * 10;
      } else {
        const redSpan = Math.max(20, 350 - greenAngle);
        targetOffsetDeg = greenAngle + 8 + Math.random() * redSpan;
      }
    }

    const desiredMod = (360 - (targetOffsetDeg % 360)) % 360;
    const currentMod = ((wheelDeg % 360) + 360) % 360;
    const deltaMod = (desiredMod - currentMod + 360) % 360;
    const nextDeg = wheelDeg + 360 * 5 + deltaMod;
    setWheelDeg(nextDeg);

    if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
    spinTimeoutRef.current = window.setTimeout(() => {
      setSpinning(false);
      setStats((prev) => ({
        spins: prev.spins + 1,
        wins: prev.wins + (won ? 1 : 0),
        losses: prev.losses + (won ? 0 : 1),
      }));

      if (won) {
        const nextGrade = tier.id === '2_to_3' ? 3 : tier.id === '3_to_4' ? 4 : 5;
        setVirtualGrade(nextGrade);
        const msg = WIN_COMMENTS[Math.floor(Math.random() * WIN_COMMENTS.length)];
        setLastOutcome({
          won: true,
          title: `Апгрейд сработал: ${tier.toGrade}!`,
          detail: msg,
        });
        setLogs((prev) => [
          {
            id: Date.now(),
            tierLabel: tier.label,
            won: true,
            message: `Победа (${tier.toGrade})`,
            time: new Date().toLocaleTimeString('ru-RU'),
          },
          ...prev.slice(0, 9),
        ]);
      } else {
        setVirtualGrade((g) => Math.max(2, g - 1));
        const msg = LOSS_COMMENTS[Math.floor(Math.random() * LOSS_COMMENTS.length)];
        setLastOutcome({
          won: false,
          title: tier.failResult,
          detail: msg,
        });
        setLogs((prev) => [
          {
            id: Date.now(),
            tierLabel: tier.label,
            won: false,
            message: tier.failResult,
            time: new Date().toLocaleTimeString('ru-RU'),
          },
          ...prev.slice(0, 9),
        ]);
      }
    }, 2300);
  };

  const realWinRate =
    stats.spins > 0 ? Math.round((stats.wins / stats.spins) * 1000) / 10 : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Warning / Framing Header */}
      <section className="rounded-xl border border-[#E5A454]/45 bg-[#1D1813] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#E5A454]">
            <ShieldAlert className="w-4 h-4" />
            <span>Образовательный анти-казино симулятор</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Апгрейдер оценок · Почему казино — это ловушка
          </h1>
          <p className="text-xs text-[#D6C3AA] max-w-2xl leading-relaxed">
            Эта мини-игра создана по просьбе студентов, чтобы наглядно показать, как устроены «апгрейдеры» и казино. Все оценки здесь{' '}
            <strong className="text-white">виртуальные</strong> — настоящая ведомость не меняется.
          </p>
        </div>

        <div className="px-4 py-3 rounded-lg border border-[#E06C75]/40 bg-[#231417] text-right shrink-0">
          <div className="text-[11px] font-mono text-[#FFB8BE]">Реальная подкрутка</div>
          <div className="text-xl font-bold font-mono text-[#E06C75] tabular-nums">
            {tier.riggedLossPct}% проигрыш
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Roulette Wheel & Spin Controls */}
        <section className="lg:col-span-7 rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono text-[#8EA0B0]">Ваша виртуальная оценка</div>
              <div className="flex items-center gap-2.5 mt-1">
                <span
                  className={`px-3 py-1 rounded-lg font-mono text-xl font-extrabold tabular-nums border ${
                    virtualGrade >= 4
                      ? 'bg-[#213124] border-[#5D8247] text-[#9ED164]'
                      : virtualGrade === 3
                        ? 'bg-[#251E15] border-[#E5A454]/50 text-[#E5A454]'
                        : 'bg-[#2D181B] border-[#E06C75]/60 text-[#FFB8BE]'
                  }`}
                >
                  {virtualGrade}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVirtualGrade(4);
                    setLastOutcome(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#344656] bg-[#11171D] text-[11px] text-[#9FB0C0] hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Восстановить до «4»</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRiggedTruth((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#344656] bg-[#11171D] text-xs font-mono text-[#7CC4FA] hover:border-[#7CC4FA] cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showRiggedTruth ? 'Скрыть код подкрутки' : 'Показать правду кода'}</span>
            </button>
          </div>

          {showRiggedTruth && (
            <div className="p-4 rounded-lg border border-[#7CC4FA]/40 bg-[#101822] text-xs space-y-2">
              <div className="font-mono font-bold text-[#7CC4FA]">
                // Как вас обманывает интерфейс казино:
              </div>
              <p className="text-[#C7D7E8] leading-relaxed">
                Зелёный сектор на колесе рисуется под <strong>{tier.displayedChance}%</strong>, чтобы казалось, что победа рядом. Но внутри функции{' '}
                <code className="text-[#9ED164]">handleSpin()</code> стоит условие{' '}
                <code className="text-[#FFB8BE]">
                  Math.random() &lt; {tier.realWinChance}
                </code>{' '}
                — то есть <strong>{tier.riggedLossPct}%</strong> на проигрыш и 65% шанс «обидного промаха» (near-miss) в миллиметре от победы!
              </p>
            </div>
          )}

          {/* Wheel */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* Top Pointer */}
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-[#F1F6FA] drop-shadow"
                aria-hidden="true"
              />

              {/* Rotating Disc */}
              <div
                className="w-full h-full rounded-full border-4 border-[#344656] shadow-2xl relative overflow-hidden"
                style={{
                  background: `conic-gradient(#9ED164 0deg ${greenAngle}deg, #2A191C ${greenAngle}deg 360deg)`,
                  transform: `rotate(${wheelDeg}deg)`,
                  transition: 'transform 2.2s cubic-bezier(0.12, 0.85, 0.18, 1)',
                }}
              >
                <div className="absolute inset-0 rounded-full border-8 border-black/20 pointer-events-none" />
              </div>

              {/* Center Hub */}
              <div className="absolute w-28 h-28 rounded-full bg-[#131A22] border-2 border-[#344656] flex flex-col items-center justify-center text-center z-10 shadow-inner px-2">
                <span className="text-[10px] font-mono text-[#8EA0B0]">Рисует шанс</span>
                <span className="text-xl font-bold font-mono text-[#9ED164] tabular-nums">
                  {tier.displayedChance}%
                </span>
                <span className="text-[10px] font-mono text-[#E06C75]">
                  Реально: {Math.round(tier.realWinChance * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Tier Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {UPGRADE_TIERS.map((t) => {
              const active = t.id === selectedTierId;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={spinning}
                  onClick={() => setSelectedTierId(t.id)}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-60 ${
                    active
                      ? 'border-[#9ED164] bg-[#1E2A22]'
                      : 'border-[#24303C] bg-[#11171D] hover:border-[#45586B]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
                    <span>{t.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#9ED164] shrink-0" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#8EA0B0]">Витрина: {t.displayedChance}%</span>
                    <span className="text-[#E06C75]">Слив: {t.riggedLossPct}%</span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={spinning}
            onClick={handleSpin}
            className="w-full py-3.5 px-5 rounded-lg bg-[#E5A454] text-[#1A140C] font-bold text-sm hover:bg-[#F0B469] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Dice5 className="w-4 h-4" />
            <span>{spinning ? 'Колесо крутится...' : `Крутить апгрейдер (${tier.fromGrade} → ${tier.toGrade})`}</span>
          </button>

          {lastOutcome && (
            <div
              className={`p-4 rounded-lg border flex items-start gap-3 ${
                lastOutcome.won
                  ? 'border-[#5D8247] bg-[#18261B] text-[#DDF5C8]'
                  : 'border-[#E06C75]/50 bg-[#251518] text-[#FFD0D4]'
              }`}
            >
              {lastOutcome.won ? (
                <Info className="w-5 h-5 text-[#9ED164] shrink-0 mt-0.5" />
              ) : (
                <TrendingDown className="w-5 h-5 text-[#E06C75] shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm">{lastOutcome.title}</div>
                <p className="leading-relaxed opacity-90">{lastOutcome.detail}</p>
              </div>
            </div>
          )}
        </section>

        {/* Right: Stats, Moral & Legit Ways to Upgrade */}
        <aside className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Статистика ваших попыток</h2>
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-lg border border-[#24303C] bg-[#11171D]">
                <div className="text-[11px] text-[#8EA0B0]">Попыток</div>
                <div className="text-lg font-bold font-mono text-white tabular-nums mt-0.5">
                  {stats.spins}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[#24303C] bg-[#11171D]">
                <div className="text-[11px] text-[#8EA0B0]">Побед</div>
                <div className="text-lg font-bold font-mono text-[#9ED164] tabular-nums mt-0.5">
                  {stats.wins}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[#24303C] bg-[#11171D]">
                <div className="text-[11px] text-[#8EA0B0]">Сливов</div>
                <div className="text-lg font-bold font-mono text-[#E06C75] tabular-nums mt-0.5">
                  {stats.losses}
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg border border-[#24303C] bg-[#11171D] flex items-center justify-between text-xs font-mono">
              <span className="text-[#8EA0B0]">Фактический винрейт:</span>
              <span className={realWinRate > 10 ? 'text-[#9ED164]' : 'text-[#E06C75]'}>
                {realWinRate}% (обещали {tier.displayedChance}%)
              </span>
            </div>

            {logs.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[#24303C]">
                <div className="text-[11px] font-mono text-[#8EA0B0]">Последние крутки</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className="px-2.5 py-1.5 rounded bg-[#11171D] border border-[#222D38] flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className={l.won ? 'text-[#9ED164]' : 'text-[#FFB8BE]'}>
                        {l.message}
                      </span>
                      <span className="font-mono text-[#7C8D9C] shrink-0">{l.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-[#E5A454]">
              <AlertTriangle className="w-4 h-4" />
              <span>Вывод для разработчика</span>
            </div>
            <p className="text-xs text-[#9FB0C0] leading-relaxed">
              Казино всегда проектируется с отрицательным математическим ожиданием для игрока, иллюзией контроля и подкрученными «почти победами». Реальную оценку в Godot можно поднять без удачи — только за счёт знаний и практики.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenBonus}
                className="py-2.5 px-3 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
              >
                Доп. задание (100% шанс)
              </button>
              <button
                type="button"
                onClick={onOpenTests}
                className="py-2.5 px-3 rounded-lg border border-[#344656] bg-[#11171D] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
              >
                Перейти к тестам
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

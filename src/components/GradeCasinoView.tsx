import React, { useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Dice5,
  Lock,
  LogIn,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  DAILY_SPIN_LIMIT,
  getTodayDateKey,
  recordWheelSpin,
  WheelSpinRecord,
} from '../services/courseService';

interface WheelTier {
  id: '2_to_3' | '3_to_4' | '4_to_5' | 'debt_close';
  shortTitle: string;
  label: string;
  sectorPercent: number;
  realWinChance: number;
  winDescription: (lab: string) => string;
  loseDescription: (lab: string) => string;
}

const WHEEL_TIERS: WheelTier[] = [
  {
    id: '2_to_3',
    shortTitle: '2 → 3',
    label: 'Повысить с 2 до 3',
    sectorPercent: 40,
    realWinChance: 0.05,
    winDescription: (lab) => `За ${lab} ставится оценка «3»`,
    loseDescription: () => '+ сдача итогового теста (даже если были освобождены)',
  },
  {
    id: '3_to_4',
    shortTitle: '3 → 4',
    label: 'Повысить с 3 до 4',
    sectorPercent: 30,
    realWinChance: 0.03,
    winDescription: (lab) => `За ${lab} ставится оценка «4»`,
    loseDescription: () => '+ сдача итогового теста (даже если были освобождены)',
  },
  {
    id: '4_to_5',
    shortTitle: '4 → 5',
    label: 'Повысить с 4 до 5',
    sectorPercent: 20,
    realWinChance: 0.02,
    winDescription: (lab) => `За ${lab} ставится оценка «5»`,
    loseDescription: (lab) => `Оценка за ${lab} становится «3»`,
  },
  {
    id: 'debt_close',
    shortTitle: 'Закрыть 1 долг',
    label: 'Закрыть 1 долг по лабе',
    sectorPercent: 25,
    realWinChance: 0.03,
    winDescription: (lab) => `Закрыт 1 долг (${lab})`,
    loseDescription: () => '+ сдача итогового теста (даже если были освобождены)',
  },
];

interface GradeCasinoViewProps {
  isSignedIn: boolean;
  userUid: string | null;
  userName: string;
  labsCount: number;
  wheelSpins: WheelSpinRecord[];
  authLoading: boolean;
  onSignIn: () => void;
  onOpenBonus: () => void;
  onOpenTests: () => void;
}

export const GradeCasinoView: React.FC<GradeCasinoViewProps> = ({
  isSignedIn,
  userUid,
  userName,
  labsCount,
  wheelSpins,
  authLoading,
  onSignIn,
  onOpenBonus,
  onOpenTests,
}) => {
  const labOptions = useMemo(() => {
    const total = Math.max(1, labsCount || 6);
    return Array.from({ length: total }, (_, i) => `Лаб ${i + 1}`);
  }, [labsCount]);

  const [selectedLab, setSelectedLab] = useState<string>('Лаб 1');
  const [selectedTierId, setSelectedTierId] = useState<WheelTier['id']>('2_to_3');
  const [spinning, setSpinning] = useState(false);
  const [wheelDeg, setWheelDeg] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    title: string;
    detail: string;
  } | null>(null);

  const spinTimeoutRef = useRef<number | null>(null);

  const effectiveLab = labOptions.includes(selectedLab) ? selectedLab : labOptions[0];
  const tier = useMemo(
    () => WHEEL_TIERS.find((t) => t.id === selectedTierId) || WHEEL_TIERS[0],
    [selectedTierId]
  );

  const todayKey = getTodayDateKey();
  const userSpins = useMemo(() => {
    if (!userUid) return [];
    return wheelSpins.filter((s) => s.uid === userUid);
  }, [wheelSpins, userUid]);

  const todaySpinsCount = useMemo(
    () => userSpins.filter((s) => s.dateKey === todayKey).length,
    [userSpins, todayKey]
  );

  const remainingSpins = Math.max(0, DAILY_SPIN_LIMIT - todaySpinsCount);
  const greenAngle = Math.round((tier.sectorPercent / 100) * 360);

  const handleSpin = () => {
    if (!isSignedIn || !userUid || spinning || remainingSpins <= 0) return;

    setSpinning(true);
    setLastOutcome(null);

    const won = Math.random() < tier.realWinChance;

    let targetOffsetDeg: number;
    if (won) {
      targetOffsetDeg = 4 + Math.random() * Math.max(4, greenAngle - 8);
    } else {
      const isCloseMiss = Math.random() < 0.6;
      if (isCloseMiss) {
        targetOffsetDeg =
          Math.random() < 0.5
            ? greenAngle + 4 + Math.random() * 10
            : 346 + Math.random() * 10;
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

    const labAtSpin = effectiveLab;
    const tierAtSpin = tier;

    if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
    spinTimeoutRef.current = window.setTimeout(() => {
      setSpinning(false);
      const outcomeText = won
        ? tierAtSpin.winDescription(labAtSpin)
        : tierAtSpin.loseDescription(labAtSpin);

      setLastOutcome({
        won,
        title: won ? 'Удача на вашей стороне!' : 'Не повезло в этот раз',
        detail: outcomeText,
      });

      void recordWheelSpin({
        uid: userUid,
        userName,
        labName: labAtSpin,
        tierId: tierAtSpin.id,
        tierLabel: tierAtSpin.shortTitle,
        won,
        outcomeText,
      });
    }, 2300);
  };

  if (!isSignedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-8 text-center space-y-5">
          <div className="w-12 h-12 mx-auto rounded-lg bg-[#251E15] border border-[#E5A454]/50 flex items-center justify-center text-[#E5A454]">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-mono text-[#E5A454]">Колесо удачи</div>
            <h1 className="text-2xl font-bold text-white">
              Войдите в аккаунт, чтобы крутить колесо
            </h1>
            <p className="text-xs text-[#9FB0C0] max-w-md mx-auto leading-relaxed">
              Каждому авторизованному студенту доступно {DAILY_SPIN_LIMIT} попытки в день. Выбирайте лабораторную работу и желаемый результат.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              disabled={authLoading}
              onClick={onSignIn}
              className="px-5 py-3 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-bold hover:bg-[#B4E07F] transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{authLoading ? 'Вход...' : 'Войти через GitHub'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenBonus}
              className="px-5 py-3 rounded-lg border border-[#344656] bg-[#11171D] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
            >
              Доп. задание (100% гарантия)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#E5A454]">
            <Sparkles className="w-4 h-4" />
            <span>Ежедневный шанс для студентов</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Колесо удачи</h1>
          <p className="text-xs text-[#9FB0C0] max-w-2xl leading-relaxed">
            Выберите лабораторную работу и один из 4 вариантов ставки. У каждого студента есть{' '}
            <strong className="text-white">{DAILY_SPIN_LIMIT} попытки в день</strong>.
          </p>
        </div>

        <div className="px-4 py-3 rounded-lg border border-[#344656] bg-[#11171D] text-right shrink-0">
          <div className="text-[11px] font-mono text-[#8EA0B0]">Попыток на сегодня</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              remainingSpins > 0 ? 'text-[#9ED164]' : 'text-[#E06C75]'
            }`}
          >
            {remainingSpins} / {DAILY_SPIN_LIMIT}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Wheel & Selection */}
        <section className="lg:col-span-7 rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-6">
          {/* Lab Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-mono text-[#8EA0B0]">
              1. Какую лабораторную хотите закрыть / повысить?
            </label>
            <div className="flex flex-wrap gap-2">
              {labOptions.map((lab) => {
                const active = lab === effectiveLab;
                return (
                  <button
                    key={lab}
                    type="button"
                    disabled={spinning}
                    onClick={() => setSelectedLab(lab)}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                      active
                        ? 'border-[#9ED164] bg-[#213124] text-[#CBEF9C]'
                        : 'border-[#24303C] bg-[#11171D] text-[#9FB0C0] hover:border-[#45586B] hover:text-white'
                    }`}
                  >
                    {lab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 Variants */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-[#8EA0B0]">
              2. Выберите вариант ставки для «{effectiveLab}»
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {WHEEL_TIERS.map((t) => {
                const active = t.id === selectedTierId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={spinning}
                    onClick={() => setSelectedTierId(t.id)}
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-60 space-y-1.5 ${
                      active
                        ? 'border-[#E5A454] bg-[#241D15]'
                        : 'border-[#24303C] bg-[#11171D] hover:border-[#45586B]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{t.shortTitle}</span>
                      <span className="text-[11px] font-mono text-[#9ED164]">
                        {t.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#9ED164]">
                      Победа: {t.winDescription(effectiveLab)}
                    </div>
                    <div className="text-[11px] text-[#FFB8BE]">
                      Проигрыш: {t.loseDescription(effectiveLab)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wheel */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-[#F1F6FA] drop-shadow"
                aria-hidden="true"
              />

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

              <div className="absolute w-28 h-28 rounded-full bg-[#131A22] border-2 border-[#344656] flex flex-col items-center justify-center text-center z-10 shadow-inner px-2">
                <span className="text-[10px] font-mono text-[#8EA0B0]">{effectiveLab}</span>
                <span className="text-base font-bold text-white mt-0.5 leading-tight">
                  {tier.shortTitle}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={spinning || remainingSpins <= 0}
            onClick={handleSpin}
            className="w-full py-3.5 px-5 rounded-lg bg-[#E5A454] text-[#1A140C] font-bold text-sm hover:bg-[#F0B469] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Dice5 className="w-4 h-4" />
            <span>
              {spinning
                ? 'Колесо крутится...'
                : remainingSpins <= 0
                  ? 'Попытки на сегодня закончились (0 / 3)'
                  : `Крутить колесо (${effectiveLab}: ${tier.shortTitle})`}
            </span>
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
                <CheckCircle2 className="w-5 h-5 text-[#9ED164] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-[#E06C75] shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-sm">{lastOutcome.title}</div>
                <p className="leading-relaxed opacity-90">{lastOutcome.detail}</p>
              </div>
            </div>
          )}
        </section>

        {/* Right: History & 100% Guaranteed Bonus Alternative */}
        <aside className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white">Ваша история круток</h2>
              <span className="text-xs font-mono text-[#8EA0B0] tabular-nums">
                {userName}
              </span>
            </div>

            {userSpins.length === 0 ? (
              <div className="p-5 rounded-lg border border-[#24303C] bg-[#11171D] text-center text-xs text-[#7C8D9C]">
                Вы ещё не крутили колесо. Выберите лабораторную, ставку и испытайте удачу!
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {userSpins.slice(0, 20).map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      s.won
                        ? 'border-[#5D8247]/60 bg-[#17231A]'
                        : 'border-[#2B2024] bg-[#14171D]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">
                        {s.labName} · {s.tierLabel}
                      </span>
                      <span className="font-mono text-[11px] text-[#7C8D9C]">
                        {new Date(s.timestampMs).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className={s.won ? 'text-[#9ED164]' : 'text-[#FFB8BE]'}>
                      {s.outcomeText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 100% Guaranteed Bonus Card */}
          <div className="rounded-xl border border-[#5D8247]/60 bg-[#16211A] p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164]">
              <Award className="w-4 h-4" />
              <span>100% гарантия без риска</span>
            </div>
            <h3 className="text-base font-bold text-white">
              Дополнительное задание на оценку
            </h3>
            <p className="text-xs text-[#C8DEC0] leading-relaxed">
              Не хотите полагаться на удачу или уже потратили 3 попытки? Выполните дополнительное задание — при успешной сдаче оценка повышается со 100% гарантией.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenBonus}
                className="py-2.5 px-3 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-bold hover:bg-[#B4E07F] cursor-pointer"
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

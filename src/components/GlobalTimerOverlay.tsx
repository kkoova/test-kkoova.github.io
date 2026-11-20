import React, { useEffect, useState } from 'react';
import { Clock, Square } from 'lucide-react';
import { GlobalTimerState, stopGlobalTimer } from '../services/courseService';

interface GlobalTimerOverlayProps {
  timer: GlobalTimerState | null;
  isAdmin: boolean;
}

export const GlobalTimerOverlay: React.FC<GlobalTimerOverlayProps> = ({ timer, isAdmin }) => {
  const [remainingSec, setRemainingSec] = useState<number>(0);

  useEffect(() => {
    if (!timer || !timer.isActive) return;

    const update = () => {
      const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
      setRemainingSec(Math.max(0, timer.duration - elapsed));
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  if (!timer || !timer.isActive) return null;

  const mins = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const secs = String(remainingSec % 60).padStart(2, '0');
  const isExpired = remainingSec <= 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F14]/92 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-[#344656] bg-[#161E27] p-8 text-center space-y-6 shadow-2xl">
        <div className="inline-flex items-center gap-2 text-xs font-mono text-[#E5A454]">
          <Clock className="w-4 h-4" />
          <span>Таймер задания</span>
        </div>

        <div
          className={`text-6xl sm:text-7xl font-mono font-bold tracking-tight tabular-nums ${
            isExpired ? 'text-[#E06C75]' : 'text-[#F1F6FA]'
          }`}
        >
          {mins}:{secs}
        </div>

        {timer.goals && timer.goals.length > 0 && (
          <div className="text-left p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-2">
            <div className="text-xs font-mono text-[#9ED164]">Текущие задачи:</div>
            <ul className="space-y-1.5 text-sm text-[#D7E0E8] list-disc list-inside">
              {timer.goals.map((goal, idx) => (
                <li key={idx}>{goal}</li>
              ))}
            </ul>
          </div>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => stopGlobalTimer().catch(() => {})}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E06C75] text-[#1A0D0F] text-xs font-semibold hover:bg-[#EA858D] transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Остановить таймер для всех</span>
          </button>
        )}
      </div>
    </div>
  );
};

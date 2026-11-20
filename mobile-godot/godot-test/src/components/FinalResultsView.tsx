import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { TestGradeResult } from '../data/questions';

interface FinalResultsViewProps {
  studentName: string;
  group: string;
  violationsCount: number;
  result: TestGradeResult;
  onExitToHome: () => void;
}

export const FinalResultsView: React.FC<FinalResultsViewProps> = ({
  studentName,
  group,
  violationsCount,
  result,
  onExitToHome,
}) => {
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct'>('all');

  const filteredDetails = result.details.filter((item) => {
    if (filter === 'wrong') return !item.isCorrect;
    if (filter === 'correct') return item.isCorrect;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0F141A] py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Result Summary */}
        <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#26323F] pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#9ED164] mb-1.5">
                <span>Тест завершён</span>
                <span aria-hidden="true">·</span>
                <span>{group}</span>
                <span aria-hidden="true">·</span>
                <span>{studentName}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F6FA]">
                Результаты проверки
              </h1>
            </div>

            <button
              type="button"
              onClick={onExitToHome}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#344656] bg-[#11171D] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>На главную</span>
            </button>
          </div>

          {/* 4 KPI Figures */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-[#11171D] border border-[#26323F]">
              <div className="text-xs text-[#8EA0B0] mb-1">Правильных ответов</div>
              <div className="text-2xl font-bold font-mono text-[#F1F6FA] tabular-nums">
                {result.score} / {result.total}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#11171D] border border-[#26323F]">
              <div className="text-xs text-[#8EA0B0] mb-1">Процент выполнения</div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums ${
                  result.passed ? 'text-[#9ED164]' : 'text-[#E06C75]'
                }`}
              >
                {result.percentage}%
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#11171D] border border-[#26323F]">
              <div className="text-xs text-[#8EA0B0] mb-1">Итоговая оценка</div>
              <div className="text-lg font-bold text-[#F1F6FA] mt-1">{result.gradeLabel}</div>
            </div>

            <div className="p-4 rounded-lg bg-[#11171D] border border-[#26323F]">
              <div className="text-xs text-[#8EA0B0] mb-1">Нарушения режима</div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums flex items-center gap-2 ${
                  violationsCount > 0 ? 'text-[#E06C75]' : 'text-[#9ED164]'
                }`}
              >
                {violationsCount > 0 && <AlertTriangle className="w-5 h-5 shrink-0" />}
                <span>{violationsCount}</span>
              </div>
            </div>
          </div>

          {/* Section Breakdown */}
          <div>
            <h2 className="text-xs font-mono text-[#8EA0B0] mb-3">Результаты по разделам</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.sectionBreakdown.map((sec) => (
                <div
                  key={sec.section}
                  className="p-3.5 rounded-lg bg-[#11171D] border border-[#26323F] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[#E6EDF3] truncate">{sec.section}</span>
                    <span className="font-mono text-[#9ED164] tabular-nums shrink-0">
                      {sec.correct}/{sec.total} ({sec.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#222D38] overflow-hidden">
                    <div
                      className="h-full bg-[#9ED164] transition-all duration-300"
                      style={{ width: `${sec.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Detailed Question Review */}
        <section className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-bold text-[#F1F6FA]">Разбор ответов</h2>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#11171D] border border-[#26323F]">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  filter === 'all'
                    ? 'bg-[#253240] text-white'
                    : 'text-[#8EA0B0] hover:text-white'
                }`}
              >
                Все ({result.total})
              </button>
              <button
                type="button"
                onClick={() => setFilter('wrong')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  filter === 'wrong'
                    ? 'bg-[#3B2125] text-[#FFB8BE]'
                    : 'text-[#8EA0B0] hover:text-white'
                }`}
              >
                Ошибки ({result.total - result.score})
              </button>
              <button
                type="button"
                onClick={() => setFilter('correct')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  filter === 'correct'
                    ? 'bg-[#213124] text-[#CBEF9C]'
                    : 'text-[#8EA0B0] hover:text-white'
                }`}
              >
                Верные ({result.score})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredDetails.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#8EA0B0]">
                Нет заданий, соответствующих выбранному фильтру.
              </div>
            ) : (
              filteredDetails.map((item) => (
                <div
                  key={item.questionId}
                  className={`p-4 rounded-lg border ${
                    item.isCorrect
                      ? 'bg-[#111915] border-[#2C4731]'
                      : 'bg-[#1C1417] border-[#4A282D]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2.5">
                      {item.isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-[#9ED164] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-[#E06C75] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-mono text-[#8EA0B0] mb-0.5">
                          Задание {String(item.questionId).padStart(2, '0')} · {item.type}
                        </div>
                        <h3 className="text-sm font-semibold text-[#F1F6FA]">{item.title}</h3>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono shrink-0 ${
                        item.isCorrect ? 'text-[#9ED164]' : 'text-[#E06C75]'
                      }`}
                    >
                      {item.isCorrect ? 'Верно' : 'Ошибка'}
                    </span>
                  </div>

                  <div className="pl-7.5 space-y-1.5 text-xs">
                    <div>
                      <span className="text-[#8EA0B0]">Ваш ответ: </span>
                      <span
                        className={`font-mono ${
                          item.isCorrect ? 'text-[#CBEF9C]' : 'text-[#FFB8BE]'
                        }`}
                      >
                        {item.userAnswerFormatted}
                      </span>
                    </div>
                    {!item.isCorrect && (
                      <div>
                        <span className="text-[#8EA0B0]">Правильный ответ: </span>
                        <span className="font-mono text-[#9ED164]">
                          {item.correctAnswerFormatted}
                        </span>
                      </div>
                    )}
                    <p className="text-[#A4B4C4] leading-relaxed pt-1">{item.explanation}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

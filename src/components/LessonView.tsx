import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Clock, Copy, ExternalLink, Skull } from 'lucide-react';
import {
  fetchLessonDoc,
  LessonData,
  triggerGlobalTimer,
} from '../services/courseService';

interface LessonViewProps {
  docName: string;
  isAdmin: boolean;
  onBack: () => void;
}

function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <strong key={idx} className="text-[#CBEF9C] font-semibold">
        {part}
      </strong>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

function getGodotNodeColor(type: string): string {
  if (type.includes('Control') || type.includes('Button') || type.includes('Container')) {
    return '#9ED164';
  }
  if (type.includes('2D')) return '#7CC4FA';
  if (type.includes('Spatial') || type.includes('3D')) return '#E06C75';
  return '#8EA0B0';
}

export const LessonView: React.FC<LessonViewProps> = ({ docName, isAdmin, onBack }) => {
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchLessonDoc(docName)
      .then((data) => {
        if (active) {
          setLesson(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [docName]);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const isTenthEasterEgg = docName.trim() === '10.json';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#344656] bg-[#161E27] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к карте миссий</span>
        </button>
        <span className="font-mono text-xs text-[#8EA0B0]">{docName}</span>
      </div>

      {loading && (
        <div className="rounded-xl border border-[#2A3744] bg-[#161E27] p-8 text-center text-sm text-[#8EA0B0]">
          Загрузка методических материалов...
        </div>
      )}

      {error && (
        isTenthEasterEgg ? (
          <div className="rounded-xl border border-[#E06C75]/50 bg-[#1B1215] p-10 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#2E181D] border border-[#E06C75]/50 flex items-center justify-center text-[#E06C75]">
              <Skull className="w-7 h-7" />
            </div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#E5A454]">
              Миссия 10 · Свободное плавание
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FFB8BE] tracking-tight">
              Дальше бога нет, выживет сильнейший
            </h1>
            <p className="text-xs text-[#C7A8AD] max-w-md mx-auto leading-relaxed">
              На этом этапе готовых подсказок больше нет — используй весь накопленный опыт в Godot 4, документацию и собственную фантазию.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E06C75] text-[#1A0D0F] text-xs font-semibold hover:bg-[#EA858D] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Вернуться на карту миссий</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E5A454]/40 bg-[#1F1A14] p-8 text-center space-y-3">
            <div className="text-base font-bold text-[#E5A454]">{error}</div>
            <p className="text-xs text-[#C7B49B] max-w-md mx-auto">
              Файл с описанием урока должен находиться по пути <code className="text-[#CBEF9C]">assets/docs/{docName}</code> или быть создан в редакторе миссий преподавателя.
            </p>
          </div>
        )
      )}

      {lesson && (
        <>
          <header className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 sm:p-8">
            <div className="text-xs font-mono text-[#9ED164] mb-1.5">{lesson.unit}</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F6FA]">{lesson.title}</h1>
          </header>

          <div className="space-y-5">
            {lesson.phases.map((phase) => (
              <section
                key={phase.id}
                className="rounded-xl border border-[#2A3744] bg-[#161E27] p-6 space-y-4"
              >
                <div className="border-b border-[#24303C] pb-3">
                  <div className="text-xs font-mono text-[#E5A454] mb-1">{phase.label}</div>
                  <h2 className="text-lg font-bold text-white">{phase.header}</h2>
                </div>

                <div className="space-y-4">
                  {phase.items.map((item, idx) => {
                    if (item.type === 'text') {
                      return (
                        <p key={idx} className="text-sm text-[#B7C5D3] leading-relaxed">
                          {renderFormattedText(item.val)}
                        </p>
                      );
                    }

                    if (item.type === 'button') {
                      return (
                        <a
                          key={idx}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#213124] border border-[#5D8247] text-xs font-semibold text-[#CBEF9C] hover:bg-[#293E2D]"
                        >
                          <span>{item.text}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      );
                    }

                    if (item.type === 'config') {
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#24303C] bg-[#11171D] divide-y divide-[#1E2833]"
                        >
                          {item.data.map(([k, v], rIdx) => (
                            <div
                              key={rIdx}
                              className="px-4 py-2.5 flex items-center justify-between gap-4 text-xs"
                            >
                              <span className="font-mono text-[#8EA0B0]">{renderFormattedText(k)}</span>
                              <span className="font-mono text-[#E6EDF3]">{renderFormattedText(v)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    if (item.type === 'tip') {
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-lg border border-[#5D8247]/60 bg-[#162319] text-xs text-[#D4EBC0] leading-relaxed"
                        >
                          <span className="font-mono font-bold text-[#9ED164] mr-2">Совет:</span>
                          {renderFormattedText(item.val)}
                        </div>
                      );
                    }

                    if (item.type === 'instruction') {
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-lg border border-[#344656] bg-[#11171D] text-sm text-[#E6EDF3] leading-relaxed"
                        >
                          {renderFormattedText(item.val)}
                        </div>
                      );
                    }

                    if (item.type === 'timer') {
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-lg border border-[#E5A454]/40 bg-[#1E1912] flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 text-xs font-mono text-[#E5A454]">
                            <Clock className="w-4 h-4" />
                            <span>Таймер практики: {item.minutes} мин</span>
                          </div>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => triggerGlobalTimer(item.minutes, item.goals || [])}
                              className="px-3.5 py-2 rounded-md bg-[#E5A454] text-[#1A140C] text-xs font-semibold hover:bg-[#F0B469] cursor-pointer"
                            >
                              Запустить таймер для класса
                            </button>
                          ) : (
                            <span className="text-xs text-[#9FB0C0]">
                              Запускается преподавателем
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (item.type === 'grid') {
                      return (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {item.items.map((gText, gIdx) => (
                            <div
                              key={gIdx}
                              className="p-3.5 rounded-lg border border-[#24303C] bg-[#11171D] flex items-start gap-3"
                            >
                              <span className="font-mono text-xs font-bold text-[#9ED164] tabular-nums">
                                {String(gIdx + 1).padStart(2, '0')}
                              </span>
                              <p className="text-xs text-[#D7E0E8] leading-relaxed">
                                {renderFormattedText(gText)}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    if (item.type === 'tree') {
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-lg border border-[#24303C] bg-[#0B0F14] space-y-1.5"
                        >
                          {item.nodes.map((node, nIdx) => (
                            <div
                              key={nIdx}
                              style={{ paddingLeft: `${node.level * 20}px` }}
                              className="flex items-center gap-2.5 py-1 text-xs font-mono"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-xs shrink-0"
                                style={{ backgroundColor: getGodotNodeColor(node.type) }}
                              />
                              <span className="text-[#F1F6FA] font-semibold">{node.name}</span>
                              <span className="text-[#7C8D9C]">{node.type}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    if (item.type === 'code') {
                      const codeId = `${phase.id}_${idx}`;
                      const trimmed = item.code.trim();
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#2A3744] bg-[#0A0F14] overflow-hidden"
                        >
                          <div className="px-4 py-2 border-b border-[#222E3A] flex items-center justify-between text-xs font-mono text-[#7C8D9C]">
                            <span>{item.title || 'GDScript'}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(codeId, trimmed)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#344656] bg-[#131A22] text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
                            >
                              {copiedId === codeId ? (
                                <>
                                  <Check className="w-3 h-3 text-[#9ED164]" />
                                  <span className="text-[#9ED164]">Скопировано</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Копировать</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-4 overflow-x-auto text-[13px] leading-6 font-mono text-[#D0D9E2]">
                            <code>{trimmed}</code>
                          </pre>
                        </div>
                      );
                    }

                    if (item.type === 'image') {
                      return (
                        <figure key={idx} className="space-y-2">
                          <img
                            src={item.url}
                            alt={item.caption || 'Godot скриншот'}
                            referrerPolicy="no-referrer"
                            className="rounded-lg border border-[#2A3744] max-w-full"
                          />
                          {item.caption && (
                            <figcaption className="text-xs text-[#8EA0B0] font-mono">
                              {item.caption}
                            </figcaption>
                          )}
                        </figure>
                      );
                    }

                    return null;
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

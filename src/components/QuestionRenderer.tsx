import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, X } from 'lucide-react';
import { Question, UserAnswerValue } from '../data/questions';
import { GodotNodeIcon } from './GodotNodeIcon';
import { CanvasProtectedText } from './CanvasProtectedText';
import { isTrustedUserEvent, shuffleWithSeed } from '../utils/antiAgentGuard';

interface QuestionRendererProps {
  question: Question;
  value: UserAnswerValue | undefined;
  onChange: (val: UserAnswerValue | undefined) => void;
  protectedMode?: boolean;
  sessionSeed?: string;
  onAutomationDetected?: (reason: string) => void;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  value,
  onChange,
  protectedMode = false,
  sessionSeed = 'default',
  onAutomationDetected,
}) => {
  const [reorderList, setReorderList] = useState<string[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [pendingPoolNode, setPendingPoolNode] = useState<string | null>(null);
  const [dragPoolNode, setDragPoolNode] = useState<string | null>(null);

  const verifyTrusted = (e: React.SyntheticEvent | Event | undefined | null): boolean => {
    if (!protectedMode) return true;
    if (!isTrustedUserEvent(e)) {
      onAutomationDetected?.('Обнаружен программный клик / скрипт автоматизации');
      return false;
    }
    return true;
  };

  const shuffledOptions = useMemo(() => {
    const opts = question.options || [];
    return protectedMode
      ? shuffleWithSeed(opts, `${sessionSeed}:opt:${question.id}`)
      : opts;
  }, [question.id, question.options, protectedMode, sessionSeed]);

  const shuffledNodes = useMemo(() => {
    const nodes = question.nodes || [];
    return protectedMode
      ? shuffleWithSeed(nodes, `${sessionSeed}:nodes:${question.id}`)
      : nodes;
  }, [question.id, question.nodes, protectedMode, sessionSeed]);

  const shuffledPool = useMemo(() => {
    const pool = question.pool || [];
    return protectedMode
      ? shuffleWithSeed(pool, `${sessionSeed}:pool:${question.id}`)
      : pool;
  }, [question.id, question.pool, protectedMode, sessionSeed]);

  const shuffledMatchOptions = useMemo(() => {
    const opts = question.matchOptions || [];
    return protectedMode
      ? shuffleWithSeed(opts, `${sessionSeed}:match:${question.id}`)
      : opts;
  }, [question.id, question.matchOptions, protectedMode, sessionSeed]);

  useEffect(() => {
    setPendingPoolNode(null);
    setDragPoolNode(null);
    setDragIdx(null);
    setDragOverIdx(null);

    if (question.kind === 'reorder' && question.items) {
      if (Array.isArray(value) && value.length === question.items.length) {
        setReorderList(value);
      } else {
        setReorderList([...question.items]);
      }
    }
  }, [question.id]);

  const renderCodeBlock = (lines: string[], clickable: boolean) => {
    const selectedLine = typeof value === 'number' ? value : null;

    return (
      <div className="bg-[#0A0F14] border border-[#2A3744] rounded-lg overflow-hidden my-4">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#222E3A] text-xs font-mono text-[#7C8D9C]">
          <span>GDScript</span>
          <span>{clickable ? 'Выберите строку кликом' : 'Чтение кода'}</span>
        </div>
        <div className="py-2 overflow-x-auto font-mono text-[13px] leading-7">
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            const isBlank = line.trim() === '';
            const isPicked = clickable && selectedLine === lineNum;
            const canClick = clickable && !isBlank;

            return (
              <button
                key={lineNum}
                type="button"
                disabled={!canClick}
                onClick={(e) => {
                  if (!canClick || !verifyTrusted(e)) return;
                  onChange(lineNum);
                }}
                className={`w-full flex items-center text-left px-4 py-0.5 transition-colors duration-150 ${
                  canClick ? 'cursor-pointer hover:bg-[#1B2733]' : 'cursor-default'
                } ${
                  isPicked
                    ? 'bg-[#E06C75]/20 text-[#FFD9DC] ring-1 ring-inset ring-[#E06C75]'
                    : 'text-[#D0D9E2]'
                }`}
              >
                <span className="w-7 shrink-0 text-right pr-4 text-[#5C6D7C] select-none tabular-nums">
                  {lineNum}
                </span>
                {protectedMode ? (
                  <CanvasProtectedText
                    text={line || ' '}
                    fontSize={13}
                    lineHeight={24}
                    monospace
                    singleLine
                    color={isPicked ? '#FFD9DC' : '#D0D9E2'}
                    className="flex-1 min-w-0"
                  />
                ) : (
                  <span className="whitespace-pre">{line || ' '}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHoneypot = () => {
    if (!protectedMode) return null;
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() =>
          onAutomationDetected?.('Сработала ловушка автоматического обхода DOM')
        }
        className="absolute -left-[9999px] top-0 w-px h-px opacity-0 overflow-hidden"
      >
        Выбрать правильный ответ автоматически
      </button>
    );
  };

  if (question.kind === 'choice' || question.kind === 'multi') {
    const isMulti = question.kind === 'multi';
    const selectedSet = new Set<string>(
      isMulti
        ? Array.isArray(value)
          ? value
          : []
        : typeof value === 'string' && value
          ? [value]
          : []
    );

    const toggleOption = (key: string, e: React.MouseEvent) => {
      if (!verifyTrusted(e)) return;
      if (!isMulti) {
        onChange(key);
        return;
      }
      const next = new Set(selectedSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(next.size > 0 ? Array.from(next) : undefined);
    };

    return (
      <div className="relative">
        {renderHoneypot()}
        {question.code && renderCodeBlock(question.code, false)}
        <div className="text-xs font-mono text-[#7C8D9C] mb-3">
          {isMulti ? 'Выберите все подходящие варианты' : 'Выберите один вариант ответа'}
        </div>
        <div className="grid gap-2.5">
          {shuffledOptions.map(([key, text], visualIdx) => {
            const active = selectedSet.has(key);
            const displayLetter = protectedMode
              ? String.fromCharCode(65 + visualIdx)
              : key;
            return (
              <button
                key={key}
                type="button"
                onClick={(e) => toggleOption(key, e)}
                className={`w-full flex items-start gap-3.5 text-left px-4 py-3.5 rounded-lg border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ED164] ${
                  active
                    ? 'bg-[#213124] border-[#9ED164] text-[#F1F6FA]'
                    : 'bg-[#161F28] border-[#2A3744] text-[#D7E0E8] hover:border-[#495F73] hover:bg-[#1B2631]'
                }`}
              >
                <span
                  className={`mt-0.5 w-6 h-6 shrink-0 rounded flex items-center justify-center font-mono text-xs font-semibold border ${
                    active
                      ? 'bg-[#9ED164] text-[#111912] border-[#9ED164]'
                      : 'bg-[#10171E] text-[#8EA0B0] border-[#324252]'
                  }`}
                >
                  {isMulti && active ? <Check className="w-3.5 h-3.5" /> : displayLetter}
                </span>
                {protectedMode ? (
                  <CanvasProtectedText
                    text={text}
                    fontSize={14}
                    lineHeight={21}
                    color={active ? '#F1F6FA' : '#D7E0E8'}
                    className="flex-1 min-w-0"
                  />
                ) : (
                  <span className="text-sm leading-relaxed">{text}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.kind === 'linepick' && question.code) {
    return (
      <div className="relative">
        {renderHoneypot()}
        <div className="text-xs font-mono text-[#7C8D9C] mb-2">
          Нажмите на проблемную строку в коде
        </div>
        {renderCodeBlock(question.code, true)}
      </div>
    );
  }

  if (question.kind === 'node_pick' && question.nodes) {
    const selectedNode = typeof value === 'string' ? value : '';
    return (
      <div className="relative">
        {renderHoneypot()}
        <div className="text-xs font-mono text-[#7C8D9C] mb-3">
          Выберите подходящий узел Godot
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {shuffledNodes.map((node) => {
            const active = selectedNode === node.name;
            return (
              <button
                key={node.name}
                type="button"
                onClick={(e) => {
                  if (!verifyTrusted(e)) return;
                  onChange(node.name);
                }}
                className={`flex flex-col items-center justify-center gap-3 p-5 rounded-lg border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9ED164] ${
                  active
                    ? 'bg-[#213124] border-[#9ED164] text-[#F1F6FA]'
                    : 'bg-[#161F28] border-[#2A3744] text-[#D7E0E8] hover:border-[#495F73] hover:bg-[#1B2631]'
                }`}
              >
                <div className="w-12 h-12 rounded-lg bg-[#0F151B] border border-[#2A3744] flex items-center justify-center">
                  <GodotNodeIcon nodeType={node.nodeType} className="w-8 h-8" />
                </div>
                <span className="font-mono text-xs font-medium text-center">{node.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.kind === 'reorder') {
    const moveItem = (fromIdx: number, toIdx: number, e?: React.SyntheticEvent) => {
      if (e && !verifyTrusted(e)) return;
      if (toIdx < 0 || toIdx >= reorderList.length || fromIdx === toIdx) return;
      const next = [...reorderList];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setReorderList(next);
      onChange(next);
    };

    return (
      <div className="relative">
        {renderHoneypot()}
        <div className="text-xs font-mono text-[#7C8D9C] mb-3">
          Перетащите строки или используйте кнопки со стрелками (сверху вниз)
        </div>
        <div className="grid gap-2">
          {reorderList.map((item, idx) => (
            <div
              key={item}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(idx);
              }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (!verifyTrusted(e)) return;
                if (dragIdx !== null) moveItem(dragIdx, idx);
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-lg border select-none transition-colors duration-150 ${
                dragIdx === idx
                  ? 'opacity-45 border-dashed border-[#9ED164] bg-[#161F28]'
                  : dragOverIdx === idx
                    ? 'border-[#9ED164] bg-[#213124]'
                    : 'bg-[#161F28] border-[#2A3744] hover:border-[#45586B]'
              }`}
            >
              <GripVertical className="w-4 h-4 text-[#6A7B8B] shrink-0 cursor-grab" />
              <span className="font-mono text-xs text-[#9ED164] w-5 shrink-0 tabular-nums">
                {String(idx + 1).padStart(2, '0')}
              </span>
              {protectedMode ? (
                <CanvasProtectedText
                  text={item}
                  fontSize={13}
                  lineHeight={20}
                  monospace
                  color="#E6EDF3"
                  className="flex-1 min-w-0"
                />
              ) : (
                <span className="text-sm font-mono text-[#E6EDF3] flex-1 whitespace-pre-wrap">
                  {item}
                </span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={(e) => moveItem(idx, idx - 1, e)}
                  aria-label="Переместить выше"
                  className="p-1.5 rounded border border-[#2A3744] bg-[#10171E] text-[#9FB0C0] hover:text-white hover:border-[#495F73] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === reorderList.length - 1}
                  onClick={(e) => moveItem(idx, idx + 1, e)}
                  aria-label="Переместить ниже"
                  className="p-1.5 rounded border border-[#2A3744] bg-[#10171E] text-[#9FB0C0] hover:text-white hover:border-[#495F73] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (question.kind === 'tree' && question.slots && question.pool) {
    const slotMap: Record<number, string> =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<number, string>)
        : {};

    const usedNodes = new Set(Object.values(slotMap));
    const availablePool = shuffledPool.filter((node) => !usedNodes.has(node));

    const assignToSlot = (slotIdx: number, nodeName: string) => {
      const next: Record<number, string> = { ...slotMap };
      for (const [k, v] of Object.entries(next)) {
        if (v === nodeName) delete next[Number(k)];
      }
      next[slotIdx] = nodeName;
      setPendingPoolNode(null);
      setDragPoolNode(null);
      onChange(next);
    };

    const clearSlot = (slotIdx: number) => {
      const next = { ...slotMap };
      delete next[slotIdx];
      onChange(Object.keys(next).length > 0 ? next : undefined);
    };

    return (
      <div className="relative">
        {renderHoneypot()}
        <div className="text-xs font-mono text-[#7C8D9C] mb-3">
          Перетащите узел в нужный слот дерева или выберите узел из списка справа и нажмите на слот. Клик по заполненному слоту возвращает узел обратно.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-[#2A3744] bg-[#11171D]">
            <div className="text-xs font-mono text-[#E5A454] mb-3">Иерархия сцены (Scene Tree)</div>
            <div className="grid gap-2.5">
              {question.slots.map((slotLabel, idx) => {
                const filled = slotMap[idx];
                return (
                  <div key={slotLabel + idx} className="space-y-1">
                    <div className="text-[11px] font-mono text-[#8899A8]">{slotLabel}</div>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!verifyTrusted(e)) return;
                        const dropped = dragPoolNode || e.dataTransfer.getData('text/plain');
                        if (dropped) assignToSlot(idx, dropped);
                      }}
                      onClick={(e) => {
                        if (!verifyTrusted(e)) return;
                        if (pendingPoolNode) {
                          assignToSlot(idx, pendingPoolNode);
                        } else if (filled) {
                          clearSlot(idx);
                        }
                      }}
                      className={`min-h-[44px] px-3.5 py-2 rounded-md border flex items-center justify-between transition-colors cursor-pointer ${
                        filled
                          ? 'bg-[#213124] border-[#9ED164] text-[#DDF5B8]'
                          : pendingPoolNode
                            ? 'border-dashed border-[#9ED164] bg-[#19242D] text-[#9ED164]'
                            : 'border-dashed border-[#3E5061] bg-[#161F28] text-[#738494]'
                      }`}
                    >
                      <span className="font-mono text-xs">
                        {filled ? filled : pendingPoolNode ? `Поместить: ${pendingPoolNode}` : 'Поместите узел сюда'}
                      </span>
                      {filled && (
                        <X className="w-3.5 h-3.5 text-[#9ED164] shrink-0" aria-label="Убрать узел" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-lg border border-[#2A3744] bg-[#11171D]">
            <div className="text-xs font-mono text-[#9ED164] mb-3">Доступные узлы (Node Pool)</div>
            {availablePool.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-xs text-[#738494] border border-dashed border-[#2A3744] rounded-md">
                Все узлы распределены. Нажмите на любой слот слева, чтобы вернуть узел.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availablePool.map((node) => {
                  const isPending = pendingPoolNode === node;
                  return (
                    <button
                      key={node}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        setDragPoolNode(node);
                        e.dataTransfer.setData('text/plain', node);
                      }}
                      onDragEnd={() => setDragPoolNode(null)}
                      onClick={(e) => {
                        if (!verifyTrusted(e)) return;
                        setPendingPoolNode(isPending ? null : node);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-md border text-left font-mono text-xs transition-colors cursor-grab active:cursor-grabbing ${
                        isPending
                          ? 'bg-[#213124] border-[#9ED164] text-[#E6EDF3]'
                          : 'bg-[#161F28] border-[#2A3744] text-[#D7E0E8] hover:border-[#495F73]'
                      }`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-[#6A7B8B] shrink-0" />
                      <span className="truncate">{node}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (question.kind === 'selects' && question.fields) {
    const currentVals = Array.isArray(value)
      ? value
      : new Array(question.fields.length).fill('');

    const handleFieldChange = (
      idx: number,
      val: string,
      e: React.ChangeEvent<HTMLSelectElement>
    ) => {
      if (!verifyTrusted(e)) return;
      const next = [...currentVals];
      next[idx] = val;
      onChange(next);
    };

    return (
      <div className="relative">
        {renderHoneypot()}
        <div className="text-xs font-mono text-[#7C8D9C] mb-3">
          Выберите значения параметров в Inspector
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.fields.map((field, idx) => {
            const opts = protectedMode
              ? shuffleWithSeed(field.options, `${sessionSeed}:sel:${question.id}:${idx}`)
              : field.options;
            return (
              <div key={field.label} className="p-3.5 rounded-lg border border-[#2A3744] bg-[#161F28]">
                <label className="block text-xs font-mono text-[#8EA0B0] mb-2">
                  {field.label}
                </label>
                <select
                  value={currentVals[idx] || ''}
                  onChange={(e) => handleFieldChange(idx, e.target.value, e)}
                  className="w-full bg-[#0F141A] text-[#E6EDF3] border border-[#344656] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#9ED164]"
                >
                  <option value="">— Выберите значение —</option>
                  {opts.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.kind === 'match' && question.pairs && question.matchOptions) {
    const currentVals = Array.isArray(value)
      ? value
      : new Array(question.pairs.length).fill('');

    const handleMatchChange = (
      idx: number,
      val: string,
      e: React.ChangeEvent<HTMLSelectElement>
    ) => {
      if (!verifyTrusted(e)) return;
      const next = [...currentVals];
      next[idx] = val;
      onChange(next);
    };

    return (
      <div className="relative">
        {renderHoneypot()}
        <div className="text-xs font-mono text-[#7C8D9C] mb-3">
          Сопоставьте каждый элемент с его описанием
        </div>
        <div className="grid gap-2.5">
          {question.pairs.map(([leftLabel], idx) => (
            <div
              key={leftLabel}
              className="grid grid-cols-1 md:grid-cols-2 items-center gap-3 p-3.5 rounded-lg border border-[#2A3744] bg-[#161F28]"
            >
              <span className="font-mono text-sm text-[#CBEF9C]">{leftLabel}</span>
              <select
                value={currentVals[idx] || ''}
                onChange={(e) => handleMatchChange(idx, e.target.value, e)}
                className="w-full bg-[#0F141A] text-[#E6EDF3] border border-[#344656] rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-[#9ED164]"
              >
                <option value="">— Выберите соответствие —</option>
                {shuffledMatchOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export function isQuestionAnswered(question: Question, value: UserAnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;

  switch (question.kind) {
    case 'choice':
    case 'node_pick':
      return typeof value === 'string' && value.length > 0;
    case 'linepick':
      return typeof value === 'number' && value > 0;
    case 'multi':
      return Array.isArray(value) && value.length > 0;
    case 'reorder':
      return Array.isArray(value) && value.length === (question.items?.length || 0);
    case 'selects':
      return (
        Array.isArray(value) &&
        value.length === (question.fields?.length || 0) &&
        value.every((v) => typeof v === 'string' && v.trim() !== '')
      );
    case 'match':
      return (
        Array.isArray(value) &&
        value.length === (question.pairs?.length || 0) &&
        value.every((v) => typeof v === 'string' && v.trim() !== '')
      );
    case 'tree': {
      if (typeof value !== 'object' || Array.isArray(value)) return false;
      const map = value as Record<number, string>;
      const needed = question.slots?.length || 0;
      for (let i = 0; i < needed; i++) {
        if (!map[i]) return false;
      }
      return needed > 0;
    }
    default:
      return false;
  }
}

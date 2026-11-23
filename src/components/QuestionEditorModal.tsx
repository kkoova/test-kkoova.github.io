import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Shuffle, Trash2, X } from 'lucide-react';
import { NodeOption, Question, QuestionKind } from '../data/questions';

interface QuestionEditorModalProps {
  initialQuestion: Question | null;
  nextId: number;
  existingSections: string[];
  onClose: () => void;
  onSave: (q: Question) => void;
}

const KIND_LABELS: { kind: QuestionKind; label: string; defaultType: string }[] = [
  { kind: 'choice', label: 'Одиночный выбор (A/B/C/D)', defaultType: 'Выбор решения' },
  { kind: 'multi', label: 'Множественный выбор', defaultType: 'Множественный выбор' },
  { kind: 'linepick', label: 'Поиск строки с ошибкой в коде', defaultType: 'Поиск ошибки в коде' },
  { kind: 'reorder', label: 'Порядок выполнения / шагов', defaultType: 'Порядок выполнения' },
  { kind: 'node_pick', label: 'Выбор узла Godot', defaultType: 'Выбор узла' },
  { kind: 'tree', label: 'Сборка дерева сцены (слоты)', defaultType: 'Дерево сцены' },
  { kind: 'selects', label: 'Настройка полей Inspector', defaultType: 'Настройка Inspector' },
  { kind: 'match', label: 'Сопоставление пар', defaultType: 'Сопоставление' },
];

const NODE_TYPES: NodeOption['nodeType'][] = [
  'CharacterBody2D',
  'Area2D',
  'Sprite2D',
  'CollisionShape2D',
  'RigidBody2D',
  'Node2D',
];

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  initialQuestion,
  nextId,
  existingSections,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialQuestion);

  const [section, setSection] = useState<string>(
    initialQuestion?.section || existingSections[0] || '01. Инициализация сцены'
  );
  const [kind, setKind] = useState<QuestionKind>(initialQuestion?.kind || 'choice');
  const [typeLabel, setTypeLabel] = useState<string>(
    initialQuestion?.type || 'Выбор решения'
  );
  const [title, setTitle] = useState<string>(initialQuestion?.title || '');
  const [desc, setDesc] = useState<string>(initialQuestion?.desc || '');
  const [contextText, setContextText] = useState<string>(initialQuestion?.context || '');
  const [codeText, setCodeText] = useState<string>(
    initialQuestion?.code ? initialQuestion.code.join('\n') : ''
  );
  const [explanation, setExplanation] = useState<string>(initialQuestion?.explanation || '');

  // choice / multi
  const [options, setOptions] = useState<[string, string][]>(() => {
    if (initialQuestion?.options && initialQuestion.options.length > 0) {
      return initialQuestion.options.map(([k, v]) => [k, v]);
    }
    return [
      ['A', 'Вариант 1'],
      ['B', 'Вариант 2'],
      ['C', 'Вариант 3'],
      ['D', 'Вариант 4'],
    ];
  });
  const [choiceCorrect, setChoiceCorrect] = useState<string>(() =>
    initialQuestion?.kind === 'choice' && typeof initialQuestion.correct === 'string'
      ? initialQuestion.correct
      : 'A'
  );
  const [multiCorrect, setMultiCorrect] = useState<string[]>(() =>
    initialQuestion?.kind === 'multi' && Array.isArray(initialQuestion.correct)
      ? initialQuestion.correct
      : ['A']
  );

  // linepick
  const [linePickCorrect, setLinePickCorrect] = useState<number>(() =>
    initialQuestion?.kind === 'linepick' && typeof initialQuestion.correct === 'number'
      ? initialQuestion.correct
      : 1
  );

  // reorder (author edits in correct order; initial items shuffled)
  const [reorderCorrect, setReorderCorrect] = useState<string[]>(() => {
    if (initialQuestion?.kind === 'reorder' && Array.isArray(initialQuestion.correct)) {
      return [...initialQuestion.correct];
    }
    return ['Шаг 1', 'Шаг 2', 'Шаг 3'];
  });
  const [reorderItems, setReorderItems] = useState<string[]>(() => {
    if (initialQuestion?.kind === 'reorder' && initialQuestion.items) {
      return [...initialQuestion.items];
    }
    return ['Шаг 2', 'Шаг 3', 'Шаг 1'];
  });

  // node_pick
  const [nodes, setNodes] = useState<NodeOption[]>(() => {
    if (initialQuestion?.nodes && initialQuestion.nodes.length > 0) {
      return initialQuestion.nodes.map((n) => ({ ...n }));
    }
    return [
      { name: 'Area2D', nodeType: 'Area2D' },
      { name: 'CharacterBody2D', nodeType: 'CharacterBody2D' },
      { name: 'Sprite2D', nodeType: 'Sprite2D' },
      { name: 'CollisionShape2D', nodeType: 'CollisionShape2D' },
    ];
  });
  const [nodeCorrect, setNodeCorrect] = useState<string>(() =>
    initialQuestion?.kind === 'node_pick' && typeof initialQuestion.correct === 'string'
      ? initialQuestion.correct
      : 'Area2D'
  );

  // tree
  const [treeSlots, setTreeSlots] = useState<string[]>(() => {
    if (initialQuestion?.kind === 'tree' && initialQuestion.slots) {
      return [...initialQuestion.slots];
    }
    return ['ROOT (корневой узел)', 'CHILD (дочерний узел 1)', 'CHILD (дочерний узел 2)'];
  });
  const [treeSlotAnswers, setTreeSlotAnswers] = useState<string[]>(() => {
    if (
      initialQuestion?.kind === 'tree' &&
      typeof initialQuestion.correct === 'object' &&
      !Array.isArray(initialQuestion.correct)
    ) {
      const c = initialQuestion.correct;
      const arr = [c.root || ''];
      if (c.second) arr.push(c.second);
      if (c.unorderedTail) arr.push(...c.unorderedTail);
      return arr;
    }
    return ['CharacterBody2D', 'Sprite2D', 'CollisionShape2D'];
  });
  const [treeHasSecondLevel, setTreeHasSecondLevel] = useState<boolean>(() =>
    Boolean(
      initialQuestion?.kind === 'tree' &&
        typeof initialQuestion.correct === 'object' &&
        !Array.isArray(initialQuestion.correct) &&
        initialQuestion.correct.second
    )
  );
  const [treeExtraPool, setTreeExtraPool] = useState<string>(() => {
    if (initialQuestion?.kind === 'tree' && initialQuestion.pool) {
      const used = new Set(treeSlotAnswers);
      return initialQuestion.pool.filter((p) => !used.has(p)).join(', ');
    }
    return '';
  });

  // selects
  const [selectFields, setSelectFields] = useState<{ label: string; optionsText: string; correct: string }[]>(() => {
    if (initialQuestion?.kind === 'selects' && initialQuestion.fields) {
      const corrArr = Array.isArray(initialQuestion.correct) ? initialQuestion.correct : [];
      return initialQuestion.fields.map((f, idx) => ({
        label: f.label,
        optionsText: f.options.join(', '),
        correct: corrArr[idx] || f.options[0] || '',
      }));
    }
    return [
      {
        label: 'Свойство Shape',
        optionsText: 'RectangleShape2D, CircleShape2D, Не назначено',
        correct: 'RectangleShape2D',
      },
      { label: 'Свойство Disabled', optionsText: 'On, Off', correct: 'Off' },
    ];
  });

  // match
  const [matchPairs, setMatchPairs] = useState<{ left: string; right: string }[]>(() => {
    if (initialQuestion?.kind === 'match' && initialQuestion.pairs) {
      return initialQuestion.pairs.map(([l, r]) => ({ left: l, right: r }));
    }
    return [
      { left: 'Area2D', right: 'Зона-триггер без физики' },
      { left: 'CharacterBody2D', right: 'Управляемый персонаж' },
      { left: 'Sprite2D', right: 'Отображение текстуры' },
    ];
  });
  const [matchExtraDistractors, setMatchExtraDistractors] = useState<string>(() => {
    if (initialQuestion?.kind === 'match' && initialQuestion.matchOptions && initialQuestion.pairs) {
      const pairRights = new Set(initialQuestion.pairs.map((p) => p[1]));
      return initialQuestion.matchOptions.filter((m) => !pairRights.has(m)).join(', ');
    }
    return '';
  });

  const [error, setError] = useState<string | null>(null);

  const codeLines = useMemo(() => codeText.split('\n'), [codeText]);

  const handleKindChange = (nextKind: QuestionKind) => {
    setKind(nextKind);
    const meta = KIND_LABELS.find((k) => k.kind === nextKind);
    if (meta) setTypeLabel(meta.defaultType);
    if (nextKind === 'linepick' && !codeText.trim()) {
      setCodeText(
        [
          'extends CharacterBody2D',
          'var speed = 200',
          'func _physics_process(delta):',
          '    velocity.y = 0',
          '    move_and_slide()',
        ].join('\n')
      );
      setLinePickCorrect(4);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) {
      setError('Заполните заголовок и описание задания.');
      return;
    }

    const base: Question = {
      id: initialQuestion?.id ?? nextId,
      section: section.trim() || 'Общий раздел',
      type: typeLabel.trim() || 'Задание',
      kind,
      title: title.trim(),
      desc: desc.trim(),
      ...(contextText.trim() ? { context: contextText.trim() } : {}),
      ...(codeText.trim() ? { code: codeText.split('\n') } : {}),
      correct: '',
      explanation: explanation.trim() || 'Правильный ответ зафиксирован в ключе задания.',
    };

    if (kind === 'choice') {
      const cleaned = options
        .map(([k, v], idx): [string, string] => [OPTION_KEYS[idx] || k, v.trim()])
        .filter(([, v]) => v.length > 0);
      if (cleaned.length < 2) {
        setError('Добавьте минимум 2 варианта ответа.');
        return;
      }
      base.options = cleaned;
      base.correct = cleaned.some(([k]) => k === choiceCorrect) ? choiceCorrect : cleaned[0][0];
    } else if (kind === 'multi') {
      const cleaned = options
        .map(([k, v], idx): [string, string] => [OPTION_KEYS[idx] || k, v.trim()])
        .filter(([, v]) => v.length > 0);
      if (cleaned.length < 2) {
        setError('Добавьте минимум 2 варианта ответа.');
        return;
      }
      const validKeys = new Set(cleaned.map(([k]) => k));
      const corr = multiCorrect.filter((k) => validKeys.has(k));
      if (corr.length === 0) {
        setError('Отметьте хотя бы один правильный вариант.');
        return;
      }
      base.options = cleaned;
      base.correct = corr;
    } else if (kind === 'linepick') {
      if (!codeText.trim()) {
        setError('Введите код для поиска строки.');
        return;
      }
      const lines = codeText.split('\n');
      if (linePickCorrect < 1 || linePickCorrect > lines.length || !lines[linePickCorrect - 1].trim()) {
        setError('Выберите непустую строку с ошибкой.');
        return;
      }
      base.code = lines;
      base.correct = linePickCorrect;
    } else if (kind === 'reorder') {
      const cleanCorr = reorderCorrect.map((s) => s.trim()).filter(Boolean);
      if (cleanCorr.length < 2) {
        setError('Добавьте минимум 2 шага для сортировки.');
        return;
      }
      let initialItems = reorderItems.map((s) => s.trim()).filter(Boolean);
      const sameSet =
        initialItems.length === cleanCorr.length &&
        cleanCorr.every((c) => initialItems.includes(c));
      if (!sameSet || initialItems.every((v, i) => v === cleanCorr[i])) {
        initialItems = shuffleArray(cleanCorr);
        if (cleanCorr.length > 1 && initialItems.every((v, i) => v === cleanCorr[i])) {
          [initialItems[0], initialItems[1]] = [initialItems[1], initialItems[0]];
        }
      }
      base.items = initialItems;
      base.correct = cleanCorr;
    } else if (kind === 'node_pick') {
      const cleanNodes = nodes.filter((n) => n.name.trim().length > 0);
      if (cleanNodes.length < 2) {
        setError('Добавьте минимум 2 узла.');
        return;
      }
      base.nodes = cleanNodes.map((n) => ({ ...n, name: n.name.trim() }));
      base.correct = cleanNodes.some((n) => n.name.trim() === nodeCorrect)
        ? nodeCorrect
        : cleanNodes[0].name.trim();
    } else if (kind === 'tree') {
      const cleanSlots = treeSlots.map((s) => s.trim()).filter(Boolean);
      const cleanAnswers = cleanSlots.map((_, idx) => (treeSlotAnswers[idx] || '').trim());
      if (cleanSlots.length < 2 || cleanAnswers.some((a) => !a)) {
        setError('Заполните названия слотов и правильные узлы для каждого слота.');
        return;
      }
      const extras = treeExtraPool
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      base.slots = cleanSlots;
      base.pool = shuffleArray(Array.from(new Set([...cleanAnswers, ...extras])));
      if (treeHasSecondLevel && cleanAnswers.length >= 3) {
        base.correct = {
          root: cleanAnswers[0],
          second: cleanAnswers[1],
          unorderedTail: cleanAnswers.slice(2),
        };
      } else {
        base.correct = {
          root: cleanAnswers[0],
          unorderedTail: cleanAnswers.slice(1),
        };
      }
    } else if (kind === 'selects') {
      const cleanFields = selectFields
        .map((f) => {
          const opts = f.optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);
          const corr = opts.includes(f.correct.trim()) ? f.correct.trim() : opts[0] || '';
          return { label: f.label.trim(), options: opts, correct: corr };
        })
        .filter((f) => f.label && f.options.length > 0);
      if (cleanFields.length === 0) {
        setError('Добавьте хотя бы одно поле настройки.');
        return;
      }
      base.fields = cleanFields.map((f) => ({ label: f.label, options: f.options }));
      base.correct = cleanFields.map((f) => f.correct);
    } else if (kind === 'match') {
      const cleanPairs = matchPairs
        .map((p): [string, string] => [p.left.trim(), p.right.trim()])
        .filter(([l, r]) => l && r);
      if (cleanPairs.length < 2) {
        setError('Добавьте минимум 2 пары сопоставления.');
        return;
      }
      const extras = matchExtraDistractors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      base.pairs = cleanPairs;
      base.correct = cleanPairs.map(([, r]) => r);
      base.matchOptions = shuffleArray(
        Array.from(new Set([...cleanPairs.map(([, r]) => r), ...extras]))
      );
    }

    onSave(base);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-xl border border-[#344656] bg-[#161E27] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#24303C] bg-[#131A22] flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-[#9ED164]">
              Конструктор вопросов · {isEditing ? `Задание ${initialQuestion?.id}` : `Новое задание #${nextId}`}
            </div>
            <h2 className="text-base font-bold text-white">
              {isEditing ? 'Редактирование вопроса' : 'Создание вопроса для теста'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md border border-[#2A3744] text-[#8EA0B0] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-[#2D181B] border border-[#E06C75]/50 text-xs text-[#FFB8BE]">
              {error}
            </div>
          )}

          {/* Meta fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">Формат задания</label>
              <select
                value={kind}
                onChange={(e) => handleKindChange(e.target.value as QuestionKind)}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              >
                {KIND_LABELS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">Раздел</label>
              <input
                type="text"
                list="question-sections-list"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
              <datalist id="question-sections-list">
                {existingSections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">Подпись типа</label>
              <input
                type="text"
                value={typeLabel}
                onChange={(e) => setTypeLabel(e.target.value)}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
              Заголовок вопроса
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Краткая формулировка вопроса"
              className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
              Условие задания (описание)
            </label>
            <textarea
              rows={2}
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Подробное описание ситуации или задачи для студента"
              className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
              Контекст / подсказка (опционально)
            </label>
            <input
              type="text"
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Например: Ограничение или инструкция к формату ответа"
              className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
            />
          </div>

          {/* Code block (always shown for linepick, optional for choice/multi) */}
          {(kind === 'linepick' || kind === 'choice' || kind === 'multi') && (
            <div className="space-y-2">
              <label className="block text-xs font-mono text-[#8EA0B0]">
                {kind === 'linepick'
                  ? 'Код GDScript (затем выберите строку с ошибкой ниже)'
                  : 'Код GDScript (опционально, если вопрос по коду)'}
              </label>
              <textarea
                rows={5}
                value={codeText}
                onChange={(e) => setCodeText(e.target.value)}
                placeholder={'extends CharacterBody2D\nfunc _ready():\n    pass'}
                className="w-full bg-[#0A0F14] border border-[#344656] rounded-md px-3 py-2 text-xs font-mono text-[#CBEF9C] placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
              />
            </div>
          )}

          {/* KIND SPECIFIC EDITORS */}
          {(kind === 'choice' || kind === 'multi') && (
            <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9ED164]">
                  Варианты ответа ({kind === 'choice' ? 'выберите 1 верный' : 'отметьте все верные'})
                </span>
                {options.length < OPTION_KEYS.length && (
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => [
                        ...prev,
                        [OPTION_KEYS[prev.length] || String(prev.length + 1), ''],
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs text-[#9ED164] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить вариант</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {options.map(([k, val], idx) => {
                  const key = OPTION_KEYS[idx] || k;
                  const isChecked =
                    kind === 'choice' ? choiceCorrect === key : multiCorrect.includes(key);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type={kind === 'choice' ? 'radio' : 'checkbox'}
                        name="choice-correct-radio"
                        checked={isChecked}
                        onChange={() => {
                          if (kind === 'choice') setChoiceCorrect(key);
                          else {
                            setMultiCorrect((prev) =>
                              prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
                            );
                          }
                        }}
                        className="accent-[#9ED164] w-4 h-4 cursor-pointer"
                        title="Отметить как правильный"
                      />
                      <span className="w-6 font-mono text-xs font-bold text-[#9ED164] text-center">
                        {key}
                      </span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const txt = e.target.value;
                          setOptions((prev) =>
                            prev.map((item, i) => (i === idx ? [key, txt] : item))
                          );
                        }}
                        placeholder={`Текст варианта ${key}`}
                        className="flex-1 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-[#7C8D9C] hover:text-[#E06C75] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {kind === 'linepick' && (
            <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-2">
              <div className="text-xs font-mono text-[#9ED164]">
                Нажмите на строку, которая является правильным ответом (строкой с ошибкой)
              </div>
              <div className="rounded border border-[#2A3744] bg-[#0A0F14] py-1.5 font-mono text-xs">
                {codeLines.map((line, idx) => {
                  const num = idx + 1;
                  const blank = !line.trim();
                  const picked = linePickCorrect === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={blank}
                      onClick={() => setLinePickCorrect(num)}
                      className={`w-full flex items-center text-left px-3 py-1 ${
                        blank ? 'opacity-30 cursor-default' : 'cursor-pointer hover:bg-[#1A2530]'
                      } ${picked ? 'bg-[#E06C75]/20 text-[#FFD9DC]' : 'text-[#D0D9E2]'}`}
                    >
                      <span className="w-7 text-right pr-3 text-[#6C7E8E] tabular-nums">
                        {num}
                      </span>
                      <span className="whitespace-pre">{line || ' '}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {kind === 'reorder' && (
            <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-[#9ED164]">
                  Укажите шаги в ПРАВИЛЬНОМ порядке (сверху вниз)
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReorderItems(shuffleArray(reorderCorrect))}
                    className="inline-flex items-center gap-1 text-xs text-[#E5A454] hover:underline cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Перемешать старт</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReorderCorrect((prev) => [...prev, `Шаг ${prev.length + 1}`])
                    }
                    className="inline-flex items-center gap-1 text-xs text-[#9ED164] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить шаг</span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {reorderCorrect.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 text-center font-mono text-xs text-[#8EA0B0] tabular-nums">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReorderCorrect((prev) => prev.map((s, i) => (i === idx ? val : s)));
                      }}
                      className="flex-1 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                    />
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        setReorderCorrect((prev) => {
                          const c = [...prev];
                          [c[idx - 1], c[idx]] = [c[idx], c[idx - 1]];
                          return c;
                        })
                      }
                      className="p-1 text-[#8EA0B0] hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === reorderCorrect.length - 1}
                      onClick={() =>
                        setReorderCorrect((prev) => {
                          const c = [...prev];
                          [c[idx + 1], c[idx]] = [c[idx], c[idx + 1]];
                          return c;
                        })
                      }
                      className="p-1 text-[#8EA0B0] hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {reorderCorrect.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setReorderCorrect((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-[#7C8D9C] hover:text-[#E06C75] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {kind === 'node_pick' && (
            <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9ED164]">
                  Узлы для выбора (отметьте правильный)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setNodes((prev) => [...prev, { name: 'Node2D', nodeType: 'Node2D' }])
                  }
                  className="inline-flex items-center gap-1 text-xs text-[#9ED164] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить узел</span>
                </button>
              </div>
              <div className="space-y-2">
                {nodes.map((node, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="node-pick-correct"
                      checked={nodeCorrect === node.name}
                      onChange={() => setNodeCorrect(node.name)}
                      className="accent-[#9ED164] w-4 h-4 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={node.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const wasCorrect = nodeCorrect === node.name;
                        setNodes((prev) =>
                          prev.map((n, i) => (i === idx ? { ...n, name: val } : n))
                        );
                        if (wasCorrect) setNodeCorrect(val);
                      }}
                      className="flex-1 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                    />
                    <select
                      value={node.nodeType}
                      onChange={(e) => {
                        const nt = e.target.value as NodeOption['nodeType'];
                        setNodes((prev) =>
                          prev.map((n, i) => (i === idx ? { ...n, nodeType: nt } : n))
                        );
                      }}
                      className="bg-[#0F141A] border border-[#344656] rounded px-2.5 py-1.5 text-xs font-mono text-white"
                    >
                      {NODE_TYPES.map((nt) => (
                        <option key={nt} value={nt}>
                          {nt}
                        </option>
                      ))}
                    </select>
                    {nodes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setNodes((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-[#7C8D9C] hover:text-[#E06C75] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {kind === 'tree' && (
            <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-[#9ED164]">
                  Слоты дерева сцены и правильные узлы
                </span>
                <label className="inline-flex items-center gap-2 text-xs text-[#D7E0E8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={treeHasSecondLevel}
                    onChange={(e) => setTreeHasSecondLevel(e.target.checked)}
                    className="accent-[#9ED164] w-4 h-4"
                  />
                  <span>Слот 2 является вложенным контейнером (second)</span>
                </label>
              </div>
              <div className="space-y-2">
                {treeSlots.map((slotLabel, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={slotLabel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTreeSlots((prev) => prev.map((s, i) => (i === idx ? val : s)));
                      }}
                      placeholder={`Название слота ${idx + 1}`}
                      className="sm:col-span-6 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={treeSlotAnswers[idx] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTreeSlotAnswers((prev) => {
                          const next = [...prev];
                          next[idx] = val;
                          return next;
                        });
                      }}
                      placeholder="Правильный узел"
                      className="sm:col-span-5 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs font-mono text-[#CBEF9C]"
                    />
                    {treeSlots.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTreeSlots((prev) => prev.filter((_, i) => i !== idx));
                          setTreeSlotAnswers((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-[#7C8D9C] hover:text-[#E06C75] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTreeSlots((prev) => [...prev, `CHILD (дочерний узел ${prev.length})`]);
                    setTreeSlotAnswers((prev) => [...prev, 'Node2D']);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-[#9ED164] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить слот</span>
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#8EA0B0] mb-1">
                  Лишние узлы в пуле (через запятую, опционально)
                </label>
                <input
                  type="text"
                  value={treeExtraPool}
                  onChange={(e) => setTreeExtraPool(e.target.value)}
                  placeholder="Camera2D, RigidBody2D"
                  className="w-full bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          {kind === 'selects' && (
            <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9ED164]">
                  Поля настройки (выпадающие списки)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectFields((prev) => [
                      ...prev,
                      { label: 'Параметр', optionsText: 'Да, Нет', correct: 'Да' },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs text-[#9ED164] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить поле</span>
                </button>
              </div>
              <div className="space-y-3">
                {selectFields.map((field, idx) => {
                  const opts = field.optionsText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded border border-[#24303C] bg-[#0F141A] space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectFields((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, label: val } : f))
                            );
                          }}
                          placeholder="Название поля"
                          className="flex-1 bg-[#161E27] border border-[#344656] rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <select
                          value={opts.includes(field.correct) ? field.correct : opts[0] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectFields((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, correct: val } : f))
                            );
                          }}
                          className="bg-[#161E27] border border-[#5D8247] rounded px-2.5 py-1.5 text-xs text-[#CBEF9C]"
                        >
                          {opts.map((o) => (
                            <option key={o} value={o}>
                              Верно: {o}
                            </option>
                          ))}
                        </select>
                        {selectFields.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectFields((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-[#7C8D9C] hover:text-[#E06C75] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={field.optionsText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, optionsText: val } : f))
                          );
                        }}
                        placeholder="Варианты через запятую"
                        className="w-full bg-[#161E27] border border-[#344656] rounded px-2.5 py-1.5 text-xs text-[#9FB0C0]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {kind === 'match' && (
            <div className="p-4 rounded-lg border border-[#24303C] bg-[#11171D] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9ED164]">
                  Пары сопоставления (Левый элемент → Правильное значение)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMatchPairs((prev) => [...prev, { left: '', right: '' }])
                  }
                  className="inline-flex items-center gap-1 text-xs text-[#9ED164] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить пару</span>
                </button>
              </div>
              <div className="space-y-2">
                {matchPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pair.left}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMatchPairs((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, left: val } : p))
                        );
                      }}
                      placeholder="Термин / узел"
                      className="flex-1 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white"
                    />
                    <span className="text-[#6C7E8E] font-mono">→</span>
                    <input
                      type="text"
                      value={pair.right}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMatchPairs((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, right: val } : p))
                        );
                      }}
                      placeholder="Правильное соответствие"
                      className="flex-1 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-[#CBEF9C]"
                    />
                    {matchPairs.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMatchPairs((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-[#7C8D9C] hover:text-[#E06C75] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#8EA0B0] mb-1">
                  Дополнительные отвлекающие варианты (через запятую, опционально)
                </label>
                <input
                  type="text"
                  value={matchExtraDistractors}
                  onChange={(e) => setMatchExtraDistractors(e.target.value)}
                  placeholder="Лишний вариант 1, Лишний вариант 2"
                  className="w-full bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
              Пояснение правильного ответа (показывается студенту в разборе)
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Кратко объясните, почему именно этот вариант верный"
              className="w-full bg-[#0F141A] border border-[#344656] rounded-md px-3 py-2 text-xs text-white placeholder-[#6C7E8E] focus:outline-none focus:border-[#9ED164]"
            />
          </div>

          <div className="pt-2 border-t border-[#24303C] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-[#344656] text-xs text-[#9FB0C0] hover:text-white cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
            >
              {isEditing ? 'Сохранить изменения' : 'Добавить вопрос'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

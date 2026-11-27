import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  Download,
  Edit3,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteCustomDoc,
  fetchLessonDoc,
  LessonData,
  LessonItem,
  LessonPhase,
  Mission,
  resetMissionsToDefault,
  saveCustomDoc,
  saveMissions,
} from '../services/courseService';

const PREVIEW_PRESETS = [
  'assets/previews/lv-1.png',
  'assets/previews/lv-2.png',
  'assets/previews/lv-3.png',
  'assets/previews/lv-4.png',
  'assets/previews/lv-5.png',
  'assets/previews/lv-6.png',
  'assets/previews/lv-7.png',
  'assets/previews/lv-8.png',
  'assets/previews/lv-9.png',
  'assets/previews/lv-tet6.png',
];

interface MissionEditorPanelProps {
  missions: Mission[];
  customDocs: Record<string, LessonData>;
}

export const MissionEditorPanel: React.FC<MissionEditorPanelProps> = ({
  missions,
  customDocs,
}) => {
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);

  // Mission modal editor state
  const [editingMissionIdx, setEditingMissionIdx] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Mission>({
    id: '',
    title: '',
    subtitle: '',
    preview_img: 'assets/previews/lv-1.png',
    godot_path: '',
    tutorial_url: '',
    steps: [''],
  });

  // Lesson Doc editor modal state
  const [docModalName, setDocModalName] = useState<string | null>(null);
  const [docDraft, setDocDraft] = useState<LessonData | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docJsonMode, setDocJsonMode] = useState(false);
  const [docRawJson, setDocRawJson] = useState('');
  const [docError, setDocError] = useState<string | null>(null);

  const showToast = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 4000);
  };

  const persistMissionsList = async (next: Mission[], toastText: string) => {
    try {
      await saveMissions(next);
      showToast(toastText);
    } catch {
      showToast(`${toastText} (сохранено локально — проверьте права Firestore)`);
    }
  };

  const openCreateMission = () => {
    const num = missions.length + 1;
    const padded = String(num).padStart(2, '0');
    setDraft({
      id: `m${padded}_custom_${Date.now().toString().slice(-4)}`,
      title: `${padded}. Новая миссия`,
      subtitle: 'Краткое описание целей практической работы',
      preview_img: 'assets/previews/lv-6.png',
      godot_path: '',
      tutorial_url: `${padded}.json`,
      steps: ['Изучить задачу и создать сцену', 'Реализовать основную механику', 'Проверить работу и отправить проект'],
    });
    setEditingMissionIdx('new');
  };

  const openEditMission = (idx: number) => {
    const target = missions[idx];
    if (!target) return;
    setDraft({
      ...target,
      steps: target.steps.length > 0 ? [...target.steps] : [''],
    });
    setEditingMissionIdx(idx);
  };

  const handleSaveMissionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Mission = {
      id: draft.id.trim() || `m_${Date.now()}`,
      title: draft.title.trim() || 'Без названия',
      subtitle: draft.subtitle.trim(),
      preview_img: draft.preview_img.trim(),
      godot_path: draft.godot_path.trim(),
      tutorial_url: draft.tutorial_url.trim(),
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
    };

    const next =
      editingMissionIdx === 'new'
        ? [...missions, cleaned]
        : missions.map((m, i) => (i === editingMissionIdx ? cleaned : m));

    setEditingMissionIdx(null);
    await persistMissionsList(
      next,
      editingMissionIdx === 'new'
        ? `Миссия «${cleaned.title}» добавлена.`
        : `Миссия «${cleaned.title}» обновлена.`
    );
  };

  const handleMoveMission = async (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= missions.length) return;
    const next = [...missions];
    const [item] = next.splice(idx, 1);
    next.splice(targetIdx, 0, item);
    await persistMissionsList(next, 'Порядок миссий обновлён.');
  };

  const handleDuplicateMission = async (idx: number) => {
    const src = missions[idx];
    if (!src) return;
    const clone: Mission = {
      ...src,
      id: `${src.id}_copy_${Date.now().toString().slice(-4)}`,
      title: `${src.title} (копия)`,
      steps: [...src.steps],
    };
    const next = [...missions];
    next.splice(idx + 1, 0, clone);
    await persistMissionsList(next, `Создана копия «${clone.title}».`);
  };

  const handleDeleteMission = async (idx: number) => {
    if (missions.length <= 1) return;
    const removed = missions[idx];
    const next = missions.filter((_, i) => i !== idx);
    await persistMissionsList(next, `Миссия «${removed.title}» удалена.`);
  };

  const handleExportDataJson = () => {
    const blob = new Blob([JSON.stringify({ missions }, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDataJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const arr = Array.isArray(parsed) ? parsed : parsed?.missions;
      if (!Array.isArray(arr) || arr.length === 0) {
        showToast('Ошибка: JSON не содержит массив missions.');
        return;
      }
      await persistMissionsList(arr as Mission[], `Импортировано миссий: ${arr.length}.`);
    } catch {
      showToast('Ошибка чтения JSON-файла.');
    } finally {
      e.target.value = '';
    }
  };

  const handleResetAll = async () => {
    setConfirmReset(false);
    try {
      await resetMissionsToDefault();
      showToast('Миссии восстановлены из исходного data.json.');
    } catch {
      showToast('Восстановлено локально из data.json.');
    }
  };

  // --- Lesson Doc Editor ---
  const openDocEditor = async (mission: Mission) => {
    const docName = (mission.tutorial_url || `${mission.id}.json`).trim();
    setDocModalName(docName);
    setDocLoading(true);
    setDocJsonMode(false);
    setDocError(null);
    try {
      const loaded = await fetchLessonDoc(docName);
      setDocDraft(loaded);
      setDocRawJson(JSON.stringify(loaded, null, 2));
    } catch {
      const starter: LessonData = {
        unit: 'НОВЫЙ МОДУЛЬ',
        title: mission.title,
        phases: [
          {
            id: 'phase_1',
            label: 'ЭТАП 01',
            header: 'Подготовка и теория',
            items: [
              { type: 'text', val: mission.subtitle || 'Описание задания для студентов.' },
              { type: 'instruction', val: 'Шаг 1: Создайте новую сцену в Godot Engine.' },
              { type: 'tip', val: 'Не забывайте сохранять сцены через Ctrl+S.' },
            ],
          },
        ],
      };
      setDocDraft(starter);
      setDocRawJson(JSON.stringify(starter, null, 2));
    } finally {
      setDocLoading(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!docModalName || !docDraft) return;
    let payload: LessonData = docDraft;
    if (docJsonMode) {
      try {
        payload = JSON.parse(docRawJson) as LessonData;
        setDocDraft(payload);
      } catch {
        setDocError('Ошибка синтаксиса JSON. Проверьте запятые и кавычки.');
        return;
      }
    }
    setDocError(null);
    try {
      await saveCustomDoc(docModalName, payload);
      showToast(`Методичка «${docModalName}» сохранена и сразу доступна студентам.`);
    } catch {
      showToast(`Методичка «${docModalName}» сохранена локально.`);
    }
    setDocModalName(null);
  };

  const handleDownloadDoc = () => {
    if (!docModalName || !docDraft) return;
    const content = docJsonMode ? docRawJson : JSON.stringify(docDraft, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docModalName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updatePhase = (pIdx: number, updater: (p: LessonPhase) => LessonPhase) => {
    if (!docDraft) return;
    const next: LessonData = {
      ...docDraft,
      phases: docDraft.phases.map((p, i) => (i === pIdx ? updater(p) : p)),
    };
    setDocDraft(next);
    setDocRawJson(JSON.stringify(next, null, 2));
  };

  const addBlockToPhase = (pIdx: number, type: LessonItem['type']) => {
    let item: LessonItem;
    if (type === 'text') item = { type: 'text', val: 'Новый абзац текста.' };
    else if (type === 'instruction') item = { type: 'instruction', val: 'Инструкция для выполнения.' };
    else if (type === 'tip') item = { type: 'tip', val: 'Полезный совет для студента.' };
    else if (type === 'code') item = { type: 'code', title: 'GDScript', code: 'extends Node2D\n\nfunc _ready():\n    pass' };
    else if (type === 'button') item = { type: 'button', text: 'Открыть ресурс', url: 'https://godotengine.org' };
    else if (type === 'image') item = { type: 'image', url: './assets/img/l01-1.png', caption: 'Скриншот' };
    else if (type === 'timer') item = { type: 'timer', minutes: 15, goals: ['Выполнить шаг 1'] };
    else item = { type: 'grid', items: ['Пункт 1', 'Пункт 2'] };

    updatePhase(pIdx, (p) => ({ ...p, items: [...p.items, item] }));
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">
            Веб-редактор миссий и методичек ({missions.length})
          </h2>
          <p className="text-xs text-[#8EA0B0]">
            Создавайте и редактируйте карточки миссий, этапы и тексты методичек прямо здесь — без правки JSON-файлов вручную.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportDataJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#161E27] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Импорт data.json</span>
          </button>
          <button
            type="button"
            onClick={handleExportDataJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#161E27] text-xs font-medium text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт data.json</span>
          </button>
          {confirmReset ? (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#E06C75] text-[#1A0D0F] text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Точно сбросить?</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmReset(true);
                window.setTimeout(() => setConfirmReset(false), 4000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#344656] bg-[#161E27] text-xs font-medium text-[#9FB0C0] hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сброс</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreateMission}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить миссию</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-lg border border-[#5D8247] bg-[#213124] text-xs text-[#CBEF9C]">
          {msg}
        </div>
      )}

      {/* Missions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {missions.map((m, idx) => {
          const hasCustomDoc = Boolean(m.tutorial_url && customDocs[m.tutorial_url]);
          return (
            <div
              key={`${m.id}-${idx}`}
              className="rounded-xl border border-[#2A3744] bg-[#161E27] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.preview_img && (
                      <img
                        src={`./${m.preview_img}`}
                        alt={m.title}
                        referrerPolicy="no-referrer"
                        className="w-16 h-12 rounded-lg border border-[#24303C] object-cover shrink-0 bg-[#0B0F14]"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-[#9ED164] truncate">
                        #{String(idx + 1).padStart(2, '0')} · {m.id}
                      </div>
                      <h3 className="text-sm font-bold text-white truncate">{m.title}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveMission(idx, -1)}
                      title="Выше"
                      className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === missions.length - 1}
                      onClick={() => handleMoveMission(idx, 1)}
                      title="Ниже"
                      className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#9FB0C0] leading-relaxed">{m.subtitle}</p>

                <div className="p-3 rounded-lg border border-[#24303C] bg-[#11171D] text-[11px] font-mono text-[#8EA0B0] space-y-1">
                  <div className="truncate">
                    Сборка: <span className="text-[#D7E0E8]">{m.godot_path || 'без демо-сборки'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      Методичка: <span className="text-[#CBEF9C]">{m.tutorial_url || 'не задана'}</span>
                    </span>
                    {hasCustomDoc && (
                      <span className="text-[#9ED164] shrink-0">изменена в веб</span>
                    )}
                  </div>
                  <div>Этапов в чек-листе: {m.steps.length}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#24303C]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditMission(idx)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#344656] bg-[#11171D] text-xs font-medium text-white hover:border-[#9ED164] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Изменить</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDocEditor(m)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#4A683B] bg-[#213124] text-xs font-medium text-[#CBEF9C] hover:bg-[#2A402E] cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Методичка</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDuplicateMission(idx)}
                    title="Дублировать"
                    className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {missions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteMission(idx)}
                      title="Удалить"
                      className="p-1.5 rounded border border-[#344656] bg-[#11171D] text-[#8EA0B0] hover:text-[#E06C75] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mission Edit/Create Modal */}
      {editingMissionIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingMissionIdx(null)}
        >
          <form
            onSubmit={handleSaveMissionModal}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-[#344656] bg-[#161E27] p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#24303C] pb-3">
              <h3 className="text-base font-bold text-white">
                {editingMissionIdx === 'new' ? 'Новая миссия' : 'Редактирование миссии'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingMissionIdx(null)}
                className="p-1.5 rounded border border-[#2A3744] text-[#8EA0B0] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                  ID миссии
                </label>
                <input
                  type="text"
                  required
                  value={draft.id}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                  className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                  Файл методички (tutorial_url)
                </label>
                <input
                  type="text"
                  value={draft.tutorial_url}
                  onChange={(e) => setDraft({ ...draft, tutorial_url: e.target.value })}
                  placeholder="01.json или 11.json"
                  className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Название миссии
              </label>
              <input
                type="text"
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                Краткое описание (subtitle)
              </label>
              <textarea
                rows={2}
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                  Превью-картинка (preview_img)
                </label>
                <input
                  type="text"
                  value={draft.preview_img}
                  onChange={(e) => setDraft({ ...draft, preview_img: e.target.value })}
                  list="preview-presets"
                  className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                />
                <datalist id="preview-presets">
                  {PREVIEW_PRESETS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                  Godot HTML сборка (godot_path, опционально)
                </label>
                <input
                  type="text"
                  value={draft.godot_path}
                  onChange={(e) => setDraft({ ...draft, godot_path: e.target.value })}
                  placeholder="missions/m01_ui/index.html"
                  className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#9ED164]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-[#8EA0B0]">
                  Шаги миссии (чек-лист справа)
                </label>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, steps: [...draft.steps, ''] })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#4A683B] bg-[#213124] text-[11px] font-medium text-[#CBEF9C] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Добавить шаг</span>
                </button>
              </div>
              <div className="space-y-2">
                {draft.steps.map((step, sIdx) => (
                  <div key={sIdx} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#6C7E8E] w-5 text-right shrink-0">
                      {sIdx + 1}.
                    </span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => {
                        const nextSteps = [...draft.steps];
                        nextSteps[sIdx] = e.target.value;
                        setDraft({ ...draft, steps: nextSteps });
                      }}
                      placeholder="Название этапа..."
                      className="flex-1 bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#9ED164]"
                    />
                    {draft.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            steps: draft.steps.filter((_, i) => i !== sIdx),
                          })
                        }
                        className="p-2 rounded border border-[#344656] text-[#8EA0B0] hover:text-[#E06C75] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#24303C]">
              <button
                type="button"
                onClick={() => setEditingMissionIdx(null)}
                className="px-4 py-2 rounded-lg border border-[#344656] text-xs font-medium text-[#9FB0C0] hover:text-white cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Сохранить миссию</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tutorial / Lesson Doc Visual Editor Modal */}
      {docModalName && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDocModalName(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-[#344656] bg-[#161E27] shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-[#24303C] bg-[#131A22] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-mono text-[#9ED164]">
                  Редактор методички · {docModalName}
                </div>
                <h3 className="text-base font-bold text-white">
                  {docDraft?.title || 'Загрузка...'}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (docJsonMode && docDraft) {
                      try {
                        const parsed = JSON.parse(docRawJson) as LessonData;
                        setDocDraft(parsed);
                        setDocError(null);
                        setDocJsonMode(false);
                      } catch {
                        setDocError('Исправьте ошибки JSON перед переключением.');
                      }
                    } else if (docDraft) {
                      setDocRawJson(JSON.stringify(docDraft, null, 2));
                      setDocJsonMode(true);
                    }
                  }}
                  className="px-3 py-1.5 rounded border border-[#344656] bg-[#11171D] text-xs font-mono text-[#7CC4FA] cursor-pointer"
                >
                  {docJsonMode ? 'Визуальный вид' : 'Режим JSON'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDoc}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#344656] bg-[#11171D] text-xs text-[#D7E0E8] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать</span>
                </button>
                {customDocs[docModalName] && (
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteCustomDoc(docModalName).catch(() => {});
                      showToast(`Пользовательская копия «${docModalName}» удалена.`);
                      setDocModalName(null);
                    }}
                    className="px-3 py-1.5 rounded border border-[#E06C75]/40 text-xs text-[#FFB8BE] cursor-pointer"
                  >
                    Сбросить
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDocModalName(null)}
                  className="p-1.5 rounded border border-[#2A3744] text-[#8EA0B0] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {docLoading || !docDraft ? (
                <div className="text-center text-xs text-[#8EA0B0] py-10">
                  Загрузка методички...
                </div>
              ) : docJsonMode ? (
                <textarea
                  rows={22}
                  value={docRawJson}
                  onChange={(e) => setDocRawJson(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#344656] rounded-lg p-4 text-xs font-mono text-[#D0D9E2] focus:outline-none focus:border-[#9ED164]"
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                        Модуль (unit)
                      </label>
                      <input
                        type="text"
                        value={docDraft.unit}
                        onChange={(e) => {
                          const next = { ...docDraft, unit: e.target.value };
                          setDocDraft(next);
                          setDocRawJson(JSON.stringify(next, null, 2));
                        }}
                        className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-[#8EA0B0] mb-1">
                        Заголовок урока (title)
                      </label>
                      <input
                        type="text"
                        value={docDraft.title}
                        onChange={(e) => {
                          const next = { ...docDraft, title: e.target.value };
                          setDocDraft(next);
                          setDocRawJson(JSON.stringify(next, null, 2));
                        }}
                        className="w-full bg-[#0F141A] border border-[#344656] rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {docDraft.phases.map((phase, pIdx) => (
                      <div
                        key={`${phase.id}-${pIdx}`}
                        className="rounded-xl border border-[#2A3744] bg-[#11171D] p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={phase.label}
                              onChange={(e) =>
                                updatePhase(pIdx, (p) => ({ ...p, label: e.target.value }))
                              }
                              className="w-28 bg-[#0B0F14] border border-[#344656] rounded px-2.5 py-1 text-xs font-mono text-[#E5A454]"
                            />
                            <input
                              type="text"
                              value={phase.header}
                              onChange={(e) =>
                                updatePhase(pIdx, (p) => ({ ...p, header: e.target.value }))
                              }
                              className="flex-1 min-w-[200px] bg-[#0B0F14] border border-[#344656] rounded px-3 py-1 text-xs font-bold text-white"
                            />
                          </div>
                          {docDraft.phases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = {
                                  ...docDraft,
                                  phases: docDraft.phases.filter((_, i) => i !== pIdx),
                                };
                                setDocDraft(next);
                                setDocRawJson(JSON.stringify(next, null, 2));
                              }}
                              className="p-1.5 rounded border border-[#344656] text-[#8EA0B0] hover:text-[#E06C75] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2.5">
                          {phase.items.map((item, iIdx) => (
                            <div
                              key={iIdx}
                              className="p-3 rounded-lg border border-[#24303C] bg-[#161E27] space-y-2"
                            >
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-[#9ED164]">Блок: {item.type}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePhase(pIdx, (p) => ({
                                      ...p,
                                      items: p.items.filter((_, k) => k !== iIdx),
                                    }))
                                  }
                                  className="text-[#8EA0B0] hover:text-[#E06C75] cursor-pointer"
                                >
                                  Удалить блок
                                </button>
                              </div>

                              {(item.type === 'text' ||
                                item.type === 'tip' ||
                                item.type === 'instruction') && (
                                <textarea
                                  rows={2}
                                  value={item.val}
                                  onChange={(e) =>
                                    updatePhase(pIdx, (p) => ({
                                      ...p,
                                      items: p.items.map((it, k) =>
                                        k === iIdx ? { ...item, val: e.target.value } : it
                                      ),
                                    }))
                                  }
                                  className="w-full bg-[#0F141A] border border-[#344656] rounded px-3 py-2 text-xs text-white"
                                />
                              )}

                              {item.type === 'code' && (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={item.title || ''}
                                    placeholder="Заголовок кода (напр. player.gd)"
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx ? { ...item, title: e.target.value } : it
                                        ),
                                      }))
                                    }
                                    className="w-full bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs font-mono text-[#9ED164]"
                                  />
                                  <textarea
                                    rows={4}
                                    value={item.code}
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx ? { ...item, code: e.target.value } : it
                                        ),
                                      }))
                                    }
                                    className="w-full bg-[#0B0F14] border border-[#344656] rounded px-3 py-2 text-xs font-mono text-[#D0D9E2]"
                                  />
                                </div>
                              )}

                              {item.type === 'image' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={item.url}
                                    placeholder="./assets/img/..."
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx ? { ...item, url: e.target.value } : it
                                        ),
                                      }))
                                    }
                                    className="bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs font-mono text-white"
                                  />
                                  <input
                                    type="text"
                                    value={item.caption || ''}
                                    placeholder="Подпись"
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx ? { ...item, caption: e.target.value } : it
                                        ),
                                      }))
                                    }
                                    className="bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                              )}

                              {item.type === 'button' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={item.text}
                                    placeholder="Текст кнопки"
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx ? { ...item, text: e.target.value } : it
                                        ),
                                      }))
                                    }
                                    className="bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white"
                                  />
                                  <input
                                    type="text"
                                    value={item.url}
                                    placeholder="https://..."
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx ? { ...item, url: e.target.value } : it
                                        ),
                                      }))
                                    }
                                    className="bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs font-mono text-white"
                                  />
                                </div>
                              )}

                              {item.type === 'grid' && (
                                <textarea
                                  rows={3}
                                  value={item.items.join('\n')}
                                  onChange={(e) =>
                                    updatePhase(pIdx, (p) => ({
                                      ...p,
                                      items: p.items.map((it, k) =>
                                        k === iIdx
                                          ? { ...item, items: e.target.value.split('\n') }
                                          : it
                                      ),
                                    }))
                                  }
                                  placeholder="Каждый пункт с новой строки"
                                  className="w-full bg-[#0F141A] border border-[#344656] rounded px-3 py-2 text-xs text-white"
                                />
                              )}

                              {item.type === 'timer' && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.minutes}
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx
                                            ? { ...item, minutes: Number(e.target.value) || 5 }
                                            : it
                                        ),
                                      }))
                                    }
                                    className="bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs font-mono text-white"
                                  />
                                  <input
                                    type="text"
                                    value={(item.goals || []).join('; ')}
                                    onChange={(e) =>
                                      updatePhase(pIdx, (p) => ({
                                        ...p,
                                        items: p.items.map((it, k) =>
                                          k === iIdx
                                            ? {
                                                ...item,
                                                goals: e.target.value
                                                  .split(';')
                                                  .map((s) => s.trim())
                                                  .filter(Boolean),
                                              }
                                            : it
                                        ),
                                      }))
                                    }
                                    placeholder="Цели через ;"
                                    className="sm:col-span-2 bg-[#0F141A] border border-[#344656] rounded px-3 py-1.5 text-xs text-white"
                                  />
                                </div>
                              )}

                              {(item.type === 'config' || item.type === 'tree') && (
                                <div className="text-[11px] font-mono text-[#8EA0B0]">
                                  Сложный блок ({item.type}) — используйте «Режим JSON» вверху для детальной правки.
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#222D38]">
                          <span className="text-[11px] font-mono text-[#8EA0B0] mr-1">+ Блок:</span>
                          {(
                            [
                              ['text', 'Текст'],
                              ['instruction', 'Инструкция'],
                              ['tip', 'Совет'],
                              ['code', 'Код'],
                              ['grid', 'Список'],
                              ['image', 'Картинка'],
                              ['button', 'Ссылка'],
                              ['timer', 'Таймер'],
                            ] as [LessonItem['type'], string][]
                          ).map(([t, label]) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => addBlockToPhase(pIdx, t)}
                              className="px-2 py-1 rounded border border-[#344656] bg-[#161E27] text-[11px] text-[#D7E0E8] hover:border-[#9ED164] cursor-pointer"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const nextPhase: LessonPhase = {
                          id: `phase_${Date.now()}`,
                          label: `ЭТАП ${String(docDraft.phases.length + 1).padStart(2, '0')}`,
                          header: 'Новый раздел',
                          items: [{ type: 'text', val: 'Описание нового этапа.' }],
                        };
                        const next = { ...docDraft, phases: [...docDraft.phases, nextPhase] };
                        setDocDraft(next);
                        setDocRawJson(JSON.stringify(next, null, 2));
                      }}
                      className="w-full py-2.5 rounded-lg border border-dashed border-[#4A683B] text-xs font-semibold text-[#CBEF9C] hover:bg-[#19261C] cursor-pointer"
                    >
                      + Добавить этап методички
                    </button>
                  </div>
                </>
              )}
            </div>

            {docError && (
              <div className="mx-6 mb-2 p-2.5 rounded border border-[#E06C75]/50 bg-[#2D181B] text-xs text-[#FFB8BE]">
                {docError}
              </div>
            )}

            <div className="px-6 py-4 border-t border-[#24303C] bg-[#131A22] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDocModalName(null)}
                className="px-4 py-2 rounded-lg border border-[#344656] text-xs font-medium text-[#9FB0C0] hover:text-white cursor-pointer"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={handleSaveDoc}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9ED164] text-[#111912] text-xs font-semibold hover:bg-[#B4E07F] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Сохранить методичку</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

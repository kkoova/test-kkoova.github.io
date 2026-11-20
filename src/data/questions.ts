export type QuestionKind =
  | 'choice'
  | 'multi'
  | 'node_pick'
  | 'tree'
  | 'linepick'
  | 'reorder'
  | 'selects'
  | 'match';

export interface NodeOption {
  name: string;
  nodeType: 'Area2D' | 'CharacterBody2D' | 'Sprite2D' | 'CollisionShape2D' | 'RigidBody2D' | 'Node2D';
  hint?: string;
}

export interface SelectField {
  label: string;
  options: string[];
}

export interface Question {
  id: number;
  section: string;
  type: string;
  kind: QuestionKind;
  title: string;
  desc: string;
  context?: string;
  code?: string[];
  options?: [string, string][];
  nodes?: NodeOption[];
  pool?: string[];
  slots?: string[];
  items?: string[];
  fields?: SelectField[];
  pairs?: [string, string][];
  matchOptions?: string[];
  correct:
    | string
    | string[]
    | number
    | { root: string; second?: string; unorderedTail?: string[]; strictOrder?: string[] };
  explanation: string;
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    section: '01. Инициализация сцены',
    type: 'Выбор решения',
    kind: 'choice',
    title: 'С чего начинается сцена управляемого персонажа?',
    desc: 'Ты создаёшь игрового персонажа, которым управляет игрок (через move_and_slide). Персонаж должен иметь физическое тело, форму столкновений и отображать картинку. Какую иерархию узлов выбрать?',
    context: 'Ограничение: персонаж должен корректно взаимодействовать с физикой 2D-мира и стенами.',
    options: [
      ['A', 'Node2D → Sprite2D → CollisionShape2D'],
      ['B', 'CharacterBody2D → CollisionShape2D + Sprite2D'],
      ['C', 'Area2D → Camera2D → Sprite2D'],
      ['D', 'RigidBody2D → TileMapLayer → AnimatedSprite2D'],
    ],
    correct: 'B',
    explanation:
      'Для управляемого персонажа используется CharacterBody2D в корне, а CollisionShape2D и Sprite2D добавляются как его дочерние узлы.',
  },
  {
    id: 2,
    section: '01. Инициализация сцены',
    type: 'Выбор узла',
    kind: 'node_pick',
    title: 'Определи узел по назначению',
    desc: 'Какой узел используют для создания невидимой области-триггера, которая фиксирует вход объектов (например, подбор монеты или зону финиша), но не блокирует их движение физически?',
    nodes: [
      { name: 'Area2D', nodeType: 'Area2D' },
      { name: 'CharacterBody2D', nodeType: 'CharacterBody2D' },
      { name: 'Sprite2D', nodeType: 'Sprite2D' },
      { name: 'CollisionShape2D', nodeType: 'CollisionShape2D' },
    ],
    correct: 'Area2D',
    explanation:
      'Area2D обнаруживает пересечения с телами и другими зонами через сигналы (body_entered, area_entered), не создавая твёрдого препятствия.',
  },
  {
    id: 3,
    section: '01. Инициализация сцены',
    type: 'Дерево сцены',
    kind: 'tree',
    title: 'Собери дерево сцены персонажа',
    desc: 'Распредели узлы по правильной иерархии. Выбери корневой узел и два его дочерних узла.',
    context: 'Корневым узлом должен быть CharacterBody2D, а визуал и форма столкновения — его дочерними узлами.',
    pool: ['CollisionShape2D', 'Sprite2D', 'CharacterBody2D'],
    slots: ['ROOT (корневой узел)', 'CHILD (дочерний узел 1)', 'CHILD (дочерний узел 2)'],
    correct: {
      root: 'CharacterBody2D',
      unorderedTail: ['CollisionShape2D', 'Sprite2D'],
    },
    explanation:
      'Корневым узлом сцены персонажа является CharacterBody2D, а Sprite2D и CollisionShape2D располагаются на одном уровне как его дети.',
  },
  {
    id: 4,
    section: '01. Инициализация сцены',
    type: 'Анализ GDScript',
    kind: 'choice',
    title: 'Какой тип данных нужен для счётчика?',
    desc: 'Скрипт хранит количество собранных монет и увеличивает его на 1 при каждом подборе: coins = coins + 1. Какое объявление переменной корректно?',
    options: [
      ['A', 'var coins: String = 0'],
      ['B', 'var coins: int = 0'],
      ['C', 'const coins = 0'],
      ['D', 'var coins: bool = false'],
    ],
    correct: 'B',
    explanation:
      'Количество монет — это изменяемое целое число, поэтому подходит переменная var coins: int = 0. Константа const не позволяет изменять значение.',
  },
  {
    id: 5,
    section: '01. Инициализация сцены',
    type: 'Поиск ошибки в коде',
    kind: 'linepick',
    title: 'Найди строку, которая ломает падение',
    desc: 'Персонаж должен двигаться по горизонтали и свободно падать вниз под действием гравитации (гравитация уже добавляется к velocity.y ранее). Выбери строку, которая ошибочно сбрасывает вертикальную скорость.',
    code: [
      'extends CharacterBody2D',
      '@export var speed: float = 220.0',
      '',
      'func _physics_process(delta):',
      '    var direction = Input.get_axis("ui_left", "ui_right")',
      '    velocity.x = direction * speed',
      '    velocity.y = 0',
      '    move_and_slide()',
    ],
    context: 'Нажми на строку в редакторе кода, которую нужно убрать или исправить.',
    correct: 7,
    explanation:
      'Строка 7 (velocity.y = 0) каждый физический кадр обнуляет вертикальную скорость, из-за чего персонаж перестаёт падать и прыгать.',
  },
  {
    id: 6,
    section: '01. Инициализация сцены',
    type: 'Выбор решения',
    kind: 'choice',
    title: 'Сигнал зоны или проверка расстояния?',
    desc: 'Дверь должна открываться, когда игрок стоит рядом с ней и нажимает клавишу взаимодействия. Какой способ лучше подходит для определения, что игрок находится в зоне двери?',
    options: [
      ['A', 'Каждый кадр в _process перебирать все объекты на уровне и считать расстояние'],
      ['B', 'Использовать Area2D с сигналом body_entered / body_exited, а нажатие клавиши проверять отдельно'],
      ['C', 'Запустить бесконечный цикл while внутри _ready()'],
      ['D', 'Проверять Input.is_action_just_pressed() один раз внутри _init()'],
    ],
    correct: 'B',
    explanation:
      'Area2D с сигналами body_entered и body_exited оптимально отслеживает нахождение игрока в триггере без лишних расчётов расстояний.',
  },
  {
    id: 7,
    section: '02. Базовые системы',
    type: 'Множественный выбор',
    kind: 'multi',
    title: 'Работа с Input Map в Godot',
    desc: 'Отметь ВСЕ верные утверждения о настройке и использовании карты ввода (Input Map).',
    options: [
      ['A', 'Действия создаются в Project → Project Settings → Input Map'],
      ['B', 'На одно действие можно назначить сразу несколько клавиш (например, A и Стрелка влево)'],
      ['C', 'Имя действия в коде должно точно совпадать с именем, заданным в Input Map'],
      ['D', 'Input Map работает только для кнопок мыши, а клавиатура настраивается в Inspector'],
      ['E', 'Для одиночного срабатывания при нажатии используется Input.is_action_just_pressed()'],
    ],
    correct: ['A', 'B', 'C', 'E'],
    explanation:
      'Input Map объединяет клавиши клавиатуры, мышь и геймпад под общими именами действий. Вариант D неверен.',
  },
  {
    id: 8,
    section: '02. Базовые системы',
    type: 'Порядок выполнения',
    kind: 'reorder',
    title: 'Восстанови жизненный цикл узла',
    desc: 'Расположи стандартные методы жизненного цикла Node в хронологическом порядке — от создания объекта в памяти до его удаления из сцены.',
    items: [
      '_process(delta) — вызывается каждый кадр во время работы сцены',
      '_enter_tree() — узел добавляется в дерево сцены (SceneTree)',
      '_ready() — узел и все его дочерние узлы полностью инициализированы',
      '_exit_tree() — узел покидает дерево сцены перед удалением',
      '_init() — объект создаётся в памяти до добавления в сцену',
    ],
    context: 'Перетаскивай строки или используй стрелки вверх/вниз для сортировки сверху вниз.',
    correct: [
      '_init() — объект создаётся в памяти до добавления в сцену',
      '_enter_tree() — узел добавляется в дерево сцены (SceneTree)',
      '_ready() — узел и все его дочерние узлы полностью инициализированы',
      '_process(delta) — вызывается каждый кадр во время работы сцены',
      '_exit_tree() — узел покидает дерево сцены перед удалением',
    ],
    explanation:
      'Канонический порядок в Godot: _init() при создании объекта → _enter_tree() при входе в дерево → _ready() после готовности детей → _process(delta) в игровом цикле → _exit_tree() при выходе.',
  },
  {
    id: 9,
    section: '02. Базовые системы',
    type: 'Настройка Inspector',
    kind: 'selects',
    title: 'Настрой CollisionShape2D для персонажа',
    desc: 'Персонажу нужна активная прямоугольная форма столкновения. Выбери правильные параметры для узла CollisionShape2D.',
    fields: [
      {
        label: 'Свойство Shape',
        options: ['Не назначено', 'RectangleShape2D', 'CircleShape2D', 'WorldBoundaryShape2D'],
      },
      { label: 'Свойство Disabled', options: ['On', 'Off'] },
      {
        label: 'Узел должен быть дочерним для',
        options: ['Camera2D', 'CharacterBody2D', 'CanvasLayer', 'Timer'],
      },
      {
        label: 'Назначение узла',
        options: [
          'Визуальный эффект',
          'Физическая форма столкновения',
          'Хранение текстуры',
          'Обработка ввода',
        ],
      },
    ],
    correct: ['RectangleShape2D', 'Off', 'CharacterBody2D', 'Физическая форма столкновения'],
    explanation:
      'Для прямоугольной коллизии задаётся RectangleShape2D, флаг Disabled должен быть выключен (Off), а сам узел размещается внутри физического тела (CharacterBody2D).',
  },
  {
    id: 10,
    section: '02. Базовые системы',
    type: 'Результат выполнения',
    kind: 'choice',
    title: 'Что выведет этот код в Output?',
    desc: 'Проследи за изменением переменной health и выбери число, которое будет напечатано.',
    code: ['var health = 10', 'health -= 3', 'health = health * 2', 'print(health)'],
    options: [
      ['A', '7'],
      ['B', '14'],
      ['C', '20'],
      ['D', '13'],
    ],
    correct: 'B',
    explanation: 'Сначала 10 - 3 = 7, затем 7 * 2 = 14.',
  },
  {
    id: 11,
    section: '02. Базовые системы',
    type: 'Выбор узла',
    kind: 'node_pick',
    title: 'Узел для отображения 2D-текстуры',
    desc: 'Какой узел используется для простого вывода статического 2D-изображения (текстуры) в игровом мире без встроенной покадровой анимации и без собственной физики?',
    nodes: [
      { name: 'Sprite2D', nodeType: 'Sprite2D' },
      { name: 'Area2D', nodeType: 'Area2D' },
      { name: 'RigidBody2D', nodeType: 'RigidBody2D' },
      { name: 'Node2D', nodeType: 'Node2D' },
    ],
    correct: 'Sprite2D',
    explanation: 'Sprite2D предназначен специально для отрисовки 2D-текстур в сцене.',
  },
  {
    id: 12,
    section: '02. Базовые системы',
    type: 'Дерево сцены',
    kind: 'tree',
    title: 'Собери структуру игрового HUD',
    desc: 'Построй иерархию интерфейса: экранный слой должен оставаться поверх камеры, внутри него должен лежать вертикальный контейнер, а в контейнере — два элемента интерфейса.',
    context: 'Элементы внутри VBoxContainer (шкала здоровья и счётчик монет) являются равноправными дочерними узлами.',
    pool: ['CanvasLayer', 'VBoxContainer', 'HealthBar (ProgressBar)', 'CoinsLabel (Label)'],
    slots: [
      'ROOT (экранный слой поверх камеры)',
      'CHILD (вертикальный контейнер)',
      'CHILD контейнера (элемент HUD 1)',
      'CHILD контейнера (элемент HUD 2)',
    ],
    correct: {
      root: 'CanvasLayer',
      second: 'VBoxContainer',
      unorderedTail: ['HealthBar (ProgressBar)', 'CoinsLabel (Label)'],
    },
    explanation:
      'CanvasLayer фиксирует интерфейс в координатах экрана, VBoxContainer выстраивает вложенные элементы столбцом, а ProgressBar и Label лежат внутри контейнера.',
  },
  {
    id: 13,
    section: '02. Базовые системы',
    type: 'Выбор решения',
    kind: 'choice',
    title: 'Физический узел для падающего камня',
    desc: 'На камень должна автоматически действовать гравитация, он должен сталкиваться с землёй, катиться и отскакивать по законам физики без ручного расчёта траектории.',
    options: [
      ['A', 'StaticBody2D'],
      ['B', 'Area2D'],
      ['C', 'RigidBody2D'],
      ['D', 'Node2D'],
    ],
    correct: 'C',
    explanation:
      'RigidBody2D полностью моделируется физическим движком (гравитация, масса, трение, отскок). StaticBody2D не двигается, а Area2D не имеет твёрдых столкновений.',
  },
  {
    id: 14,
    section: '03. Диагностика и отладка',
    type: 'Анализ цикла',
    kind: 'choice',
    title: 'Что выведет цикл for?',
    desc: 'Проанализируй работу цикла range(4) и определи итоговое значение переменной total, которое появится в консоли.',
    code: ['var total = 0', 'for i in range(4):', '    total += i', 'print(total)'],
    options: [
      ['A', '4'],
      ['B', '6'],
      ['C', '10'],
      ['D', '3'],
    ],
    correct: 'B',
    explanation: 'range(4) генерирует значения 0, 1, 2, 3. Их сумма: 0 + 1 + 2 + 3 = 6.',
  },
  {
    id: 15,
    section: '03. Диагностика и отладка',
    type: 'Сопоставление',
    kind: 'match',
    title: 'Соедини сигналы и свойства Area2D с их ролью',
    desc: 'Для каждого элемента API выбери точное описание его работы в Godot.',
    pairs: [
      ['body_entered', 'Срабатывает, когда физическое тело входит в Area2D'],
      ['area_exited', 'Срабатывает, когда другая Area2D покидает область'],
      ['queue_free()', 'Удаляет узел безопасно в конце текущего кадра'],
      ['monitoring', 'Включает или отключает обнаружение пересечений'],
    ],
    matchOptions: [
      'Удаляет узел безопасно в конце текущего кадра',
      'Включает или отключает обнаружение пересечений',
      'Срабатывает, когда физическое тело входит в Area2D',
      'Срабатывает, когда другая Area2D покидает область',
    ],
    correct: [
      'Срабатывает, когда физическое тело входит в Area2D',
      'Срабатывает, когда другая Area2D покидает область',
      'Удаляет узел безопасно в конце текущего кадра',
      'Включает или отключает обнаружение пересечений',
    ],
    explanation:
      'body_entered реагирует на физические тела (CharacterBody2D/RigidBody2D), area_exited — на выход другой Area2D, monitoring управляет активностью зоны, а queue_free() безопасно удаляет узел.',
  },
  {
    id: 16,
    section: '03. Диагностика и отладка',
    type: 'Поиск ошибки в коде',
    kind: 'linepick',
    title: 'Почему сцену снаряда нельзя выбрать в Inspector?',
    desc: 'Программист хочет назначать сцену снаряда через панель Inspector прямо в редакторе, но поле не появляется. Выбери строку, которую нужно заменить на @export var projectile_scene: PackedScene.',
    code: [
      'extends Node2D',
      '',
      'var projectile_scene = preload("res://projectile.tscn")',
      '@export var damage: int = 10',
      '',
      'func shoot():',
      '    var projectile = projectile_scene.instantiate()',
      '    get_tree().current_scene.add_child(projectile)',
    ],
    context: 'Нажми на строку с жёстко заданным путём к сцене.',
    correct: 3,
    explanation:
      'В строке 3 переменная объявлена без @export и жёстко привязана к preload("res://projectile.tscn"), поэтому её нельзя переопределить через Inspector.',
  },
  {
    id: 17,
    section: '03. Диагностика и отладка',
    type: 'Множественный выбор',
    kind: 'multi',
    title: 'Возможности базового узла Node2D',
    desc: 'Отметь ВСЕ верные утверждения о базовом 2D-узле Node2D.',
    options: [
      ['A', 'Имеет позицию (position), вращение (rotation) и масштаб (scale) в 2D-пространстве'],
      ['B', 'Может служить родительским узлом для группировки нескольких Sprite2D'],
      ['C', 'Сам по себе автоматически обнаруживает физические столкновения'],
      ['D', 'Поддерживает свойства transform и global_position'],
      ['E', 'Является обязательным корнем абсолютно каждой сцены в Godot (включая UI)'],
    ],
    correct: ['A', 'B', 'D'],
    explanation:
      'Node2D даёт базовую 2D-трансформацию и группировку, но не имеет физики (C неверно), а для UI используются узлы Control (E неверно).',
  },
  {
    id: 18,
    section: '03. Диагностика и отладка',
    type: 'Настройка кода',
    kind: 'selects',
    title: 'Создание объекта из PackedScene',
    desc: 'В скрипте есть ссылка на заранее загруженную сцену. Выбери правильные методы и тип ресурса для спавна объекта в дерево сцены.',
    fields: [
      {
        label: 'Создать экземпляр сцены',
        options: ['load()', 'instantiate()', 'queue_free()', 'emit_signal()'],
      },
      {
        label: 'Добавить созданный узел в дерево',
        options: ['add_child()', 'remove_child()', 'move_and_slide()', 'look_at()'],
      },
      {
        label: 'Тип ресурса сохранённой сцены',
        options: ['PackedScene', 'Texture2D', 'AudioStream', 'Font'],
      },
    ],
    correct: ['instantiate()', 'add_child()', 'PackedScene'],
    explanation:
      'Сцена хранится как ресурс типа PackedScene. Метод instantiate() создаёт её копию в памяти, а add_child() добавляет узел в текущее дерево сцены.',
  },
  {
    id: 19,
    section: '03. Диагностика и отладка',
    type: 'Порядок строк кода',
    kind: 'reorder',
    title: 'Собери рабочий обработчик движения',
    desc: 'Расставь строки GDScript в правильном порядке, чтобы персонаж считывал ввод и перемещался в физическом цикле.',
    items: [
      '    move_and_slide()',
      'func _physics_process(delta):',
      '    var direction = Input.get_axis("ui_left", "ui_right")',
      '    velocity.x = direction * speed',
    ],
    context: 'Начни с объявления функции, затем получи направление, задай скорость и примени движение.',
    correct: [
      'func _physics_process(delta):',
      '    var direction = Input.get_axis("ui_left", "ui_right")',
      '    velocity.x = direction * speed',
      '    move_and_slide()',
    ],
    explanation:
      'Внутри _physics_process сначала вычисляется direction, затем устанавливается velocity.x, и только после этого вызывается move_and_slide().',
  },
  {
    id: 20,
    section: '03. Диагностика и отладка',
    type: 'Выбор решения',
    kind: 'choice',
    title: 'Как сохранить счёт при смене уровней?',
    desc: 'В игре несколько уровней (отдельных сцен). Общее количество собранных монет должно сохраняться при переходе с уровня на уровень. Какое решение в Godot подходит лучше всего?',
    options: [
      ['A', 'Создать глобальный скрипт через Project Settings → Autoload и хранить счёт в нём'],
      ['B', 'Объявить одинаковую обычную переменную в скрипте каждого уровня'],
      ['C', 'Хранить счёт только внутри локальной переменной функции _ready()'],
      ['D', 'Создать отдельный Sprite2D и записывать число монет в его угол поворота rotation'],
    ],
    correct: 'A',
    explanation:
      'Autoload (синглтон) существует на протяжении всей работы игры и не удаляется при смене сцен через change_scene_to_file().',
  },
  {
    id: 21,
    section: '04. Финальная проверка',
    type: 'Анализ условий',
    kind: 'choice',
    title: 'Составь условие открытия сундука',
    desc: 'Игрок может открыть сундук только при одновременном выполнении двух условий: у него есть ключ (has_key == true) И его здоровье строго больше нуля. Какая запись верна?',
    code: ['var has_key: bool = true', 'var health: int = 50', '', '# Какое условие подставить вместо <?> ?', 'if <?>:', '    open_chest()'],
    options: [
      ['A', 'if has_key or health > 0:'],
      ['B', 'if has_key and health > 0:'],
      ['C', 'if not has_key and health > 0:'],
      ['D', 'if has_key == health:'],
    ],
    correct: 'B',
    explanation:
      'Для одновременного выполнения обоих условий используется логический оператор and: has_key and health > 0.',
  },
  {
    id: 22,
    section: '04. Финальная проверка',
    type: 'Настройка физики',
    kind: 'selects',
    title: 'Настрой обнаружение предмета игроком',
    desc: 'Игрок должен свободно проходить сквозь монету и при этом собирать её. Выбери правильную конфигурацию узлов и слоёв.',
    fields: [
      {
        label: 'Игрок: тип корневого узла',
        options: ['CharacterBody2D', 'Area2D', 'StaticBody2D', 'Control'],
      },
      {
        label: 'Монета: тип корневого узла',
        options: ['Area2D', 'CharacterBody2D', 'Camera2D', 'CanvasLayer'],
      },
      {
        label: 'На каких слоях монета ищет игрока',
        options: ['Collision Mask', 'Z Index', 'Texture Filter', 'Anchor'],
      },
      {
        label: 'Сигнал монеты при касании игроком',
        options: ['body_entered', 'pressed', 'timeout', 'draw'],
      },
    ],
    correct: ['CharacterBody2D', 'Area2D', 'Collision Mask', 'body_entered'],
    explanation:
      'Игрок — CharacterBody2D, монета — Area2D. Collision Mask у Area2D определяет, слои каких объектов она сканирует, а сигнал body_entered срабатывает при входе тела.',
  },
  {
    id: 23,
    section: '04. Финальная проверка',
    type: 'Выбор архитектуры',
    kind: 'choice',
    title: 'Как правильно реализовать паузу в игре?',
    desc: 'При нажатии Esc игра должна останавливаться, а меню паузы должно оставаться интерактивным поверх уровня. Какой подход правильный в Godot?',
    options: [
      ['A', 'Поставить паузу через get_tree().paused = true и задать меню паузы Process Mode = Always (или When Paused)'],
      ['B', 'Добавить скрипт с проверкой паузы внутрь каждого Sprite2D на уровне'],
      ['C', 'Заморозить игру с помощью бесконечного цикла while true: pass'],
      ['D', 'Удалить текущую сцену через queue_free(), а при снятии паузы загружать уровень заново'],
    ],
    correct: 'A',
    explanation:
      'get_tree().paused = true останавливает игровой мир, а Process Mode = Always позволяет меню паузы продолжать принимать клики и нажатие Esc.',
  },
  {
    id: 24,
    section: '04. Финальная проверка',
    type: 'Поиск ошибки в коде',
    kind: 'linepick',
    title: 'Почему кнопка срабатывает сразу при запуске, а не по клику?',
    desc: 'Кнопка StartButton должна запускать игру только при нажатии на неё, но переход на сцену происходит мгновенно в момент загрузки меню. Найди строку с ошибкой подключения сигнала.',
    code: [
      'extends Control',
      '',
      'func _ready():',
      '    $StartButton.pressed.connect(start_game())',
      '',
      'func start_game():',
      '    get_tree().change_scene_to_file("res://game.tscn")',
    ],
    context: 'Обрати внимание на синтаксис передачи функции в метод connect() в GDScript 4.',
    correct: 4,
    explanation:
      'В строке 4 написаны лишние скобки у start_game(). Из-за этого функция вызывается сразу в _ready(), а в connect() нужно передавать ссылку Callable без скобок: connect(start_game).',
  },
  {
    id: 25,
    section: '04. Финальная проверка',
    type: 'Множественный выбор',
    kind: 'multi',
    title: 'Инструменты отладки в Godot',
    desc: 'Во время запуска сцена ведёт себя неожиданно. Какие действия реально помогают найти причину ошибки? Отметь ВСЕ верные варианты.',
    options: [
      ['A', 'Выводить значения ключевых переменных в консоль с помощью print()'],
      ['B', 'Изучать вкладку Debugger → Errors / Stack Trace'],
      ['C', 'Открывать Remote Scene Tree во время запущенной игры и проверять текущие узлы'],
      ['D', 'Удалить все сигналы в проекте, чтобы скрыть предупреждения'],
      ['E', 'Проверять правильность путей к ресурсам (res://...) и точные имена узлов ($NodeName)'],
    ],
    correct: ['A', 'B', 'C', 'E'],
    explanation:
      'print(), Debugger, Remote Scene Tree и проверка путей/имён — основные рабочие инструменты отладки в Godot.',
  },
  {
    id: 26,
    section: '04. Финальная проверка',
    type: 'Сопоставление',
    kind: 'match',
    title: 'Выбери подходящий инструмент для задачи',
    desc: 'Сопоставь каждую задачу разработки с подходящим узлом или классом Godot.',
    pairs: [
      ['Отобразить текстовый счётчик на экране', 'Label'],
      ['Отсчитать задержку перед перезарядкой без счётчика в _process', 'Timer'],
      ['Автоматически выстроить элементы интерфейса в ряд или столбец', 'Container'],
      ['Загрузить и создать копию префаба/сцены во время игры', 'PackedScene'],
    ],
    matchOptions: ['PackedScene', 'Label', 'Container', 'Timer'],
    correct: ['Label', 'Timer', 'Container', 'PackedScene'],
    explanation:
      'Label выводит текст, Timer отсчитывает время и шлёт сигнал timeout, Container управляет компоновкой UI, а PackedScene хранит шаблон сцены.',
  },
  {
    id: 27,
    section: '04. Финальная проверка',
    type: 'Комплексная диагностика',
    kind: 'multi',
    title: 'Финальный инцидент: монета не подбирается',
    desc: 'Монета видна на экране, но игрок проходит сквозь неё и функция подбора не срабатывает. Какие проверки логично выполнить в первую очередь?',
    context: 'Сцена монеты: Area2D (root) → Sprite2D + CollisionShape2D. Игрок: CharacterBody2D. Подключён сигнал body_entered.',
    options: [
      ['A', 'Проверить, что у CollisionShape2D монеты назначена Shape и не включён флаг Disabled'],
      ['B', 'Проверить пересечение Collision Mask монеты и Collision Layer игрока'],
      ['C', 'Убедиться, что сигнал body_entered реально подключён к методу-обработчику в скрипте'],
      ['D', 'Перекрасить текстуру Sprite2D в красный цвет'],
      ['E', 'Проверить, что у Area2D включено свойство Monitoring = true'],
    ],
    correct: ['A', 'B', 'C', 'E'],
    explanation:
      'Цвет спрайта (D) никак не влияет на физику. Все остальные пункты (форма коллизии, слои/маски, подключение сигнала, флаг Monitoring) — реальные причины, почему Area2D не срабатывает.',
  },
];

export type UserAnswerValue =
  | string
  | string[]
  | number
  | Record<number, string>;

export interface GradedQuestionResult {
  questionId: number;
  title: string;
  section: string;
  type: string;
  isCorrect: boolean;
  userAnswerFormatted: string;
  correctAnswerFormatted: string;
  explanation: string;
}

export interface SectionSummary {
  section: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface TestGradeResult {
  score: number;
  total: number;
  percentage: number;
  gradeLabel: string;
  passed: boolean;
  sectionBreakdown: SectionSummary[];
  details: GradedQuestionResult[];
}

function formatTreeAnswer(slots: string[] | undefined, map: Record<number, string> | undefined): string {
  if (!map || !slots) return 'Нет ответа';
  return slots.map((s, idx) => `${s}: ${map[idx] || '—'}`).join(' | ');
}

function formatCorrectTree(q: Question): string {
  if (typeof q.correct !== 'object' || Array.isArray(q.correct)) return '';
  const c = q.correct;
  const parts: string[] = [`ROOT: ${c.root}`];
  if (c.second) parts.push(`CHILD: ${c.second}`);
  if (c.unorderedTail && c.unorderedTail.length > 0) {
    parts.push(`Дочерние: ${c.unorderedTail.join(', ')}`);
  }
  return parts.join(' → ');
}

export function gradeQuestion(q: Question, userAnswer: UserAnswerValue | undefined): GradedQuestionResult {
  let isCorrect = false;
  let userAnswerFormatted = 'Нет ответа';
  let correctAnswerFormatted = '';

  if (q.kind === 'choice') {
    const chosen = typeof userAnswer === 'string' ? userAnswer : '';
    const optMap = new Map(q.options || []);
    userAnswerFormatted = chosen ? `${chosen}) ${optMap.get(chosen) ?? chosen}` : 'Нет ответа';
    const corrKey = String(q.correct);
    correctAnswerFormatted = `${corrKey}) ${optMap.get(corrKey) ?? corrKey}`;
    isCorrect = chosen === corrKey;
  } else if (q.kind === 'node_pick') {
    const chosen = typeof userAnswer === 'string' ? userAnswer : '';
    userAnswerFormatted = chosen || 'Нет ответа';
    correctAnswerFormatted = String(q.correct);
    isCorrect = chosen === String(q.correct);
  } else if (q.kind === 'linepick') {
    const chosenLine = typeof userAnswer === 'number' ? userAnswer : 0;
    const codeLines = q.code || [];
    userAnswerFormatted = chosenLine
      ? `Строка ${chosenLine}: ${codeLines[chosenLine - 1]?.trim() || ''}`
      : 'Нет ответа';
    const corrLine = Number(q.correct);
    correctAnswerFormatted = `Строка ${corrLine}: ${codeLines[corrLine - 1]?.trim() || ''}`;
    isCorrect = chosenLine === corrLine;
  } else if (q.kind === 'multi') {
    const chosenArr = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
    const corrArr = Array.isArray(q.correct) ? [...q.correct].sort() : [];
    const optMap = new Map(q.options || []);
    userAnswerFormatted =
      chosenArr.length > 0
        ? chosenArr.map((k) => `${k}) ${optMap.get(k) ?? k}`).join('; ')
        : 'Нет ответа';
    correctAnswerFormatted = corrArr.map((k) => `${k}) ${optMap.get(k) ?? k}`).join('; ');
    isCorrect =
      chosenArr.length === corrArr.length && chosenArr.every((val, i) => val === corrArr[i]);
  } else if (q.kind === 'reorder') {
    const chosenArr = Array.isArray(userAnswer) ? userAnswer : [];
    const corrArr = Array.isArray(q.correct) ? q.correct : [];
    userAnswerFormatted =
      chosenArr.length > 0 ? chosenArr.map((s, i) => `${i + 1}. ${s.trim()}`).join(' → ') : 'Нет ответа';
    correctAnswerFormatted = corrArr.map((s, i) => `${i + 1}. ${s.trim()}`).join(' → ');
    isCorrect =
      chosenArr.length === corrArr.length && chosenArr.every((val, i) => val === corrArr[i]);
  } else if (q.kind === 'selects') {
    const chosenArr = Array.isArray(userAnswer) ? userAnswer : [];
    const corrArr = Array.isArray(q.correct) ? q.correct : [];
    const fields = q.fields || [];
    userAnswerFormatted =
      chosenArr.length > 0
        ? fields.map((f, i) => `${f.label}: ${chosenArr[i] || '—'}`).join(' | ')
        : 'Нет ответа';
    correctAnswerFormatted = fields.map((f, i) => `${f.label}: ${corrArr[i]}`).join(' | ');
    isCorrect =
      chosenArr.length === corrArr.length && chosenArr.every((val, i) => val === corrArr[i]);
  } else if (q.kind === 'match') {
    const chosenArr = Array.isArray(userAnswer) ? userAnswer : [];
    const corrArr = Array.isArray(q.correct) ? q.correct : [];
    const pairs = q.pairs || [];
    userAnswerFormatted =
      chosenArr.length > 0
        ? pairs.map((p, i) => `${p[0]} → ${chosenArr[i] || '—'}`).join(' | ')
        : 'Нет ответа';
    correctAnswerFormatted = pairs.map((p, i) => `${p[0]} → ${corrArr[i]}`).join(' | ');
    isCorrect =
      chosenArr.length === corrArr.length && chosenArr.every((val, i) => val === corrArr[i]);
  } else if (q.kind === 'tree') {
    const slotMap =
      userAnswer && typeof userAnswer === 'object' && !Array.isArray(userAnswer)
        ? (userAnswer as Record<number, string>)
        : undefined;
    userAnswerFormatted = formatTreeAnswer(q.slots, slotMap);
    correctAnswerFormatted = formatCorrectTree(q);

    if (slotMap && typeof q.correct === 'object' && !Array.isArray(q.correct)) {
      const c = q.correct;
      const slotsLen = q.slots?.length || 0;
      const slot0Match = slotMap[0] === c.root;
      if (c.second) {
        const slot1Match = slotMap[1] === c.second;
        const tailActual = [slotMap[2], slotMap[3]].filter(Boolean).sort();
        const tailExpected = [...(c.unorderedTail || [])].sort();
        isCorrect =
          slotsLen === 4 &&
          slot0Match &&
          slot1Match &&
          tailActual.length === tailExpected.length &&
          tailActual.every((v, i) => v === tailExpected[i]);
      } else if (c.unorderedTail) {
        const tailActual: string[] = [];
        for (let i = 1; i < slotsLen; i++) {
          if (slotMap[i]) tailActual.push(slotMap[i]);
        }
        tailActual.sort();
        const tailExpected = [...c.unorderedTail].sort();
        isCorrect =
          slot0Match &&
          tailActual.length === tailExpected.length &&
          tailActual.every((v, i) => v === tailExpected[i]);
      }
    }
  }

  return {
    questionId: q.id,
    title: q.title,
    section: q.section,
    type: q.type,
    isCorrect,
    userAnswerFormatted,
    correctAnswerFormatted,
    explanation: q.explanation,
  };
}

export function gradeTest(
  questions: Question[],
  answers: Record<number, UserAnswerValue>
): TestGradeResult {
  const details = questions.map((q) => gradeQuestion(q, answers[q.id]));
  const score = details.filter((d) => d.isCorrect).length;
  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  let gradeLabel = 'Не зачтено';
  if (percentage >= 85) gradeLabel = 'Отлично (5)';
  else if (percentage >= 70) gradeLabel = 'Хорошо (4)';
  else if (percentage >= 50) gradeLabel = 'Удовлетворительно (3)';

  const sectionOrder = Array.from(new Set(questions.map((q) => q.section)));
  const sectionBreakdown: SectionSummary[] = sectionOrder.map((sec) => {
    const secItems = details.filter((d) => d.section === sec);
    const secCorrect = secItems.filter((d) => d.isCorrect).length;
    return {
      section: sec,
      correct: secCorrect,
      total: secItems.length,
      percentage: secItems.length > 0 ? Math.round((secCorrect / secItems.length) * 100) : 0,
    };
  });

  return {
    score,
    total,
    percentage,
    gradeLabel,
    passed: percentage >= 50,
    sectionBreakdown,
    details,
  };
}

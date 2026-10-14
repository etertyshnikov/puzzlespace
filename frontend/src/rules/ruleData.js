export const FIELD_GROUPS = [
  {
    id: 'specification',
    label: 'Спецификация',
    fields: [
      { name: 'length_m', label: 'Длина, м', type: 'number' },
      { name: 'width_m', label: 'Ширина, м', type: 'number' },
      { name: 'floors', label: 'Этажность', type: 'number' },
      { name: 'terrace_length_m', label: 'Длина террасы, м', type: 'number' },
      { name: 'balcony_length_m', label: 'Длина балкона, м', type: 'number' },
      { name: 'wall_height_m', label: 'Высота стен, м', type: 'number' },
      { name: 'double_timber', label: 'Двойной брус', type: 'boolean' },
      { name: 'terrace_second_floor', label: 'Терраса на 2 этаже', type: 'boolean' },
      { name: 'rooms_count', label: 'Число комнат', type: 'number' },
      { name: 'building_type', label: 'Тип здания', type: 'text' },
      { name: 'perimeter', label: 'Периметр', type: 'number' },
      { name: 'area', label: 'Площадь', type: 'number' },
      { name: 'qty_multiplier', label: 'Множитель μ', type: 'number' },
      { name: 'qty_use_floors', label: 'Учитывать этажность', type: 'boolean' },
    ],
  },
  {
    id: 'item',
    label: 'Позиция спецификации',
    fields: [
      { name: 'quantity', label: 'Количество', type: 'number' },
      { name: 'quantity_auto', label: 'Кол-во авто', type: 'number' },
      { name: 'quantity_manual', label: 'Кол-во вручную', type: 'number' },
      { name: 'price', label: 'Цена', type: 'number' },
      { name: 'discount_percent', label: 'Скидка, %', type: 'number' },
      { name: 'total', label: 'Сумма', type: 'number' },
      { name: 'qty_basis', label: 'Правило qty_basis', type: 'text' },
    ],
  },
  {
    id: 'nomenclature',
    label: 'Номенклатура',
    fields: [
      { name: 'nomenclature.name', label: 'Наименование', type: 'text' },
      { name: 'nomenclature.unit', label: 'Ед. изм.', type: 'text' },
      { name: 'nomenclature.price', label: 'Базовая цена', type: 'number' },
      { name: 'part_id', label: 'Часть дома', type: 'number' },
    ],
  },
]

export const OPERATORS = [
  '(', ')', '"', '&', '¶',
  '+', '-', '*', '/', '^',
  '=', '≠', '>', '<', '≥', '≤',
  'not', 'and', 'or', 'xor',
]

export const FUNCTIONS = [
  { name: 'Abs', signature: 'Abs ( number )', description: 'Абсолютное значение числа.' },
  { name: 'Round', signature: 'Round ( number ; precision )', description: 'Округление до заданной точности.' },
  { name: 'Ceiling', signature: 'Ceiling ( number )', description: 'Округление вверх до целого.' },
  { name: 'Floor', signature: 'Floor ( number )', description: 'Округление вниз до целого.' },
  { name: 'Min', signature: 'Min ( a ; b {; c…} )', description: 'Минимум из аргументов.' },
  { name: 'Max', signature: 'Max ( a ; b {; c…} )', description: 'Максимум из аргументов.' },
  { name: 'If', signature: 'If ( test ; result1 ; result2 )', description: 'Если условие истинно — result1, иначе result2.' },
  { name: 'Case', signature: 'Case ( test1 ; result1 {; test2 ; result2…} )', description: 'Цепочка условий.' },
  { name: 'IsEmpty', signature: 'IsEmpty ( field )', description: 'Пустое ли значение.' },
  { name: 'Perimeter', signature: 'Perimeter ( length_m ; width_m )', description: 'Периметр основания 2×(L+W).' },
  { name: 'Area', signature: 'Area ( length_m ; width_m )', description: 'Площадь основания L×W.' },
  { name: 'FloorLot', signature: 'FloorLot ( floors )', description: 'Множитель этажности max(1, floors).' },
  { name: 'TerraceArea', signature: 'TerraceArea ( terrace_length_m ; width_m )', description: 'Площадь террасы Lt×W.' },
]

export const STEP_CATEGORIES = [
  {
    id: 'favorites',
    label: 'Избранное',
    steps: [
      { id: 'set-field', label: 'Установить поле', description: 'Записать результат формулы в поле позиции.' },
      { id: 'set-variable', label: 'Установить переменную', description: 'Сохранить промежуточное значение.' },
    ],
  },
  {
    id: 'control',
    label: 'Управление',
    steps: [
      { id: 'if', label: 'Если', description: 'Условное выполнение шагов.' },
      { id: 'else', label: 'Иначе', description: 'Ветка при ложном условии.' },
      { id: 'endif', label: 'Конец если', description: 'Закрывает блок Если/Иначе.' },
      { id: 'loop', label: 'Цикл', description: 'Повтор шагов по счётчику.' },
      { id: 'exit-loop', label: 'Выйти из цикла если', description: 'Прерывание цикла по условию.' },
      { id: 'call-rule', label: 'Вызвать правило', description: 'Выполнить другое правило расчёта.' },
      { id: 'set-variable', label: 'Установить переменную', description: 'Сохранить промежуточное значение.' },
    ],
  },
  {
    id: 'calc',
    label: 'Расчёт',
    steps: [
      { id: 'formula-qty', label: 'Формула количества', description: 'Вычислить quantity_auto по формуле.' },
      { id: 'perimeter', label: 'Периметр', description: '2×(length_m + width_m) с множителями.' },
      { id: 'area', label: 'Площадь', description: 'length_m × width_m с множителями.' },
      { id: 'multiply', label: 'Умножить', description: 'Умножить переменную на коэффициент.' },
      { id: 'min-max', label: 'Мин / Макс', description: 'Ограничить результат снизу или сверху.' },
      { id: 'link-item', label: 'Связать с позицией', description: 'Взять количество из другой строки spec.' },
    ],
  },
  {
    id: 'fields',
    label: 'Поля',
    steps: [
      { id: 'read-spec', label: 'Прочитать поле spec', description: 'Загрузить габарит или флаг спецификации.' },
      { id: 'read-item', label: 'Прочитать поле позиции', description: 'Загрузить поле строки спецификации.' },
      { id: 'write-item', label: 'Записать в позицию', description: 'Сохранить quantity_auto или calc_error.' },
    ],
  },
  {
    id: 'records',
    label: 'Записи',
    steps: [
      { id: 'find-items', label: 'Найти позиции', description: 'Отбор строк spec по part_id или тегу.' },
      { id: 'recalc', label: 'Пересчитать', description: 'Запустить пересчёт затронутых строк.' },
    ],
  },
]

export const DEFAULT_RULES = [
  {
    id: 'rule-perimeter',
    name: 'Периметр основания',
    steps: [
      { id: 's1', type: 'set-variable', label: 'Установить переменную', formula: 'Perimeter ( specification::length_m ; specification::width_m )' },
      { id: 's2', type: 'formula-qty', label: 'Формула количества', formula: '$perimeter * specification::qty_multiplier * FloorLot ( specification::floors )' },
    ],
  },
  {
    id: 'rule-area',
    name: 'Площадь пола',
    steps: [
      { id: 's1', type: 'formula-qty', label: 'Формула количества', formula: 'Area ( specification::length_m ; specification::width_m ) * specification::qty_multiplier' },
    ],
  },
  {
    id: 'rule-new',
    name: 'Новое правило',
    steps: [],
  },
]

export function fieldRef(groupId, fieldName) {
  const group = FIELD_GROUPS.find((g) => g.id === groupId)
  const field = group?.fields.find((f) => f.name === fieldName)
  return field ? `${group.label}::${field.label}` : fieldName
}

export function insertAtCursor(text, insertion, start, end) {
  const before = text.slice(0, start)
  const after = text.slice(end)
  const next = before + insertion + after
  const pos = before.length + insertion.length
  return { text: next, selectionStart: pos, selectionEnd: pos }
}

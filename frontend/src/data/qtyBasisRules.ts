/** Справочник правил расчёта количества в позициях шаблона дома (qty_basis). */

/** Высота для площади стен, м (обозначение k). */
export const QTY_BASIS_WALL_HEIGHT_K_M = 2.8

/** Обозначения в формулах правил. */
export const QTY_BASIS_NOTATION: { symbol: string; meaning: string }[] = [
  { symbol: 'L', meaning: 'длина дома, м (спецификация)' },
  { symbol: 'W', meaning: 'ширина дома, м' },
  { symbol: 'Lt', meaning: 'длина террасы, м' },
  { symbol: 'Lbalk', meaning: 'длина балкона, м' },
  { symbol: 'lot', meaning: 'этажность (число этажей из спецификации)' },
  { symbol: 'C', meaning: 'количество комнат (общее, из спецификации)' },
  { symbol: 'St', meaning: 'площадь террасы, м²: St = Lt × W' },
  { symbol: 'Pt', meaning: 'периметр террасы, м: Pt = 2×(Lt + W)' },
  { symbol: 'Ld', meaning: 'длина домокомплекта, м: Ld = L − Lt' },
  { symbol: 'Wd', meaning: 'ширина домокомплекта, м: Wd = W' },
  { symbol: 'Sdp', meaning: 'площадь домокомплекта по полу за этаж, м²: Sdp = Ld × Wd' },
  { symbol: 'Pd', meaning: 'периметр домокомплекта, м: Pd = 2×(Ld + Wd)' },
  { symbol: 'Sds', meaning: 'площадь стен домокомплекта, м²: Sds = Pd × k × Tb × lot' },
  { symbol: 'Lst', meaning: 'длина контура для стен комнат, м: Lst = 2×(L+W)' },
  { symbol: 'Sst', meaning: 'площадь стен комнат, м²: Sst = Lst × k × Cr × Tb' },
  { symbol: 'k', meaning: 'высота дома, м (поле в спецификации; по умолчанию 2,7)' },
  { symbol: 'Cr', meaning: 'коэф. по C: 1→0; 2→0,16; 3→0,32; 4→0,48; 5+→0,65' },
  { symbol: 'Tb', meaning: '2 при «двойном брусе», иначе 1' },
  { symbol: 'μ', meaning: 'множитель из шаблона позиции (поле qty_multiplier); по умолчанию 1' },
]

export type QtyBasisRuleInfo = {
  id: string
  title: string
  formula: string
  description: string
  useFloors: boolean | 'optional' | 'never'
  manualQty: boolean
  specFields: string[]
}

export const QTY_BASIS_RULES: QtyBasisRuleInfo[] = [
  {
    id: 'fixed',
    title: 'Фиксированное',
    formula: 'Количество из поля «Количество» в шаблоне',
    description:
      'Число задаётся вручную в шаблоне позиции и не пересчитывается при смене габаритов дома в спецификации. В спецификации можно переопределить количество в колонке «Вручную».',
    useFloors: 'never',
    manualQty: true,
    specFields: [],
  },
  {
    id: 'perimeter',
    title: 'Периметр основания',
    formula: '2×(L+W) × (lot или 1)',
    description:
      'Периметр прямоугольника по длине и ширине дома. При включённой опции «Учитывать этажность» умножается на lot (минимум 1).',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Этажность'],
  },
  {
    id: 'perimeter_x2_double_timber',
    title: 'Периметр ×2 при двойном брусе',
    formula: '2×(L+W) × Tb × (lot или 1)',
    description:
      'Как периметр основания, но при «Двойной брус» ×Tb (Tb=2), иначе Tb=1. Этажность lot — по галочке в шаблоне.',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Этажность', 'Двойной брус'],
  },
  {
    id: 'perimeter_rooms_kit',
    title: 'Домокомплект с учётом комнат',
    formula: '2×(L+W) × lot × (1+Cr или Tb+Cr)',
    description:
      'Периметр × lot (если включено) × (1+Cr) без двойного бруса или × (Tb+Cr) с двойным брусом. Cr от C: 1→0; 2→0,16; 3→0,32; 4→0,48; 5+→0,65.',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Этажность', 'Комнат', 'Двойной брус'],
  },
  {
    id: 'kit_perimeter_rooms_kit',
    title: 'Домокомплект с учётом комнат (по габаритам домокомплекта)',
    formula: 'Pd × lot × (1+Cr или Tb+Cr)',
    description:
      'Pd = 2×(Ld+Wd), Ld = L−Lt, Wd = W. Без двойного бруса: (1+Cr), с двойным: (Tb+Cr). lot — по галочке «Учитывать этажность».',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Длина террасы', 'Этажность', 'Комнат', 'Двойной брус'],
  },
  {
    id: 'linked_wall_kit_qty',
    title: 'Сборка домокомплекта',
    formula: 'Итоговое кол-во 3-й позиции шаблона дома',
    description:
      'Количество равно итоговому количеству 3-й позиции шаблона дома. Ручной ввод отключён.',
    useFloors: 'never',
    manualQty: false,
    specFields: ['— (зависит от 3-й позиции)'],
  },
  {
    id: 'area',
    title: 'Площадь основания',
    formula: 'Q = μ × L × W × lot',
    description:
      'Площадь основания L×W. Итог Q = μ×L×W×lot. μ — множитель в шаблоне позиции. lot — этажность (если «Учитывать этажность»).',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Этажность', 'μ в шаблоне'],
  },
  {
    id: 'terrace_area',
    title: 'Площадь террасы',
    formula: 'St или 2×St, St = Lt × W',
    description:
      'St = Lt × W. Итог: St, если «Терраса на втором этаже» выключена; 2×St, если включена. Этажность не учитывается.',
    useFloors: 'never',
    manualQty: true,
    specFields: ['Ширина дома', 'Длина террасы', 'Терраса на втором этаже'],
  },
  {
    id: 'foundation_blocks_contour_internal',
    title: 'Бетонные блоки (контур + ряд)',
    formula: 'Опоры по контуру (шаг 1,5 м) + внутренний ряд',
    description:
      'Число блоков: контур (шаг 1,5 м) + внутренний ряд по длинной стороне. Этажность не учитывается. Округление до целого.',
    useFloors: 'never',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома'],
  },
  {
    id: 'kit_floor_area',
    title: 'Sdp — площадь домокомплекта по полу',
    formula: 'Sdp = Ld × Wd × lot',
    description:
      'Sdp = Ld×Wd×lot. Ld = L−Lt (длина домокомплекта), Wd = W. lot — этажность (если в шаблоне «Учитывать этажность»). Tb и k не учитываются.',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Длина террасы'],
  },
  {
    id: 'kit_area_plus_room_walls_len',
    title: 'Площадь домокомплекта + длина стен комнат',
    formula: 'Sdp + Lst×Cr×Tb',
    description:
      'Sdp = Ld×Wd. Lst = 2×(L+W); длина стен комнат = Lst×Cr×Tb. Этажность не учитывается.',
    useFloors: 'never',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Длина террасы', 'Комнат', 'Двойной брус'],
  },
  {
    id: 'kit_area_plus_room_walls_area',
    title: 'Площадь домокомплекта + площадь стен комнат',
    formula: 'Sds + Sst',
    description:
      'Sds = Pd×k×Tb×lot. Sst = Lst×k×Cr×Tb; Lst = 2×(L+W), Cr от C. lot — этажность (если в шаблоне «Учитывать этажность»). Итог: Sds + Sst.',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Длина террасы', 'Этажность', 'Комнат', 'Двойной брус', 'Высота k, м'],
  },
  {
    id: 'wall_insulation_sds',
    title: 'Утепление стен',
    formula: 'Sds / 2 = Pd × k × Tb × lot / 2',
    description:
      'Утепление — половина площади стен домокомплекта (Sds/2). Sds = Pd×k×Tb×lot. Только при «Двойной брус» в спецификации: иначе кол-во 0, строка серая, не в сумме.',
    useFloors: 'optional',
    manualQty: true,
    specFields: ['Длина дома', 'Ширина дома', 'Длина террасы', 'Этажность', 'Двойной брус', 'Высота k, м'],
  },
]

export const QTY_BASIS_GENERAL_NOTES = [
  'Правила задаются в шаблоне позиции дома: Настройки → Шаблон спецификации дома → позиция → «Правило количества от габаритов».',
  'Итоговое количество в строке: значение из колонки «Вручную», если заполнено; иначе автоматический расчёт по правилу.',
  'lot — этажность, C — число комнат, k — высота (м), поле «Высота k» в карточке спецификации (по умолчанию 2,8).',
  'При изменении габаритов, комнат, двойного бруса, террасы, балкона и высоты k позиции с зависимыми правилами пересчитываются автоматически.',
  '«Утепление стен» учитывается в сумме и доступно для редактирования только при включённом «Двойной брус» в спецификации.',
]

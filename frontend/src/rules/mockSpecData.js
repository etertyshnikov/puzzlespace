/** Тестовые данные спецификации (без бэкенда). */

export const SPEC_INPUT_FIELDS = [
  { name: 'length_m', label: 'Длина, м', type: 'number', step: '0.1' },
  { name: 'width_m', label: 'Ширина, м', type: 'number', step: '0.1' },
  { name: 'floors', label: 'Этажность', type: 'number', step: '1', min: 1 },
  { name: 'terrace_length_m', label: 'Длина террасы, м', type: 'number', step: '0.1' },
  { name: 'balcony_length_m', label: 'Длина балкона, м', type: 'number', step: '0.1' },
  { name: 'wall_height_m', label: 'Высота стен, м', type: 'number', step: '0.1' },
  { name: 'rooms_count', label: 'Число комнат', type: 'number', step: '1', min: 1 },
  { name: 'qty_multiplier', label: 'Множитель μ', type: 'number', step: '0.01' },
  { name: 'building_type', label: 'Тип здания', type: 'select', options: ['house', 'banya'] },
  { name: 'double_timber', label: 'Двойной брус', type: 'checkbox' },
  { name: 'terrace_second_floor', label: 'Терраса на 2 этаже', type: 'checkbox' },
  { name: 'qty_use_floors', label: 'Учитывать этажность', type: 'checkbox' },
]

export const DEFAULT_SPEC_INPUTS = {
  length_m: 10,
  width_m: 8,
  floors: 2,
  terrace_length_m: 3,
  balcony_length_m: 0,
  wall_height_m: 2.8,
  rooms_count: 4,
  qty_multiplier: 1,
  building_type: 'house',
  double_timber: true,
  terrace_second_floor: false,
  qty_use_floors: true,
}

export const MOCK_SPEC_ITEMS = [
  {
    id: 1,
    row: 1,
    part: 'Фундамент',
    name: 'Бетонный блок 40×20×20',
    unit: 'шт',
    quantity_auto: 48,
    quantity: 48,
    price: 850,
    qty_basis: 'foundation_blocks_contour_internal',
  },
  {
    id: 2,
    row: 2,
    part: 'Фундамент',
    name: 'Арматура 12 мм',
    unit: 'м.п.',
    quantity_auto: 36,
    quantity: 36,
    price: 95,
    qty_basis: 'perimeter',
  },
  {
    id: 3,
    row: 3,
    part: 'Стены',
    name: 'Сборка домокомплекта (брус 200 мм)',
    unit: 'м³',
    quantity_auto: 42.5,
    quantity: 42.5,
    price: 18500,
    qty_basis: 'perimeter_x2_double_timber',
  },
  {
    id: 4,
    row: 4,
    part: 'Стены',
    name: 'Утепление стен SDS',
    unit: 'м²',
    quantity_auto: 67.2,
    quantity: 67.2,
    price: 420,
    qty_basis: 'wall_insulation_sds',
  },
  {
    id: 5,
    row: 5,
    part: 'Пол',
    name: 'Черновой пол по лагам',
    unit: 'м²',
    quantity_auto: 80,
    quantity: 80,
    price: 890,
    qty_basis: 'kit_floor_area',
  },
  {
    id: 6,
    row: 6,
    part: 'Кровля',
    name: 'Стропильная система',
    unit: 'м²',
    quantity_auto: 92,
    quantity: 92,
    price: 1250,
    qty_basis: 'area',
  },
  {
    id: 7,
    row: 7,
    part: 'Терраса',
    name: 'Настил террасы',
    unit: 'м²',
    quantity_auto: 24,
    quantity: 24,
    price: 2100,
    qty_basis: 'terrace_area',
  },
]

export function calcDerived(spec) {
  const L = Number(spec.length_m) || 0
  const W = Number(spec.width_m) || 0
  const floors = Math.max(1, Number(spec.floors) || 1)
  const lot = spec.qty_use_floors ? floors : 1
  const perimeter = 2 * (L + W)
  const area = L * W
  const mu = Number(spec.qty_multiplier) || 1
  return { perimeter, area, floors, lot, mu, L, W }
}

export function applyTestRecalc(items, spec, activeRuleName) {
  const d = calcDerived(spec)
  return items.map((row) => {
    let qty = row.quantity_auto
    if (activeRuleName?.includes('Периметр')) {
      if (row.qty_basis === 'perimeter' || row.qty_basis === 'perimeter_x2_double_timber') {
        const timber = spec.double_timber ? 2 : 1
        qty = Math.round(d.perimeter * d.mu * d.lot * (row.qty_basis.includes('double') ? timber : 1) * 10) / 10
      }
    }
    if (activeRuleName?.includes('Площадь')) {
      if (row.qty_basis === 'area' || row.qty_basis === 'kit_floor_area') {
        qty = Math.round(d.area * d.mu * d.lot * 10) / 10
      }
    }
    const quantity = qty
    const total = Math.round(quantity * row.price)
    return { ...row, quantity_auto: qty, quantity, total }
  })
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api, type HouseTemplateCreate, type NomenclatureItem } from '../api/client'

export function HouseTemplateForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templateIdParam = searchParams.get('template_id')
  const templateIdFromUrl = templateIdParam ? parseInt(templateIdParam, 10) : null
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specTemplates, setSpecTemplates] = useState<{ id: number; name: string }[]>([])
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [nomenclature, setNomenclature] = useState<NomenclatureItem[]>([])
  const [form, setForm] = useState<HouseTemplateCreate>({
    house_specification_template_id: null,
    part_id: null,
    required_item_template_id: null,
    nomenclature_item_id: null,
    unit: 'шт',
    quantity: 1,
    price: null,
    comment: '',
    qty_basis: null,
    qty_multiplier: null,
    qty_use_floors: true,
  })

  useEffect(() => {
    api.houseSpecificationTemplates.list().then(setSpecTemplates).catch(() => setSpecTemplates([]))
    api.parts.list().then(setParts).catch(() => setParts([]))
    api.requiredItemTemplates.list().then(setTemplates).catch(() => setTemplates([]))
    api.nomenclatureItems.list({ limit: 2000 }).then(setNomenclature).catch(() => setNomenclature([]))
  }, [])

  useEffect(() => {
    if (isNew && templateIdFromUrl != null) {
      setForm((prev) => ({ ...prev, house_specification_template_id: templateIdFromUrl }))
    }
  }, [isNew, templateIdFromUrl])

  useEffect(() => {
    if (isNew) return
    api.houseTemplates
      .get(Number(id))
      .then((r) =>
        setForm({
          house_specification_template_id: r.house_specification_template_id ?? null,
          part_id: r.part_id ?? null,
          required_item_template_id: r.required_item_template_id ?? null,
          nomenclature_item_id: r.nomenclature_item_id ?? null,
          unit: r.unit,
          quantity: r.quantity,
          price: r.price ?? null,
          comment: r.comment ?? '',
          qty_basis: r.qty_basis ?? null,
          qty_multiplier: r.qty_multiplier ?? null,
          qty_use_floors: r.qty_use_floors !== false,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const update = (field: keyof HouseTemplateCreate, value: string | number | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      comment: form.comment?.trim() || undefined,
      price: form.price ?? undefined,
      qty_basis: form.qty_basis?.trim() || null,
      qty_multiplier:
        form.qty_basis === 'linked_wall_kit_qty'
          ? null
          : form.qty_multiplier != null && !Number.isNaN(form.qty_multiplier)
            ? form.qty_multiplier
            : null,
      qty_use_floors:
        form.qty_basis === 'foundation_blocks_contour_internal' ||
        form.qty_basis === 'terrace_area' ||
        form.qty_basis === 'kit_area_plus_room_walls_len'
          ? false
          : form.qty_basis === 'perimeter' ||
              form.qty_basis === 'perimeter_x2_double_timber' ||
              form.qty_basis === 'perimeter_rooms_kit' ||
              form.qty_basis === 'kit_perimeter_rooms_kit' ||
              form.qty_basis === 'kit_area_plus_room_walls_area' ||
              form.qty_basis === 'kit_floor_area' ||
              form.qty_basis === 'wall_insulation_sds' ||
              form.qty_basis === 'area'
            ? Boolean(form.qty_use_floors)
            : null,
    }
    if (isNew) {
      api.houseTemplates
        .create(payload)
        .then(() => navigate(templateIdFromUrl != null ? `/settings/house-templates?template_id=${templateIdFromUrl}` : '/settings/house-templates'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.houseTemplates
        .update(Number(id), payload)
        .then(() => {
          const tid = form.house_specification_template_id
          navigate(tid != null ? `/settings/house-templates?template_id=${tid}` : '/settings/house-templates')
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новая позиция шаблона спецификации дома' : 'Редактирование позиции шаблона спецификации дома'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Шаблон спецификации домов</label>
          <select
            value={form.house_specification_template_id ?? ''}
            onChange={(e) => update('house_specification_template_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {specTemplates.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Часть дома</label>
          <select
            value={form.part_id ?? ''}
            onChange={(e) => update('part_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Шаблон обязательных позиций</label>
          <select
            value={form.required_item_template_id ?? ''}
            onChange={(e) => update('required_item_template_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Позиция номенклатуры</label>
          <select
            value={form.nomenclature_item_id ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null
              if (val != null) {
                const item = nomenclature.find((n) => n.id === val)
                setForm((prev) => ({
                  ...prev,
                  nomenclature_item_id: val,
                  ...(item != null && { price: item.total_cost ?? prev.price ?? null, unit: item.unit ?? prev.unit }),
                }))
              } else {
                update('nomenclature_item_id', null)
              }
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">—</option>
            {nomenclature.map((n) => {
              const partName = parts.find((p) => p.id === n.part_id)?.name ?? ''
              const label = [n.item_number, partName, n.name ?? ''].filter(Boolean).join(' ')
              return (
                <option key={n.id} value={n.id}>{label}</option>
              )
            })}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Единица измерения</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => update('unit', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Правило количества от габаритов</label>
          <select
            value={form.qty_basis ?? ''}
            onChange={(e) => {
              const v = e.target.value || null
              setForm((prev) => ({
                ...prev,
                qty_basis: v,
                qty_multiplier:
                  v === 'foundation_blocks_contour_internal' ||
                  v === 'kit_floor_area' ||
                  v === 'area' ||
                  v === 'wall_insulation_sds' ||
                  (v && prev.qty_multiplier == null)
                    ? 1
                    : prev.qty_multiplier,
                qty_use_floors:
                  v === 'foundation_blocks_contour_internal' ||
                  v === 'terrace_area' ||
                  v === 'kit_area_plus_room_walls_len'
                    ? false
                    : v === 'perimeter' ||
                        v === 'perimeter_x2_double_timber' ||
                        v === 'perimeter_rooms_kit' ||
                        v === 'kit_perimeter_rooms_kit' ||
                        v === 'kit_area_plus_room_walls_area' ||
                        v === 'kit_floor_area' ||
                        v === 'wall_insulation_sds' ||
                        v === 'area'
                      ? prev.qty_use_floors === false
                        ? false
                        : true
                      : prev.qty_use_floors,
              }))
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">— (только поле «Количество» ниже)</option>
            <option value="fixed">Фиксированное (как «Количество»)</option>
            <option value="perimeter">Периметр основания 2×(L+W)</option>
            <option value="perimeter_x2_double_timber">
              Периметр основания ×2 при двойном брусе, ×1 без него
            </option>
            <option value="perimeter_rooms_kit">
              Домокомплект: периметр дома × этажность × (1 или 2 + надбавка по комнатам)
            </option>
            <option value="kit_perimeter_rooms_kit">
              Домокомплект: периметр домокомплекта × этажность × (1 или 2 + надбавка)
            </option>
            <option value="linked_wall_kit_qty">Сборка домокомплекта</option>
            <option value="area">Площадь основания L×W</option>
            <option value="terrace_area">Площадь террасы (ширина дома × длина террасы)</option>
            <option value="foundation_blocks_contour_internal">
              Бетонные блоки: контур + внутренний ряд (шаг 1,5 м)
            </option>
            <option value="kit_floor_area">Sdp — площадь домокомплекта по полу</option>
            <option value="kit_area_plus_room_walls_len">
              Площадь домокомплекта + длина стен комнат
            </option>
            <option value="kit_area_plus_room_walls_area">
              Площадь домокомплекта + площадь стен комнат
            </option>
            <option value="wall_insulation_sds">Утепление стен (Sds/2)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {form.qty_basis === 'linked_wall_kit_qty'
              ? 'Количество в спецификации всегда равно итоговому кол-ву 3-й позиции этого шаблона дома. Редактировать сборку вручную нельзя.'
              : form.qty_basis === 'foundation_blocks_contour_internal'
                ? 'Контур дома (опоры через 1,5 м) + один внутренний ряд по длинной стороне. Этажность не учитывается. В спецификации можно ввести количество вручную (колонка «Вручную») — пусто = авто.'
                : form.qty_basis === 'terrace_area'
                  ? 'St = Lt×W; 2×St, если в спецификации включена «Терраса на втором этаже».'
                : form.qty_basis === 'kit_floor_area'
                  ? 'Q = μ×Ld×Wd×lot; μ — множитель ниже. Ld = L−Lt, Wd = W. lot — по галочке «Учитывать этажность».'
                : form.qty_basis === 'kit_area_plus_room_walls_len'
                  ? 'Sdp + Lst×Cr×Tb: Sdp=Ld×Wd; Lst=2×(L+W). Cr от C: 2→0,16; 3→0,32; 4→0,48; 5+→0,65.'
                : form.qty_basis === 'kit_area_plus_room_walls_area'
                  ? 'Sds + Sst: k из поля «Высота k» спецификации (по умолчанию 2,8). Sds=Pd×k×Tb×lot, Sst=Lst×k×Cr×Tb.'
                : form.qty_basis === 'wall_insulation_sds'
                  ? 'Sds/2 = Pd×k×Tb×lot/2 (половина площади стен). Только при «Двойной брус»; иначе строка серая и не в сумме.'
                : form.qty_basis === 'perimeter_rooms_kit'
                ? '2×(L+W)×lot×(1+Cr или Tb+Cr). Cr от C. lot — по галочке «Учитывать этажность».'
                : form.qty_basis === 'kit_perimeter_rooms_kit'
                  ? 'Pd×lot×(1+Cr или Tb+Cr); Pd=2×(Ld+Wd). Ld=L−Lt, Wd=W.'
                : 'База по правилу × lot, если в шаблоне включено «Учитывать этажность». L и W — из спецификации.'}
          </p>
        </div>
        {(form.qty_basis === 'kit_floor_area' || form.qty_basis === 'area') && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">μ — множитель</label>
            <input
              type="number"
              step="0.01"
              min={0.01}
              value={form.qty_multiplier ?? 1}
              onChange={(e) =>
                update('qty_multiplier', e.target.value === '' ? 1 : parseFloat(e.target.value) || 1)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              {form.qty_basis === 'area'
                ? 'Итог: Q = μ × L × W × lot.'
                : 'Итог: Q = μ × Ld × Wd × lot (Sdp = Ld×Wd).'}
            </p>
          </div>
        )}
        {form.qty_basis &&
          (form.qty_basis === 'perimeter' ||
            form.qty_basis === 'perimeter_x2_double_timber' ||
            form.qty_basis === 'perimeter_rooms_kit' ||
            form.qty_basis === 'kit_perimeter_rooms_kit' ||
            form.qty_basis === 'kit_area_plus_room_walls_area' ||
            form.qty_basis === 'kit_floor_area' ||
            form.qty_basis === 'wall_insulation_sds' ||
            form.qty_basis === 'area') && (
          <div className="flex items-center gap-2">
            <input
              id="qty_use_floors"
              type="checkbox"
              checked={Boolean(form.qty_use_floors)}
              onChange={(e) => update('qty_use_floors', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="qty_use_floors" className="text-sm font-medium text-slate-700 cursor-pointer">
              Учитывать этажность
            </label>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Количество</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.quantity}
            onChange={(e) => update('quantity', parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Цена номенклатуры</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.price ?? ''}
            onChange={(e) => update('price', e.target.value === '' ? null : parseFloat(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-success"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => navigate(form.house_specification_template_id != null ? `/settings/house-templates?template_id=${form.house_specification_template_id}` : '/settings/house-templates')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

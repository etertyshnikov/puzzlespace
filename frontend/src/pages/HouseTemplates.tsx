import { useEffect, useState, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type HouseTemplate, type SpecificationPhoto, type NomenclatureItem } from '../api/client'
import { EditLinkIcon, DeleteIconButton } from '../components/SettingsActionIcons'
import { SettingsActionTh, SettingsActionTd, SettingsAddLink, SettingsToolbarButton } from '../components/SettingsTableChrome'
import { useSettingsReadOnly, useSettingsTableColSpan } from '../context/SettingsReadOnlyContext'
import { OPTIONAL_TOTAL_TEMPLATE_LINES } from '../data/specTemplateLines'

function nomenclatureDisplayName(items: NomenclatureItem[], id: number | null | undefined): string {
  if (id == null) return '—'
  const n = items.find((x) => x.id === id)
  if (!n) return '—'
  const name = n.name?.trim()
  if (name) return name
  return n.item_number?.trim() || '—'
}

export function HouseTemplates() {
  const colSpan = useSettingsTableColSpan(10)
  const settingsReadOnly = useSettingsReadOnly()
  const [searchParams] = useSearchParams()
  const templateIdParam = searchParams.get('template_id')
  const templateId = templateIdParam ? parseInt(templateIdParam, 10) : null

  const [list, setList] = useState<HouseTemplate[]>([])
  const [specTemplates, setSpecTemplates] = useState<{ id: number; name: string }[]>([])
  const [parts, setParts] = useState<{ id: number; name: string }[]>([])
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [nomenclature, setNomenclature] = useState<NomenclatureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'positions' | 'photos'>('positions')
  const [photos, setPhotos] = useState<SpecificationPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const filteredList = useMemo(() => {
    if (templateId == null) return list
    return list.filter((r) => r.house_specification_template_id === templateId)
  }, [list, templateId])

  const currentTemplateName = useMemo(() => {
    if (templateId == null) return null
    return specTemplates.find((s) => s.id === templateId)?.name ?? null
  }, [specTemplates, templateId])

  const load = () => {
    setLoading(true)
    api.houseTemplates.list().then(setList).catch((e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { api.houseSpecificationTemplates.list().then(setSpecTemplates).catch(() => setSpecTemplates([])) }, [])
  useEffect(() => { api.parts.list().then(setParts).catch(() => setParts([])) }, [])
  useEffect(() => { api.requiredItemTemplates.list().then(setTemplates).catch(() => setTemplates([])) }, [])
  useEffect(() => { api.nomenclatureItems.list({ limit: 2000 }).then(setNomenclature).catch(() => setNomenclature([])) }, [])

  useEffect(() => {
    if (templateId == null) { setPhotos([]); return }
    setPhotosLoading(true)
    api.specificationPhotos
      .listByTemplate(templateId)
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setPhotosLoading(false))
  }, [templateId])

  useEffect(() => { setActiveTab('positions') }, [templateId])

  const handleUploadPhotos = async (files: FileList | File[]) => {
    if (templateId == null) return
    setUploadingPhoto(true)
    try {
      const newPhotos = await api.specificationPhotos.uploadMany(Array.from(files), {
        house_specification_template_id: templateId,
        sort_order: photos.length,
      })
      setPhotos((prev) => [...prev, ...newPhotos])
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('Удалить фото?')) return
    try {
      await api.specificationPhotos.delete(photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const remove = (id: number) => {
    if (!confirm('Удалить позицию шаблона спецификации дома?')) return
    api.houseTemplates.delete(id).then(() => setList((prev) => prev.filter((x) => x.id !== id))).catch((e) => alert(e instanceof Error ? e.message : String(e)))
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>
  if (error) return <div className="text-red-600">{error}</div>

  const addLink = templateId != null ? `/settings/house-templates/new?template_id=${templateId}` : '/settings/house-templates/new'

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          {currentTemplateName != null ? (
            <>
              <p style={{ margin: '0 0 4px 0', color: '#73879C', fontSize: 13 }}>
                <Link to="/settings/house-specification-templates" style={{ color: '#1ABB9C' }}>Шаблон спецификации дома</Link>
                {' → '}
                <span style={{ color: '#73879C' }}>{currentTemplateName}</span>
              </p>
              <h2>Позиции шаблона спецификации дома</h2>
            </>
          ) : (
            <h2>Позиции шаблона спецификации дома</h2>
          )}
          <p style={{ margin: 0, color: '#73879C', fontSize: 13 }}>Всего: {filteredList.length}</p>
        </div>
        {activeTab === 'positions' && (
          <SettingsAddLink to={addLink}>Добавить</SettingsAddLink>
        )}
      </div>

      {templateId != null && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'positions' ? 'btn-default' : 'btn-primary'}`}
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            onClick={() => setActiveTab('positions')}
          >
            Позиции ({filteredList.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'photos' ? 'btn-default' : 'btn-primary'}`}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1 }}
            onClick={() => setActiveTab('photos')}
          >
            Фотографии{photos.length > 0 ? ` (${photos.length})` : ''}
          </button>
        </div>
      )}

      {activeTab === 'positions' ? (
        <div className="x_panel">
          <div className="x_content">
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>№</th>
                    <th style={{ width: 60 }}>ID</th>
                    <th>Шаблон спецификации домов</th>
                    <th>Часть дома</th>
                    <th>Шаблон обязательных позиций</th>
                    <th>Позиция номенклатуры</th>
                    <th style={{ width: 80 }}>Ед. изм.</th>
                    <th style={{ width: 80 }}>Кол-во</th>
                    <th style={{ width: 100 }}>Цена номенклатуры</th>
                    <SettingsActionTh />
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24, color: '#73879C' }}>
                        Нет записей.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((r, idx) => {
                      const lineNo = idx + 1
                      const optionalSumLine = OPTIONAL_TOTAL_TEMPLATE_LINES.has(lineNo)
                      return (
                      <tr
                        key={r.id}
                        style={optionalSumLine ? { backgroundColor: '#fffbeb' } : undefined}
                        title={optionalSumLine ? 'В спецификации: галочка «В сумме» (по умолчанию выкл.)' : undefined}
                      >
                        <td style={{ fontWeight: optionalSumLine ? 600 : undefined }}>{lineNo}</td>
                        <td>{r.id}</td>
                        <td>
                          {r.house_specification_template_id != null ? (
                            <Link to={`/settings/house-templates?template_id=${r.house_specification_template_id}`}>
                              {specTemplates.find((s) => s.id === r.house_specification_template_id)?.name ?? r.house_specification_template_id}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{parts.find((p) => p.id === r.part_id)?.name ?? '—'}</td>
                        <td>{templates.find((t) => t.id === r.required_item_template_id)?.name ?? '—'}</td>
                        <td>{nomenclatureDisplayName(nomenclature, r.nomenclature_item_id)}</td>
                        <td>{r.unit}</td>
                        <td>{r.quantity}</td>
                        <td>{r.price != null ? `${Number(r.price).toLocaleString('ru-RU')} ₽` : '—'}</td>
                        <SettingsActionTd>
                          <EditLinkIcon to={`/settings/house-templates/${r.id}/edit`} />
                          <DeleteIconButton onClick={() => remove(r.id)} />
                        </SettingsActionTd>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="x_panel">
          <div className="x_content" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) handleUploadPhotos(e.target.files)
                  e.target.value = ''
                }}
              />
              <SettingsToolbarButton
                className="btn btn-success"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploadingPhoto ? 'Загрузка…' : '+ Добавить фото'}
              </SettingsToolbarButton>
            </div>
            {photosLoading ? (
              <p style={{ color: '#73879C', fontSize: 13 }}>Загрузка фото…</p>
            ) : photos.length === 0 ? (
              <p style={{ color: '#73879C', fontSize: 13 }}>Нет фотографий</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {photos.map((photo) => (
                  <div key={photo.id} style={{ position: 'relative', width: 180, height: 180, borderRadius: 6, overflow: 'hidden', border: '1px solid #E6E9ED', background: '#f8f9fa' }}>
                    <img
                      src={api.specificationPhotos.imageUrl(photo.id)}
                      alt={photo.filename ?? 'Фото'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {!settingsReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.55)', color: '#fff',
                          border: 'none', cursor: 'pointer', fontSize: 15,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          lineHeight: 1,
                        }}
                        title="Удалить"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

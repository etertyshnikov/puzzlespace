import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type HouseSpecificationTemplateCreate, type SpecificationPhoto } from '../api/client'

export function HouseSpecificationTemplateForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<HouseSpecificationTemplateCreate>({ name: '' })
  const [photos, setPhotos] = useState<SpecificationPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isNew) return
    api.houseSpecificationTemplates
      .get(Number(id))
      .then((r) => setForm({ name: r.name }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id, isNew])

  useEffect(() => {
    if (isNew || !id) return
    setPhotosLoading(true)
    api.specificationPhotos
      .listByTemplate(Number(id))
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setPhotosLoading(false))
  }, [id, isNew])

  const handleUploadPhotos = async (files: FileList | File[]) => {
    if (!id) return
    setUploadingPhoto(true)
    try {
      const newPhotos = await api.specificationPhotos.uploadMany(Array.from(files), {
        house_specification_template_id: Number(id),
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Введите название.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = { name: form.name.trim() }
    if (isNew) {
      api.houseSpecificationTemplates
        .create(payload)
        .then(() => navigate('/settings/house-specification-templates'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    } else {
      api.houseSpecificationTemplates
        .update(Number(id), payload)
        .then(() => navigate('/settings/house-specification-templates'))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false))
    }
  }

  if (loading) return <div className="text-slate-500">Загрузка…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6">
        {isNew ? 'Новый шаблон спецификации домов' : 'Редактирование шаблона спецификации домов'}
      </h2>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
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
            onClick={() => navigate('/settings/house-specification-templates')}
            className="btn btn-default"
          >
            Отмена
          </button>
        </div>
      </form>

      {!isNew && id && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#2A3F54' }}>Фотографии шаблона</h3>
            <div>
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
              <button
                type="button"
                className="btn btn-success btn-sm"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploadingPhoto ? 'Загрузка…' : '+ Добавить фото'}
              </button>
            </div>
          </div>
          {photosLoading ? (
            <p style={{ color: '#73879C', fontSize: 13 }}>Загрузка фото…</p>
          ) : photos.length === 0 ? (
            <p style={{ color: '#73879C', fontSize: 13 }}>Нет фотографий</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {photos.map((photo) => (
                <div key={photo.id} style={{ position: 'relative', width: 150, height: 150, borderRadius: 6, overflow: 'hidden', border: '1px solid #E6E9ED', background: '#f8f9fa' }}>
                  <img
                    src={api.specificationPhotos.imageUrl(photo.id)}
                    alt={photo.filename ?? 'Фото'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo.id)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)', color: '#fff',
                      border: 'none', cursor: 'pointer', fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                    }}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

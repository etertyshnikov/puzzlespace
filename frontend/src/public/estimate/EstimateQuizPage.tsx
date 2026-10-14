import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PublicShell } from '../PublicShell'
import './estimate.css'
import { readError } from './types'

type Purpose = '' | 'business' | 'self' | 'bath'
type Floors = '' | '1' | '2' | '3' | '4plus'
type Relief = '' | 'flat' | 'slope' | 'complex'
type Sewer = '' | 'central' | 'septic'

const TECHS = [
  ['clay', 'Керамзитобетонный блок', '/estimate/tech-clay.svg'],
  ['gas', 'Газобетонный блок', '/estimate/tech-gas.svg'],
  ['timber', 'Клееный/профилированный брус', '/estimate/tech-timber.svg'],
  ['log', 'Оцилиндрованное бревно', '/estimate/tech-log.svg'],
  ['modular', 'Модульный дом', '/estimate/tech-modular.svg'],
  ['frame', 'Каркасный дом', '/estimate/tech-frame.svg'],
  ['poly', 'Полистиролбетон', '/estimate/tech-poly.svg'],
] as const

const ROOF_TYPES = [
  ['pitched', 'Скатная'],
  ['mono', 'Односкатная'],
  ['duo', 'Двухскатная'],
  ['flat', 'Плоская'],
] as const

const ROOF_MATERIALS = [
  ['metal', 'Металлочерепица'],
  ['seam', 'Фальцевая'],
  ['ceramic', 'Керамическая черепица'],
  ['soft', 'Мягкая кровля'],
  ['ondulin', 'Ондулин'],
] as const

const FACADES = [
  ['plaster', 'Штукатурка (мокрый фасад)'],
  ['clinker', 'Клинкерная плитка'],
  ['ventilated', 'Вентилируемый фасад'],
  ['planken', 'Имитация бруса / планкен'],
  ['fiber', 'Фиброцементные панели'],
] as const

function formatMeters(value: number) {
  const rounded = Math.round(value * 10) / 10
  return rounded.toFixed(1).replace('.', ',').replace(',0', '') + ' м'
}

export default function EstimateQuizPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [purpose, setPurpose] = useState<Purpose>('')
  const [region, setRegion] = useState('')
  const [plotOwned, setPlotOwned] = useState(false)
  const [hasCadastral, setHasCadastral] = useState(false)
  const [cadastral, setCadastral] = useState('')
  const [geology, setGeology] = useState(false)
  const [accessRoad, setAccessRoad] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [area, setArea] = useState('')
  const [floors, setFloors] = useState<Floors>('')
  const [ceiling, setCeiling] = useState(2.7)
  const [plotSize, setPlotSize] = useState('')
  const [relief, setRelief] = useState<Relief>('')
  const [sewer, setSewer] = useState<Sewer>('')
  const [technology, setTechnology] = useState('')
  const [roofType, setRoofType] = useState('')
  const [roofMaterial, setRoofMaterial] = useState('')
  const [facade, setFacade] = useState('')
  const [style, setStyle] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  function nextFromBrief() {
    if (region.trim().length < 2) {
      setError('Напишите регион или населённый пункт')
      return
    }
    if (hasCadastral && !/^[\d:]{5,40}$/.test(cadastral.trim())) {
      setError('Введите кадастровый номер цифрами и двоеточиями')
      return
    }
    setError('')
    setStep(3)
  }

  async function calculateQuote() {
    const areaNum = Number(area.replace(',', '.'))
    const ceilingNum = Math.round(ceiling * 10) / 10
    const plotNum = plotSize.trim() ? Number(plotSize.replace(',', '.')) : null
    if (plotSize.trim() && !(plotNum && plotNum > 0)) {
      setError('Размер участка укажите числом в сотках')
      return
    }
    if (!(areaNum > 0)) {
      setError('Площадь дома должна быть больше нуля')
      return
    }
    if (!(ceilingNum >= 2 && ceilingNum <= 5)) {
      setError('Высота потолков — от 2 до 5 метров')
      return
    }
    if (!floors || !relief || !sewer || !technology || !roofType || !roofMaterial || !facade) {
      setError('Отметьте этажность, рельеф, канализацию, технологию, кровлю и фасад')
      return
    }
    if (photo && !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
      setError('Фото нужно в формате JPG, PNG или WEBP')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/estimate/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          region: region.trim(),
          plot_owned: plotOwned,
          cadastral: hasCadastral ? cadastral.trim() : '',
          geology,
          access_road: accessRoad,
          clearing,
          area_m2: areaNum,
          floors,
          ceiling_m: ceilingNum,
          plot_sotkas: plotNum,
          relief,
          sewer,
          technology,
          roof_type: roofType,
          roof_material: roofMaterial,
          facade,
          style: style.trim(),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(readError(data, 'Не удалось посчитать смету'))
        return
      }
      const slug = String((data as { slug?: string }).slug || '')
      if (photo && slug) {
        const form = new FormData()
        form.append('file', photo)
        const uploaded = await fetch(`/api/estimate/quotes/${slug}/photo`, { method: 'POST', body: form })
        if (!uploaded.ok) {
          const photoError = await uploaded.json().catch(() => null)
          setError(readError(photoError, 'Смета сохранена, но фото не принялось'))
        }
      }
      navigate('/estimate/' + slug)
    } catch {
      setError('Сайт не ответил. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicShell title="Смета дома">
      <div className="est">
        <div className="est-progress" aria-hidden="true">
          {[1, 2, 3].map((item) => <span key={item} className={item <= step ? 'on' : undefined} />)}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
          >
            {step === 1 && (
              <>
                <h2>Универсальная система автоматического расчёта стоимости строительства дома</h2>
                <p className="est-lead">В итоге вы получите готовый PDF-документ со сравнительной таблицей стоимости домов по разным технологиям строительства</p>
                <div className="est-grid three">
                  <button type="button" className="est-3d business" onClick={() => { setPurpose('business'); setStep(2) }}>
                    <span className="est-emoji">🏢</span>
                    <strong>Дом для бизнеса</strong>
                    <small>Отель, глэмпинг, база отдыха и т.д.</small>
                  </button>
                  <button type="button" className="est-3d self" onClick={() => { setPurpose('self'); setStep(2) }}>
                    <span className="est-emoji">🏡</span>
                    <strong>Дом для себя</strong>
                    <small>Дача, коттедж, фазенда, поместье</small>
                  </button>
                  <button type="button" className="est-3d bath" onClick={() => { setPurpose('bath'); setStep(2) }}>
                    <span className="est-emoji">🧖</span>
                    <strong>Баня</strong>
                    <small>Модульная, бревенчатая, из бруса</small>
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2>Где планируете строить?</h2>
                <label className="est-label" htmlFor="est-region">Регион / населённый пункт</label>
                <input id="est-region" type="text" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Например, Геленджик" />
                <p className="est-label">Дополнительная информация об участке</p>
                <div className="est-checks">
                  <label><input type="checkbox" checked={plotOwned} onChange={(event) => setPlotOwned(event.target.checked)} /> Участок уже в собственности</label>
                  <label><input type="checkbox" checked={hasCadastral} onChange={(event) => setHasCadastral(event.target.checked)} /> Известен кадастровый номер</label>
                  <label><input type="checkbox" checked={geology} onChange={(event) => setGeology(event.target.checked)} /> Проведён анализ почвы (геология)</label>
                  <label><input type="checkbox" checked={accessRoad} onChange={(event) => setAccessRoad(event.target.checked)} /> Есть подъездные пути для тяжёлой техники</label>
                  <label><input type="checkbox" checked={clearing} onChange={(event) => setClearing(event.target.checked)} /> Участок требует расчистки от леса/кустарника</label>
                </div>
                {hasCadastral && (
                  <>
                    <label className="est-label" htmlFor="est-cad">Кадастровый номер</label>
                    <input id="est-cad" type="text" value={cadastral} onChange={(event) => setCadastral(event.target.value)} placeholder="23:47:0000000:1" />
                    <p className="est-hint">Номер сохранится в смете. Площадь участка введите на следующем шаге в сотках: Росреестр с сайта не запрашиваем.</p>
                  </>
                )}
                {error && <p className="est-error">{error}</p>}
                <div className="est-actions">
                  <button type="button" className="est-go ghost" onClick={() => { setError(''); setStep(1) }}>Назад</button>
                  <button type="button" className="est-go" onClick={nextFromBrief}>Дальше</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2>Параметры дома и технологии</h2>
                <section className="est-block">
                  <h3>Габариты</h3>
                  <label className="est-label" htmlFor="est-area">Площадь дома</label>
                  <div className="est-field">
                    <input id="est-area" inputMode="decimal" value={area} onChange={(event) => setArea(event.target.value)} placeholder="120" />
                    <span className="est-unit">м²</span>
                  </div>
                  <p className="est-label">Этажность</p>
                  <div className="est-choices">
                    {([['1', '1 этаж'], ['2', '2 этажа'], ['3', '3 этажа'], ['4plus', 'Более 3-х этажей']] as const).map(([id, label]) => (
                      <button type="button" key={id} className={floors === id ? 'est-choice on' : 'est-choice'} onClick={() => setFloors(id)}>{label}</button>
                    ))}
                  </div>
                  {purpose === 'self' ? (
                    <>
                      <label className="est-label" htmlFor="est-ceiling">Высота потолков</label>
                      <div className="est-scale">
                        <strong className="est-scale-value">{formatMeters(ceiling)}</strong>
                        <input
                          id="est-ceiling"
                          type="range"
                          min={2}
                          max={5}
                          step={0.1}
                          value={ceiling}
                          aria-valuemin={2}
                          aria-valuemax={5}
                          aria-valuenow={ceiling}
                          aria-valuetext={formatMeters(ceiling)}
                          onChange={(event) => setCeiling(Math.round(Number(event.target.value) * 10) / 10)}
                        />
                        <div className="est-scale-marks" aria-hidden="true">
                          <span>2 м</span>
                          <span>3 м</span>
                          <span>4 м</span>
                          <span>5 м</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="est-label" htmlFor="est-ceiling-num">Высота потолков</label>
                      <div className="est-field">
                        <input
                          id="est-ceiling-num"
                          inputMode="decimal"
                          value={String(ceiling).replace('.', ',')}
                          onChange={(event) => {
                            const next = Number(event.target.value.replace(',', '.'))
                            if (Number.isFinite(next)) setCeiling(Math.min(5, Math.max(2, Math.round(next * 10) / 10)))
                          }}
                        />
                        <span className="est-unit">м</span>
                      </div>
                    </>
                  )}
                  <label className="est-label" htmlFor="est-plot">Размер участка, соток</label>
                  <input id="est-plot" inputMode="decimal" value={plotSize} onChange={(event) => setPlotSize(event.target.value)} placeholder="10" />
                  <p className="est-label">Рельеф участка</p>
                  <div className="est-choices">
                    <button type="button" className={relief === 'flat' ? 'est-choice green on' : 'est-choice'} onClick={() => setRelief('flat')}>Ровный</button>
                    <button type="button" className={relief === 'slope' ? 'est-choice gold on' : 'est-choice'} onClick={() => setRelief('slope')}>Склон</button>
                    <button type="button" className={relief === 'complex' ? 'est-choice on' : 'est-choice'} onClick={() => setRelief('complex')}>Сложный</button>
                  </div>
                </section>
                <section className="est-block">
                  <h3>Коммуникации</h3>
                  <p className="est-label">Канализация</p>
                  <div className="est-choices">
                    <button type="button" className={sewer === 'central' ? 'est-choice on' : 'est-choice'} onClick={() => setSewer('central')}>Центральная</button>
                    <button type="button" className={sewer === 'septic' ? 'est-choice on' : 'est-choice'} onClick={() => setSewer('septic')}>Септик / ЛОС</button>
                  </div>
                  <p className="est-label">Электричество</p>
                  <div className="est-choices">
                    <button type="button" className="est-choice gold on">Подключение + внутренняя разводка</button>
                  </div>
                </section>
                <section className="est-block">
                  <h3>Технология строительства</h3>
                  <div className="est-grid tech">
                    {TECHS.map(([id, label, src]) => (
                      <button type="button" key={id} className={technology === id ? 'est-tech on' : 'est-tech'} onClick={() => setTechnology(id)}>
                        <img src={src} alt="" />
                        <strong>{label}</strong>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="est-block">
                  <h3>Кровля и фасад</h3>
                  <p className="est-label">Тип кровли</p>
                  <div className="est-choices">
                    {ROOF_TYPES.map(([id, label]) => (
                      <button type="button" key={id} className={roofType === id ? 'est-choice on' : 'est-choice'} onClick={() => setRoofType(id)}>{label}</button>
                    ))}
                  </div>
                  <p className="est-label">Материал кровли</p>
                  <div className="est-choices">
                    {ROOF_MATERIALS.map(([id, label]) => (
                      <button type="button" key={id} className={roofMaterial === id ? 'est-choice gold on' : 'est-choice'} onClick={() => setRoofMaterial(id)}>{label}</button>
                    ))}
                  </div>
                  <p className="est-label">Тип фасада</p>
                  <div className="est-choices">
                    {FACADES.map(([id, label]) => (
                      <button type="button" key={id} className={facade === id ? 'est-choice green on' : 'est-choice'} onClick={() => setFacade(id)}>{label}</button>
                    ))}
                  </div>
                </section>
                <section className="est-block">
                  <h3>Архитектурный стиль</h3>
                  <label className="est-label" htmlFor="est-style">Предпочтительный стиль (например, барнхаус, шале, классика)</label>
                  <input id="est-style" type="text" value={style} onChange={(event) => setStyle(event.target.value)} />
                  <label className="est-go ghost" htmlFor="est-photo">📎 Прикрепить фото похожего дома</label>
                  <input id="est-photo" className="est-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
                  {photo && <p className="est-hint">{photo.name}</p>}
                </section>
                {error && <p className="est-error">{error}</p>}
                <div className="est-actions">
                  <button type="button" className="est-go ghost" onClick={() => { setError(''); setStep(2) }}>Назад</button>
                  <button type="button" className="est-go" disabled={busy} onClick={calculateQuote}>
                    {busy ? 'Считаем…' : '🚀 Рассчитать смету и получить PDF'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </PublicShell>
  )
}

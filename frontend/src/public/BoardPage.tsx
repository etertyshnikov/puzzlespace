import { FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { portalApi, portalToken } from './portalApi'
import { PublicShell } from './PublicShell'

const FORMS: Record<string, { title: string; fields: { name: string; label: string; area?: boolean }[] }> = {
  vacancy: {
    title: 'Разместить вакансию',
    fields: [
      { name: 'title', label: 'Должность' },
      { name: 'city', label: 'Город' },
      { name: 'salary', label: 'Зарплата' },
      { name: 'schedule', label: 'Занятость' },
      { name: 'description', label: 'Описание', area: true },
    ],
  },
  resume: {
    title: 'Разместить резюме',
    fields: [
      { name: 'title', label: 'Должность' },
      { name: 'city', label: 'Город' },
      { name: 'experience', label: 'Опыт' },
      { name: 'salary', label: 'Ожидаемый доход' },
      { name: 'description', label: 'О себе', area: true },
    ],
  },
  sell: {
    title: 'Продать участок',
    fields: [
      { name: 'locality', label: 'Населённый пункт' },
      { name: 'sotki', label: 'Площадь, соток' },
      { name: 'price', label: 'Цена' },
      { name: 'vri', label: 'ВРИ' },
      { name: 'communications', label: 'Коммуникации' },
      { name: 'description', label: 'Описание', area: true },
    ],
  },
  buy: {
    title: 'Купить участок',
    fields: [
      { name: 'region', label: 'Регион' },
      { name: 'budget', label: 'Бюджет' },
      { name: 'sotki', label: 'Желаемая площадь' },
      { name: 'requirements', label: 'Требования', area: true },
    ],
  },
  order: {
    title: 'Заказать смету',
    fields: [
      { name: 'place', label: 'Город или посёлок' },
      { name: 'house', label: 'Какой дом нужен' },
      { name: 'comment', label: 'Комментарий', area: true },
    ],
  },
}

export function BoardPage({ kindOverride }: { kindOverride?: string }) {
  const params = useParams()
  const kind = kindOverride || params.kind || ''
  const form = FORMS[kind]
  const nextPath = kind === 'order' ? '/order' : `/board/${kind}`
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  if (!form) {
    return <PublicShell title="Раздел не найден"><p><Link to="/">На главную</Link></p></PublicShell>
  }
  if (!portalToken()) {
    return (
      <PublicShell title={form.title}>
        <section className="dom-card">
          <p>Объявление может отправить только зарегистрированный пользователь. При регистрации нужно согласие на обработку персональных данных.</p>
          <p><Link className="dom-btn" to={`/portal/register?next=${nextPath}`}>Регистрация</Link></p>
          <p><Link to={`/portal/login?next=${nextPath}`}>Уже есть кабинет</Link></p>
        </section>
      </PublicShell>
    )
  }
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.currentTarget)
    const body: Record<string, string> = {}
    for (const field of form.fields) body[field.label] = String(formData.get(field.name) || '')
    const title = body[form.fields[0].label] || form.title
    try {
      await portalApi.create({ kind, title: `${form.title}: ${title}`, body })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    }
  }
  if (done) {
    return (
      <PublicShell title="Отправлено на модерацию">
        <section className="dom-card">
          <p className="dom-ok">Объявление попало администратору. В каналы оно уйдёт только после разрешения.</p>
          <button type="button" className="dom-btn" onClick={() => navigate('/cabinet')}>В личный кабинет</button>
        </section>
      </PublicShell>
    )
  }
  return (
    <PublicShell title={form.title}>
      <form className="dom-card" onSubmit={onSubmit}>
        {error && <p className="dom-error">{error}</p>}
        {form.fields.map((field) => (
          <label key={field.name}>
            {field.label}
            {field.area
              ? <textarea name={field.name} rows={4} required />
              : <input name={field.name} required />}
          </label>
        ))}
        <p><button className="dom-btn" type="submit">Отправить на модерацию</button></p>
      </form>
    </PublicShell>
  )
}

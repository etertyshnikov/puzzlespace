import { MouseEvent } from 'react'
import './public.css'
import { CloseMaxButton } from './CloseMaxButton'
import { Disclaimer, LegalFooterLinks } from './LegalCopy'

const ITEMS = [
  { href: '/estimate', label: 'Смета дома — рассчитать', x: 23.2, y: 35.6, w: 25.6, h: 8.8 },
  { href: '/order', label: 'Заказать смету', x: 51.6, y: 35.6, w: 25.4, h: 8.8 },
  { href: '/board/vacancy', label: 'Разместить вакансию', x: 23.2, y: 46.2, w: 25.6, h: 8.6 },
  { href: '/board/resume', label: 'Разместить резюме', x: 51.6, y: 46.2, w: 25.4, h: 8.6 },
  { href: '/board/sell', label: 'Продать участок', x: 23.2, y: 57.2, w: 25.6, h: 9.2 },
  { href: '/board/buy', label: 'Купить участок', x: 51.6, y: 57.2, w: 25.4, h: 9.2 },
  { href: '/about', label: 'О нас', x: 23.2, y: 69.2, w: 25.6, h: 9.2 },
  { href: '/contacts', label: 'Контакты', x: 51.6, y: 69.2, w: 25.4, h: 9.2 },
  { href: '/cabinet', label: 'Личный кабинет', x: 23.2, y: 80.6, w: 25.6, h: 12.4 },
  { href: '/partner', label: 'Стать агентом', x: 51.6, y: 80.6, w: 25.4, h: 12.4 },
]

function pressHotspot(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = event.currentTarget
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) {
    const rect = link.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const ripple = document.createElement('span')
    ripple.className = 'dom-ripple'
    ripple.style.width = `${size}px`
    ripple.style.height = `${size}px`
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`
    link.appendChild(ripple)
    window.setTimeout(() => ripple.remove(), 520)
  }
  event.preventDefault()
  const href = link.getAttribute('href') || '/'
  window.setTimeout(() => { window.location.assign(href) }, reduce ? 0 : 120)
}

export function HomePage() {
  return (
    <div className="dom-home">
      <h1 className="sr-only">Дом на Юге</h1>
      <div className="dom-fit">
        <div className="dom-art">
          <img src="/dom/menu.jpg" alt="Меню «Дом на Юге»" width={1536} height={1024} />
          {ITEMS.map((item) => (
            <a
              key={item.href}
              className="dom-hotspot"
              href={item.href}
              aria-label={item.label}
              style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`, height: `${item.h}%` }}
              onClick={pressHotspot}
            />
          ))}
        </div>
      </div>
      <footer className="dom-home-foot">
        <LegalFooterLinks compact />
        <Disclaimer />
      </footer>
      <CloseMaxButton />
    </div>
  )
}

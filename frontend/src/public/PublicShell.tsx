import type { ReactNode } from 'react'
import './public.css'
import { CloseMaxButton } from './CloseMaxButton'
import { Disclaimer, LegalFooterLinks } from './LegalCopy'

export function PublicShell({ title, children, afterFooter }: { title: string; children: ReactNode; afterFooter?: ReactNode }) {
  return (
    <div className="dom-root">
      <header className="dom-top">
        <a className="dom-brand" href="/">Дом на Юге</a>
        <a className="dom-menu" href="/">Меню</a>
      </header>
      <main className="dom-sheet">
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="dom-foot" style={{ display: 'block' }}>
        <LegalFooterLinks />
        <Disclaimer />
      </footer>
      {afterFooter}
      <CloseMaxButton />
    </div>
  )
}

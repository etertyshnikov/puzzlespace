const KP_LAYOUT_MARKER = '<!-- kp-layout:landscape -->'
const KP_BG_FILE = 'IMG_20260518_095427.png'
const KP_LOGO_FILE = 'logo KP.png'
const KP_TITLE_BANNER_FILE = 'title psk doma kubani.png'

function kpLogoImageUrl(): string {
  const file = encodeURIComponent(KP_LOGO_FILE)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/static/images/${file}`
  }
  return `/static/images/${file}`
}

function kpBackgroundImageUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/static/images/${KP_BG_FILE}`
  }
  return `/static/images/${KP_BG_FILE}`
}

function kpTitleBannerImageUrl(): string {
  const file = encodeURIComponent(KP_TITLE_BANNER_FILE)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/static/images/${file}`
  }
  return `/static/images/${file}`
}

/** Оборачивает фрагмент HTML в документ для iframe; полный документ возвращается как есть. */
export function buildKpPreviewHtml(content: string): string {
  let trimmed = (content || '').trim()
  const logoImg = `<img class="kp-logo-img" src="${kpLogoImageUrl()}" alt="Дома Кубани" />`
  const titleBannerImg = `<img class="kp-title-banner-img" src="${kpTitleBannerImageUrl()}" alt="ПСК Дома Кубани" />`
  trimmed = trimmed.replace(/\{\{\s*kp_logo\s*\}\}/gi, logoImg)
  trimmed = trimmed.replace(/\{\{\s*kp_title_banner\s*\}\}/gi, titleBannerImg)

  if (/^<!DOCTYPE/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.includes(KP_LAYOUT_MARKER)) {
    const bgUrl = kpBackgroundImageUrl()
    const landscapeStyle = `
      @page { size: A4 landscape; margin: 0; }
      :root { --kp-bg-image: url('${bgUrl}'); }
      * { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
        font-size: 10.5pt; line-height: 1.45; color: #1a1a1a;
        background: transparent;
      }
      .kp-print-bg {
        position: fixed; inset: 0; z-index: -1;
        background-image: var(--kp-bg-image);
        background-size: cover; background-position: center;
        background-repeat: no-repeat;
        background-color: #e8f0ee;
      }
      .kp-landscape-doc { width: 100%; position: relative; z-index: 1; }
      .kp-page {
        min-height: 190mm; padding: 8mm 10mm;
        page-break-after: always; break-after: page;
        background-image: var(--kp-bg-image);
        background-size: cover; background-position: center;
        background-repeat: no-repeat;
        background-color: #e8f0ee;
      }
      .kp-page:last-child { page-break-after: auto; break-after: auto; }
      .kp-panel {
        background: rgba(255, 255, 255, 0.72);
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 10px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      }
      .kp-panel-table { background: rgba(255, 255, 255, 0.78); }
      .kp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
      .kp-logo { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
      .kp-logo-img { height: 96px; width: auto; max-width: 320px; object-fit: contain; display: block; }
      .kp-logo span { display: block; font-size: 10pt; font-weight: 400; color: #444; }
      .kp-meta { text-align: right; font-size: 10pt; }
      .kp-meta strong { display: block; font-size: 12pt; margin-bottom: 4px; }
      .kp-badge {
        display: inline-block; margin-top: 6px; padding: 3px 10px;
        background: #d4f0ea; color: #1e7e6a; font-size: 9pt; border-radius: 4px;
      }
      .kp-prelim-cols { display: flex; gap: 12px; align-items: stretch; margin-bottom: 10px; }
      .kp-prelim-banner {
        flex: 0 0 40%; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 4px 6px;
      }
      .kp-prelim-banner .kp-title-banner { margin: 0; width: 100%; text-align: center; }
      .kp-title-banner-img {
        display: block; width: 100%; max-width: 100%; height: auto;
        max-height: 42mm; object-fit: contain; margin: 0 auto;
      }
      .kp-prelim-right { flex: 1 1 60%; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
      .kp-prelim-right .kp-prelim-title {
        text-align: center; font-size: 13pt; font-weight: 700; letter-spacing: 0.04em;
        margin: 0; padding: 6px 10px; background: #fff3cd; border: 1px solid #e6c200;
      }
      .kp-prelim-info { width: 100%; border-collapse: collapse; font-size: 9pt; line-height: 1.25; }
      .kp-prelim-info td { border: 1px solid #e6c200; padding: 4px 8px; vertical-align: middle; }
      .kp-prelim-info td:first-child { width: 58%; background: #fff3cd; font-weight: 600; }
      .kp-prelim-info td:last-child { background: #fff; text-align: center; font-weight: 600; }
      .kp-prelim-meta { font-size: 8.5pt; color: #555; margin: 0 0 8px; }
      .kp-page-photos .kp-panel-photos {
        padding: 8mm 10mm; min-height: 175mm; display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.85);
      }
      .kp-photos-grid { display: flex; gap: 10mm; width: 100%; align-items: center; justify-content: center; }
      .kp-photo-slot {
        flex: 1 1 50%; min-width: 0; max-height: 170mm;
        display: flex; align-items: center; justify-content: center;
      }
      .kp-photo-slot img {
        max-width: 100%; max-height: 170mm; object-fit: contain;
        border: 1px solid #ccc; border-radius: 4px;
      }
      .kp-block h2 {
        font-size: 12pt; color: #1e7e6a; margin: 0 0 8px;
        border-bottom: 2px solid #26B99A; padding-bottom: 4px;
      }
      .kp-info { width: 100%; border-collapse: collapse; }
      .kp-info td { border: none; padding: 3px 8px 3px 0; vertical-align: top; }
      .kp-info td:first-child { width: 32%; color: #555; font-weight: 600; }
      table.kp-table { width: 100%; border-collapse: collapse; font-size: 8pt; line-height: 1.2; }
      table.kp-table th, table.kp-table td { border: 1px solid #bbb; padding: 2px 4px; vertical-align: top; }
      table.kp-table th { background: #ef8013; color: #fff; font-weight: 600; font-size: 8pt; }
      table.kp-table td:nth-child(1), table.kp-table td:nth-child(3),
      table.kp-table td:nth-child(4), table.kp-table td:nth-child(5),
      table.kp-table td:nth-child(6) { white-space: nowrap; }
      table.kp-table td:nth-child(2) { word-wrap: break-word; overflow-wrap: break-word; }
      .kp-part-title td { background: #F7A14C; color: #1a1a1a; font-weight: 600; font-size: 8pt; }
      table.kp-table tr.kp-row-warm td { background: #fdebd0; }
      table.kp-table tr.kp-row-cool td { background: #d6eaf8; }
      .kp-panel-table { padding: 6px 8px !important; }
      .kp-panel-table .kp-block h2 { font-size: 10pt; margin: 0 0 4px; padding-bottom: 2px; }
      .kp-total { margin-top: 6px; text-align: right; font-size: 10pt; line-height: 1.2; }
      .kp-total strong { font-size: 11pt; color: #1e7e6a; }
      .kp-cols { display: flex; gap: 16px; flex-wrap: wrap; }
      .kp-cols > section { flex: 1; min-width: 45%; }
      .kp-page { position: relative; }
      .kp-page:last-child { padding-bottom: 32mm; }
      .kp-footer {
        position: absolute;
        left: 10mm;
        right: 10mm;
        bottom: 5mm;
        margin: 0;
        padding: 10px 18px;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 8px;
        font-size: 8.5pt;
        line-height: 1.45;
        color: #444;
        text-align: center;
      }
      .kp-block a, .kp-footer a { color: #1e7e6a; text-decoration: underline; }
      .kp-block a:hover, .kp-footer a:hover { color: #156b58; }
    `
    const body = `<div class="kp-print-bg" aria-hidden="true"></div>${trimmed}`
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/><title>Коммерческое предложение</title><style>${landscapeStyle}</style></head><body>${body}</body></html>`
  }

  const style = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px 24px;
      font-size: 12pt;
      line-height: 1.5;
      font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
      color: #000;
      background: #fff;
    }
    p, h1, h2, h3, h4, h5, h6, li, td, th, span, div { font-family: inherit; }
    p { margin: 0.25em 0; }
    h1 { font-size: 1.6em; margin: 0.5em 0 0.3em; }
    h2 { font-size: 1.3em; margin: 0.4em 0 0.2em; }
    h3 { font-size: 1.15em; margin: 0.3em 0 0.2em; }
    ul, ol { padding-left: 1.5em; }
    table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
    th, td { border: 1px solid #999; padding: 6px 8px; min-width: 50px; }
    th { background: #f5f5f5; font-weight: 600; }
    a { color: #337AB7; text-decoration: underline; }
    blockquote { border-left: 3px solid #ddd; padding-left: 12px; margin-left: 0; color: #666; }
    img { max-width: 100%; height: auto; }
  `
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/><title>Коммерческое предложение</title><style>${style}</style></head><body>${content}</body></html>`
}

const PRINT_ON_LOAD_SCRIPT =
  '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})</script>'

/** HTML для печати: документ + автозапуск диалога печати после загрузки вкладки. */
export function buildKpPrintHtml(content: string): string {
  const doc = buildKpPreviewHtml(content)
  if (/<\/head>/i.test(doc)) {
    return doc.replace(/<\/head>/i, `${PRINT_ON_LOAD_SCRIPT}</head>`)
  }
  return doc + PRINT_ON_LOAD_SCRIPT
}

/** Открывает HTML в новой вкладке через ссылку (не всплывающее окно). */
export function openKpHtmlPrintTab(content: string): void {
  const html = buildKpPrintHtml(content)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

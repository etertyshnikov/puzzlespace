import { useEffect, useRef } from 'react'

export const APP_TAB_TITLE = 'СметаДома — CRM'

const BLINK_MS = 1000

function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}

function titledBadge(count: number, text: string): string {
  return `(${formatBadge(count)}) ${text}`
}

function blinkLabel(chatUnread: number, notificationUnread: number): string {
  if (chatUnread > 0 && notificationUnread > 0) return 'Новые сообщения'
  if (chatUnread > 0) return 'Новое сообщение'
  if (notificationUnread > 0) return 'Новое уведомление'
  return APP_TAB_TITLE
}

type TabTitleAlertOptions = {
  enabled?: boolean
  chatUnread?: number
  notificationUnread?: number
}

/** Бейдж в заголовке вкладки и «моргание», когда вкладка в фоне (как VK / OK). */
export function useTabTitleAlert({
  enabled = true,
  chatUnread = 0,
  notificationUnread = 0,
}: TabTitleAlertOptions): void {
  const showAltRef = useRef(false)

  const totalUnread = chatUnread + notificationUnread

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return

    let interval: ReturnType<typeof setInterval> | undefined

    const applyTitle = (hidden: boolean) => {
      if (totalUnread <= 0) {
        document.title = APP_TAB_TITLE
        return
      }
      if (hidden && showAltRef.current) {
        document.title = titledBadge(totalUnread, blinkLabel(chatUnread, notificationUnread))
      } else {
        document.title = titledBadge(totalUnread, APP_TAB_TITLE)
      }
    }

    const stopBlink = () => {
      if (interval) {
        clearInterval(interval)
        interval = undefined
      }
      showAltRef.current = false
      applyTitle(false)
    }

    const startBlink = () => {
      if (interval || totalUnread <= 0) return
      showAltRef.current = false
      applyTitle(true)
      interval = setInterval(() => {
        showAltRef.current = !showAltRef.current
        applyTitle(true)
      }, BLINK_MS)
    }

    const onVisibility = () => {
      if (document.hidden) startBlink()
      else stopBlink()
    }

    if (totalUnread <= 0) {
      document.title = APP_TAB_TITLE
    } else if (document.hidden) {
      startBlink()
    } else {
      applyTitle(false)
    }

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopBlink()
      document.removeEventListener('visibilitychange', onVisibility)
      document.title = APP_TAB_TITLE
    }
  }, [enabled, totalUnread, chatUnread, notificationUnread])
}

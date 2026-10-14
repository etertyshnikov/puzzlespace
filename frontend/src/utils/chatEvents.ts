/** Сигнал для обновления бейджей чата в меню и списке диалогов. */
export function notifyChatUpdated(): void {
  window.dispatchEvent(new CustomEvent('chat:updated'))
}

export const CHAT_UPDATED_EVENT = 'chat:updated'

/** Сигнал для обновления бейджа колокольчика и списка уведомлений. */
export function notifyNotificationsUpdated(): void {
  window.dispatchEvent(new CustomEvent('notifications:updated'))
}

export const NOTIFICATIONS_UPDATED_EVENT = 'notifications:updated'

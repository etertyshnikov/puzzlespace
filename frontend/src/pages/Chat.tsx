import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ChatPhotoLightbox, type ChatLightboxItem } from '../components/ChatPhotoLightbox'
import { api, type ChatDialogOut, type ChatMessageOut } from '../api/client'
import { isAgentUser } from '../utils/userRoles'
import { notifyChatUpdated } from '../utils/chatEvents'
import { notifyNotificationsUpdated } from '../utils/notificationEvents'
import './chat.css'

const MAX_PHOTOS = 10

type PendingPhoto = {
  id: string
  file: File
  preview: string
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function userInitial(name: string): string {
  const ch = name.trim().charAt(0)
  return ch ? ch.toUpperCase() : '?'
}

function sortDialogs(list: ChatDialogOut[]): ChatDialogOut[] {
  return [...list].sort((a, b) => {
    if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count
    const ta = a.last_message_at || ''
    const tb = b.last_message_at || ''
    if (ta !== tb) return tb.localeCompare(ta)
    return a.peer_name.localeCompare(b.peer_name, 'ru')
  })
}

function patchDialog(
  list: ChatDialogOut[],
  threadId: number,
  patch: Partial<ChatDialogOut>,
): ChatDialogOut[] {
  return sortDialogs(
    list.map((d) => (d.thread_id === threadId ? { ...d, ...patch } : d)),
  )
}

function collectLightboxItems(messages: ChatMessageOut[]): ChatLightboxItem[] {
  const items: ChatLightboxItem[] = []
  for (const message of messages) {
    for (const attachment of message.attachments || []) {
      items.push({
        id: attachment.id,
        filename: attachment.filename,
        url: api.chat.attachmentImageUrl(attachment.id),
      })
    }
  }
  return items
}

export function Chat() {
  const { user } = useAuth()
  const isAgent = isAgentUser(user)
  const agentsColumnTitle = isAgent ? 'Менеджер' : 'Агенты'
  const [dialogs, setDialogs] = useState<ChatDialogOut[]>([])
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessageOut[]>([])
  const [text, setText] = useState('')
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([])
  const [loadingDialogs, setLoadingDialogs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingPhotosRef = useRef(pendingPhotos)

  const activeDialog = dialogs.find((d) => d.thread_id === activeThreadId) ?? null
  const canSend = Boolean(text.trim() || pendingPhotos.length > 0)
  const lightboxItems = collectLightboxItems(messages)

  const openLightbox = (attachmentId: number) => {
    const idx = lightboxItems.findIndex((item) => item.id === attachmentId)
    if (idx >= 0) setLightboxIndex(idx)
  }

  pendingPhotosRef.current = pendingPhotos

  const clearPendingPhotos = useCallback(() => {
    setPendingPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview))
      return []
    })
  }, [])

  useEffect(
    () => () => {
      pendingPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.preview))
    },
    [],
  )

  const loadDialogs = useCallback((silent = false) => {
    if (!silent) setLoadingDialogs(true)
    api.chat
      .dialogs()
      .then((list) => {
        const sorted = sortDialogs(list)
        setDialogs(sorted)
        setActiveThreadId((prev) => {
          if (prev && sorted.some((d) => d.thread_id === prev)) return prev
          return sorted[0]?.thread_id ?? null
        })
        notifyNotificationsUpdated()
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        if (!silent) setLoadingDialogs(false)
      })
  }, [])

  const markThreadReadLocal = useCallback((threadId: number, lastMessageId: number) => {
    setDialogs((prev) => patchDialog(prev, threadId, { unread_count: 0 }))
    api.chat.markRead(threadId, lastMessageId).then(() => notifyChatUpdated()).catch(() => {})
  }, [])

  const loadMessages = useCallback(
    (threadId: number) => {
      setLoadingMessages(true)
      api.chat
        .messages(threadId)
        .then((msgs) => {
          setMessages(msgs)
          const last = msgs[msgs.length - 1]
          if (last) {
            markThreadReadLocal(threadId, last.id)
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoadingMessages(false))
    },
    [markThreadReadLocal],
  )

  useEffect(() => {
    loadDialogs()
    const t = setInterval(() => loadDialogs(true), 15000)
    return () => clearInterval(t)
  }, [loadDialogs])

  useEffect(() => {
    if (activeThreadId == null) {
      setMessages([])
      return
    }
    loadMessages(activeThreadId)
    const t = setInterval(() => loadMessages(activeThreadId), 5000)
    return () => clearInterval(t)
  }, [activeThreadId, loadMessages])

  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pendingPhotos])

  const selectDialog = (threadId: number) => {
    setActiveThreadId(threadId)
    setError(null)
    setLightboxIndex(null)
    clearPendingPhotos()
    setDialogs((prev) => patchDialog(prev, threadId, { unread_count: 0 }))
  }

  const handlePickPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (!picked.length) return

    setPendingPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length
      if (room <= 0) {
        setError(`Можно прикрепить не более ${MAX_PHOTOS} фото`)
        return prev
      }
      const next = picked.slice(0, room).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }))
      if (picked.length > room) {
        setError(`Добавлено ${room} из ${picked.length}: лимит ${MAX_PHOTOS} фото`)
      } else {
        setError(null)
      }
      return [...prev, ...next]
    })
  }

  const removePendingPhoto = (id: string) => {
    setPendingPhotos((prev) => {
      const item = prev.find((p) => p.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  const applySentMessage = async (threadId: number, msg: ChatMessageOut) => {
    setMessages((prev) => [...prev, msg])
    setDialogs((prev) =>
      patchDialog(prev, threadId, {
        last_message_body: msg.body,
        last_message_at: msg.created_at,
        last_message_is_system: false,
        unread_count: 0,
      }),
    )
    await api.chat.markRead(threadId, msg.id)
    notifyChatUpdated()
  }

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (activeThreadId == null || !canSend) return
    setSending(true)
    setError(null)
    const body = text.trim()
    const files = pendingPhotos.map((p) => p.file)
    try {
      const msg =
        files.length > 0
          ? await api.chat.sendWithPhotos(activeThreadId, files, body || undefined)
          : await api.chat.send(activeThreadId, body)
      setText('')
      clearPendingPhotos()
      await applySentMessage(activeThreadId, msg)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-page">
      <div className="page-title" style={{ marginBottom: 12 }}>
        <h2>Чат</h2>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm mb-3">
          {error}
        </div>
      )}

      <div className="chat-columns">
        <div className="chat-col chat-col-agents">
          <div className="chat-col-header">{agentsColumnTitle}</div>
          <div className="chat-col-body">
            {loadingDialogs && dialogs.length === 0 ? (
              <p className="chat-empty">Загрузка…</p>
            ) : dialogs.length === 0 ? (
              <p className="chat-empty">
                {isAgent ? 'Менеджер не назначен.' : 'В команде пока нет агентов.'}
              </p>
            ) : (
              <ul className="chat-agent-list">
                {dialogs.map((d) => (
                  <li key={d.thread_id}>
                    <button
                      type="button"
                      className={`chat-agent-item${d.thread_id === activeThreadId ? ' active' : ''}`}
                      onClick={() => selectDialog(d.thread_id)}
                    >
                      <div className="chat-agent-avatar" aria-hidden>
                        {userInitial(d.peer_name)}
                      </div>
                      <div className="chat-agent-body">
                        <div className="chat-agent-row">
                          <span className="chat-agent-name">{d.peer_name}</span>
                          {d.unread_count > 0 && (
                            <span className="chat-agent-badge">
                              {d.unread_count > 99 ? '99+' : d.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="chat-agent-nic">{d.peer_nic}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="chat-col chat-col-dialog">
          <div className="chat-col-header">
            {activeDialog ? (
              <div className="chat-dialog-header">
                <div className="chat-agent-avatar chat-agent-avatar--header" aria-hidden>
                  {userInitial(activeDialog.peer_name)}
                </div>
                <div>
                  <div>{activeDialog.peer_name}</div>
                  <div className="chat-agent-nic">{activeDialog.peer_nic}</div>
                </div>
              </div>
            ) : (
              <span className="chat-dialog-header-placeholder">Диалог</span>
            )}
          </div>

          <div className="chat-col-body">
            {!activeDialog ? (
              <div className="chat-empty chat-empty-center">
                {isAgent ? 'Выберите менеджера слева' : 'Выберите агента слева'}
              </div>
            ) : (
              <div className="chat-dialog-content">
                <div className="chat-feed" ref={feedRef}>
                  {loadingMessages && messages.length === 0 ? (
                    <p className="chat-empty">Загрузка сообщений…</p>
                  ) : messages.length === 0 ? (
                    <p className="chat-empty">Напишите первое сообщение</p>
                  ) : (
                    messages.map((m) => {
                      const attachments = m.attachments || []
                      const hideAutoPhotoCaption =
                        attachments.length > 0 &&
                        (m.body === '📷 Фото' || m.body === `📷 ${attachments.length} фото`)

                      return (
                        <div
                          key={m.id}
                          className={`chat-message${m.is_system ? ' chat-message--system' : ''}${
                            !m.is_system && m.sender_user_id === user?.id ? ' chat-message--own' : ''
                          }${attachments.length > 0 ? ' chat-message--with-photos' : ''}`}
                        >
                          {!m.is_system && (
                            <div className="chat-message-meta">
                              {m.sender_name || 'Вы'} · {formatTime(m.created_at)}
                            </div>
                          )}
                          {attachments.length > 0 && (
                            <div
                              className={`chat-message-photos chat-message-photos--${Math.min(attachments.length, 4)}`}
                            >
                              {attachments.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  className="chat-message-photo-link"
                                  onClick={() => openLightbox(a.id)}
                                  aria-label={`Открыть фото ${a.filename}`}
                                >
                                  <img
                                    src={api.chat.attachmentImageUrl(a.id)}
                                    alt={a.filename}
                                    className="chat-message-photo"
                                    loading="lazy"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                          {m.body && !hideAutoPhotoCaption && (
                            <div className="chat-message-body">{m.body}</div>
                          )}
                          {m.is_system && m.link_path && (
                            <Link to={m.link_path} className="chat-message-link">
                              Открыть клиента
                            </Link>
                          )}
                          {m.is_system && (
                            <div className="chat-message-time">{formatTime(m.created_at)}</div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                <form className="chat-compose" onSubmit={send}>
                  {pendingPhotos.length > 0 && (
                    <div className="chat-compose-photos">
                      {pendingPhotos.map((p) => (
                        <div key={p.id} className="chat-compose-photo">
                          <img src={p.preview} alt="" className="chat-compose-photo-img" />
                          <button
                            type="button"
                            className="chat-compose-photo-remove"
                            onClick={() => removePendingPhoto(p.id)}
                            aria-label="Убрать фото"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="chat-compose-row">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      className="chat-compose-file"
                      onChange={handlePickPhotos}
                    />
                    <button
                      type="button"
                      className="btn btn-default chat-compose-attach"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending || pendingPhotos.length >= MAX_PHOTOS}
                      title="Прикрепить фото"
                    >
                      📷
                    </button>
                    <input
                      className="chat-compose-input"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Сообщение…"
                      disabled={sending}
                    />
                    <button type="submit" className="btn btn-success" disabled={sending || !canSend}>
                      {sending ? '…' : 'Отправить'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxIndex != null && lightboxItems.length > 0 && (
        <ChatPhotoLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  )
}

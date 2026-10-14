type Props = {
  expanded: boolean
  onClick: () => void
  className?: string
  title?: string
}

/** Кнопка «бургер»: свернуть / развернуть боковое и верхнее меню. */
export function ChromeBurgerButton({ expanded, onClick, className, title }: Props) {
  return (
    <button
      type="button"
      className={className ?? 'btn btn-default gentelella-chrome-burger-btn'}
      onClick={onClick}
      title={title ?? (expanded ? 'Свернуть меню' : 'Развернуть меню')}
      aria-label={title ?? (expanded ? 'Свернуть меню' : 'Развернуть меню')}
      aria-expanded={expanded}
    >
      <span className="gentelella-chrome-burger-icon" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </button>
  )
}

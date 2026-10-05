import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { User } from '../types'

interface Props {
  user: User | null
  initials: string
  isGuided: boolean
  onProfile: () => void
  onSwitch: () => void
  onReturn: () => void
}

export default function AccountMenu({ user, initials, isGuided, onProfile, onSwitch, onReturn }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const isAdmin = user?.role === 'admin'
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const keydown = (event: KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    if (event.key === 'Tab') close()
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }
  const select = (callback: () => void) => { close(); callback() }
  return <div ref={root} className="relative flex-1 min-w-0" onKeyDown={keydown}>
    <button ref={trigger} type="button" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen(value => !value)}
      onKeyDown={event => {
        if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true) }
      }}
      className="flex min-h-[44px] w-full items-center gap-2 text-left group">
      <span className="w-7 h-7 rounded-full bg-track flex items-center justify-center flex-shrink-0">
        <span className="text-[11px] font-semibold text-ink-2 font-mono">{initials}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink truncate leading-tight group-hover:text-accent">{user?.first_name} {user?.last_name}</span>
        <span className="block text-[11px] text-faint leading-tight">{isAdmin ? 'Teacher' : isGuided ? 'Student session' : 'Student'}</span>
      </span>
    </button>
    {open && <div ref={menu} role="menu" aria-label="Account" className="absolute bottom-full left-0 mb-2 w-48 rounded-card border border-line bg-panel shadow-menu p-1 z-[60]">
      <button role="menuitem" className="w-full min-h-[44px] text-left px-3 rounded-field text-sm hover:bg-track" onClick={() => select(onProfile)}>Profile</button>
      {isAdmin && <button role="menuitem" className="w-full min-h-[44px] text-left px-3 rounded-field text-sm hover:bg-track" onClick={() => select(onSwitch)}>Switch to Student</button>}
      {isGuided && <button role="menuitem" className="w-full min-h-[44px] text-left px-3 rounded-field text-sm hover:bg-track" onClick={() => select(onReturn)}>Return to Parent/Teacher</button>}
    </div>}
  </div>
}

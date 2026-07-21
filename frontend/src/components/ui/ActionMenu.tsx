/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { useEffect, useRef, useState } from 'react'

interface ActionMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

export type ActionMenuEntry = ActionMenuItem | 'separator'

interface ActionMenuProps {
  items: ActionMenuEntry[]
  ariaLabel: string
  /** Desktop-only: keep the trigger invisible until the row is hovered. */
  revealOnHover?: boolean
}

/** The canonical ⋯ dropdown: outside-click + Escape close, danger items. */
const ActionMenu: React.FC<ActionMenuProps> = ({ items, ariaLabel, revealOnHover = false }) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`w-[30px] h-[30px] border border-line bg-panel rounded-[7px] text-muted flex items-center justify-center text-[16px] leading-none hover:bg-track transition-colors ${
          revealOnHover && !open ? 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity' : ''
        }`}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-[34px] z-20 bg-panel border border-field-border rounded-[10px] shadow-menu p-1 w-40 animate-pop">
          {items.map((item, i) =>
            item === 'separator' ? (
              <div key={i} className="h-px bg-line-2 my-1 mx-1.5" />
            ) : (
              <button
                key={i}
                onClick={() => { setOpen(false); item.onSelect() }}
                className={`w-full text-left px-2.5 py-2 text-[13px] hover:bg-track rounded-[6px] ${
                  item.danger ? 'text-danger' : 'text-ink-2'
                }`}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default ActionMenu

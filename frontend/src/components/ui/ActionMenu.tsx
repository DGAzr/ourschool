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

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MENU_GAP = 4
const VIEWPORT_PADDING = 8

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
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return

    const positionMenu = () => {
      const trigger = rootRef.current
      const menu = menuRef.current
      if (!trigger || !menu) return

      const triggerRect = trigger.getBoundingClientRect()
      const menuWidth = menu.offsetWidth
      const menuHeight = menu.offsetHeight
      const spaceBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_PADDING
      const spaceAbove = triggerRect.top - VIEWPORT_PADDING
      const openAbove = menuHeight > spaceBelow && spaceAbove > spaceBelow

      const left = Math.min(
        Math.max(VIEWPORT_PADDING, triggerRect.right - menuWidth),
        window.innerWidth - menuWidth - VIEWPORT_PADDING,
      )
      const preferredTop = openAbove
        ? triggerRect.top - menuHeight - MENU_GAP
        : triggerRect.bottom + MENU_GAP
      const top = Math.min(
        Math.max(VIEWPORT_PADDING, preferredTop),
        window.innerHeight - menuHeight - VIEWPORT_PADDING,
      )

      menu.style.left = `${left}px`
      menu.style.top = `${top}px`
      menu.style.visibility = 'visible'
      menu.style.transformOrigin = openAbove ? 'bottom right' : 'top right'
    }

    positionMenu()
    window.addEventListener('resize', positionMenu)
    document.addEventListener('scroll', positionMenu, true)
    return () => {
      window.removeEventListener('resize', positionMenu)
      document.removeEventListener('scroll', positionMenu, true)
    }
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
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
        className={`w-[44px] h-[44px] sm:w-[34px] sm:h-[34px] lg:w-[30px] lg:h-[30px] border border-line bg-panel rounded-[7px] text-muted flex items-center justify-center text-[16px] leading-none hover:bg-track transition-colors ${
          revealOnHover && !open ? 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity' : ''
        }`}
      >
        ⋯
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[100] invisible bg-panel border border-field-border rounded-[10px] shadow-menu p-1 w-40 max-h-[calc(100vh-1rem)] overflow-y-auto animate-pop"
        >
          {items.map((item, i) =>
            item === 'separator' ? (
              <div key={i} role="separator" className="h-px bg-line-2 my-1 mx-1.5" />
            ) : (
              <button
                key={i}
                role="menuitem"
                onClick={() => { setOpen(false); item.onSelect() }}
                className={`w-full text-left px-2.5 py-2 text-[13px] hover:bg-track rounded-[6px] ${
                  item.danger ? 'text-danger' : 'text-ink-2'
                }`}
              >
                {item.label}
              </button>
            )
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default ActionMenu

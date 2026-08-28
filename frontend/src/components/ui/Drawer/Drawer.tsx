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

import React, { ReactNode, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useOverlayFocus } from '../useOverlayFocus'

interface DrawerProps {
  /** Whether the drawer is open and visible */
  isOpen: boolean
  /** Called when the drawer requests to close (ESC, scrim click, close button) */
  onClose: () => void
  /** Title shown in the header */
  title?: string
  /** Optional second line under the title */
  subtitle?: string
  /** Body content (scrolls between the sticky header and footer) */
  children: ReactNode
  /** Sticky footer actions (usually <Button>s). Omit for footer-less drawers. */
  footer?: ReactNode
  /** Show the header X button @default true */
  showCloseButton?: boolean
  /** Close when the scrim is clicked @default true */
  closeOnOverlayClick?: boolean
  /**
   * Wide layout: ~50% of the viewport (min 440px) with a lighter scrim/blur so
   * the content behind stays readable. @default false (fixed 440px, 2px blur)
   */
  wide?: boolean
}

/**
 * A right-side slide-over panel — the Modal shell's sibling for wider,
 * form-heavy content (the Lesson Editor). Same scrim / Esc / scroll-lock /
 * focus-restore behavior as Modal, but fixed to the right edge with a slide-in
 * entrance and a scrollable body under a sticky header + footer.
 */
const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
  wide = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useOverlayFocus(isOpen, panelRef, onClose)

  if (!isOpen) return null

  const handleScrim = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) onClose()
  }

  const hasHeader = !!(title || showCloseButton)

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-end animate-fade-in motion-reduce:animate-none ${
        wide
          ? 'bg-overlay/50 backdrop-blur-[1px]'
          : 'bg-overlay backdrop-blur-[2px]'
      }`}
      onClick={handleScrim}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Drawer'}
        tabIndex={-1}
        className={`relative z-10 max-w-full h-full flex flex-col bg-panel border-l border-line shadow-[-18px_0_50px_var(--shadow-lg)] animate-drawer-in motion-reduce:animate-none ${
          wide ? 'w-full sm:min-w-[440px] lg:w-[50vw]' : 'w-full sm:w-[440px]'
        }`}
      >
        {hasHeader && (
          <div className="flex items-start gap-3 px-5 py-4 border-b border-line-2 flex-shrink-0">
            <div className="flex-1 min-w-0">
              {title && (
                <h3 id={titleId} className="text-[15.5px] font-semibold text-ink tracking-[-0.01em] leading-tight">
                  {title}
                </h3>
              )}
              {subtitle && <p className="text-[12.5px] text-muted mt-0.5">{subtitle}</p>}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 w-[44px] h-[44px] sm:w-[30px] sm:h-[30px] rounded-lg flex items-center justify-center text-muted hover:bg-line-2 hover:text-ink transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-[18px]">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-5 py-[14px] border-t border-line-2 bg-panel-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default Drawer

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

/**
 * The single modal size scale. sm 420 / md 520 / lg 640.
 * (Replaces the ad-hoc max-w-md / lg / 2xl picked per modal.)
 */
const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[640px]',
}

export type ModalIconVariant = 'accent' | 'danger' | 'warn' | 'pos' | 'dark'

const ICON_TILE: Record<ModalIconVariant, string> = {
  accent: 'bg-accent-soft text-accent',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
  pos: 'bg-pos-soft text-pos',
  dark: 'bg-btn-primary-bg text-btn-primary-fg',
}

interface ModalProps {
  /** Whether the modal is open and visible */
  isOpen: boolean
  /** Called when the modal requests to close (ESC, scrim click, close button) */
  onClose: () => void
  /** Title shown in the header */
  title?: string
  /** Optional second line under the title */
  subtitle?: string
  /** Optional leading icon glyph (a lucide icon element) */
  icon?: ReactNode
  /** Tint for the icon tile @default 'accent' */
  iconVariant?: ModalIconVariant
  /** Width token @default 'md' */
  size?: 'sm' | 'md' | 'lg'
  /** Body content */
  children: ReactNode
  /** Right-aligned footer actions (usually <Button>s). Omit for footer-less modals. */
  footer?: ReactNode
  /** Show the header X button @default true */
  showCloseButton?: boolean
  /** Close when the scrim is clicked @default true */
  closeOnOverlayClick?: boolean
}

/**
 * The unified OurSchool modal shell.
 *
 * One scrim (bg-overlay + 2px blur), one radius (14px), one shadow, one header layout,
 * one close button, one footer, and a transform-only entrance animation.
 *
 * Every dialog in the app is built on this — form modals pass fields as `children` and
 * actions as `footer`; ConfirmDialog wraps this with size="sm" + an icon tile.
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconVariant = 'accent',
  size = 'md',
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useOverlayFocus(isOpen, panelRef, onClose)

  if (!isOpen) return null

  const handleScrim = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) onClose()
  }

  const hasHeader = !!(title || icon || showCloseButton)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-[2px]"
      onClick={handleScrim}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={`relative z-10 w-full ${SIZE[size]} max-h-[88vh] flex flex-col bg-panel border border-line rounded-[14px] shadow-[0_28px_70px_var(--shadow-lg)] overflow-hidden animate-modal-in motion-reduce:animate-none`}
      >
        {hasHeader && (
          <div className="flex items-start gap-3 px-5 py-4 border-b border-line-2 flex-shrink-0">
            {icon && (
              <span
                className={`flex-shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center ${ICON_TILE[iconVariant]}`}
              >
                {icon}
              </span>
            )}
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

export default Modal

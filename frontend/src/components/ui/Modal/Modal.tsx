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

import React, { ReactNode, useEffect } from 'react'
import { MODAL_SIZES } from '../../../constants'

/**
 * Props for the Modal component
 */
interface ModalProps {
  /** Whether the modal is currently open and visible */
  isOpen: boolean
  /** Callback function called when the modal should be closed */
  onClose: () => void
  /** Optional title to display in the modal header */
  title?: string
  /** Size variant of the modal @default 'lg' */
  size?: keyof typeof MODAL_SIZES
  /** Content to display inside the modal */
  children: ReactNode
  /** Whether to show the X close button in the header @default true */
  showCloseButton?: boolean
  /** Whether clicking the overlay should close the modal @default true */
  closeOnOverlayClick?: boolean
}

/**
 * A flexible modal dialog component with overlay, keyboard navigation, and accessibility features.
 * 
 * Features:
 * - Keyboard navigation (ESC to close)
 * - Click outside to close (configurable)
 * - Body scroll lock when open
 * - Multiple size variants
 * - Accessible focus management
 * 
 * @component
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 * 
 * <Modal 
 *   isOpen={isOpen} 
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   size="md"
 * >
 *   <p>Are you sure you want to proceed?</p>
 *   <div className="flex gap-2 mt-4">
 *     <Button onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button variant="danger" onClick={handleConfirm}>Confirm</Button>
 *   </div>
 * </Modal>
 * ```
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'lg',
  children,
  showCloseButton = true,
  closeOnOverlayClick = true
}) => {
  /**
   * Effect to handle keyboard navigation and body scroll lock
   * Sets up ESC key listener and prevents body scrolling when modal is open
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  /**
   * Handles clicks on the modal overlay
   * Closes modal if click is on overlay (not content) and closeOnOverlayClick is enabled
   */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="fixed inset-0" 
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg ${MODAL_SIZES[size]} w-full max-h-[90vh] overflow-y-auto relative z-10 shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            {title && (
              <h3 
                id="modal-title" 
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
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

import React, { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal, { ModalIconVariant } from '../Modal/Modal'
import Button from '../Button'

type ConfirmTone = 'danger' | 'warn' | 'default'

/** tone → icon tile variant + note-box classes + primary button variant */
const TONE: Record<
  ConfirmTone,
  { icon: ModalIconVariant; note: string; primary: 'primary' | 'danger' }
> = {
  // Destructive. Red primary is reserved for this tone only.
  danger: {
    icon: 'danger',
    note: 'bg-danger-soft border-danger-line text-ink-2',
    primary: 'danger',
  },
  // Reversible / cautionary (e.g. Archive). Dark-ink primary — NOT red.
  warn: {
    icon: 'warn',
    note: 'bg-warn-soft border-warn-line text-ink-2',
    primary: 'primary',
  },
  // Neutral confirmation.
  default: {
    icon: 'accent',
    note: 'bg-panel-2 border-line text-ink-2',
    primary: 'primary',
  },
}

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  /** Header title, e.g. "Delete assignment template" */
  title: string
  /** Body message — string or rich nodes (use <strong> for the target name) */
  message: ReactNode
  /** Optional emphasized note rendered in a tinted box (e.g. "assigned to 3 students") */
  note?: ReactNode
  /** Visual tone @default 'danger' */
  tone?: ConfirmTone
  /** Primary button label @default 'Confirm' */
  confirmLabel?: string
  /** Secondary button label @default 'Cancel' */
  cancelLabel?: string
  /** Disable buttons + show spinner on confirm while the async action runs */
  loading?: boolean
  /** Override the leading icon (defaults to AlertTriangle) */
  icon?: ReactNode
}

/**
 * The single confirmation dialog. Replaces the inline delete/archive confirms that were
 * hand-written in Assignments.tsx with raw red-600 / yellow-600 / gray-800 + a ⚠️ emoji.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  note,
  tone = 'danger',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  icon,
}) => {
  const t = TONE[tone]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      icon={icon ?? <AlertTriangle size={15} />}
      iconVariant={t.icon}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={t.primary} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <p className="text-[13.5px] text-ink-2 leading-relaxed">{message}</p>
        {note && (
          <div
            className={`flex items-start gap-2.5 rounded-[11px] border px-3.5 py-3 text-[12.5px] leading-snug ${t.note}`}
          >
            <AlertTriangle size={14} className="flex-shrink-0 mt-px" />
            <span>{note}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ConfirmDialog

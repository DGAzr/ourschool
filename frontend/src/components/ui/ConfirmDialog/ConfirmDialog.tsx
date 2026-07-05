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

import React, { ReactNode, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal, { ModalIconVariant } from '../Modal/Modal'
import Button from '../Button'
import Input from '../Input'

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
  /**
   * Retype-to-confirm: when set, an input is rendered and the confirm button
   * stays disabled until the user types this exact phrase.
   */
  confirmText?: string
}

/**
 * The single confirmation dialog. Replaces the inline delete/archive confirms that were
 * hand-written in Assignments.tsx with raw red-600 / yellow-600 / gray-800 + a ⚠️ emoji.
 *
 * The outer component remounts the core on every open/close so the
 * retype-to-confirm input starts blank each time (no state-sync effect).
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = (props) => (
  <ConfirmDialogCore key={props.isOpen ? 'open' : 'closed'} {...props} />
)

const ConfirmDialogCore: React.FC<ConfirmDialogProps> = ({
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
  confirmText,
}) => {
  const t = TONE[tone]
  const [typed, setTyped] = useState('')
  const confirmBlocked = confirmText !== undefined && typed !== confirmText

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
          <Button
            variant={t.primary}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmBlocked}
          >
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
        {confirmText !== undefined && (
          <Input
            label={`Type "${confirmText}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            autoComplete="off"
            disabled={loading}
          />
        )}
      </div>
    </Modal>
  )
}

export default ConfirmDialog

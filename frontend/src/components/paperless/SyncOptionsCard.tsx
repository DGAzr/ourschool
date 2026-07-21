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

import React from 'react'
import { RefreshCw } from 'lucide-react'

import Toggle from '../ui/Toggle'
import {
  PaperlessSettingsUpdate,
  PaperlessStatus,
} from '../../types/paperless'

interface SyncOptionsCardProps {
  status: PaperlessStatus
  onUpdate: (update: PaperlessSettingsUpdate) => void
}

interface OptionRow {
  key: 'auto_import' | 'index_ocr' | 'mapped_only'
  label: string
  description: string
}

const OPTIONS: OptionRow[] = [
  {
    key: 'auto_import',
    label: 'Auto-import new documents',
    description:
      'Refresh the library automatically when it goes stale (about every 15 minutes while in use).',
  },
  {
    key: 'index_ocr',
    label: 'Index OCR text for matching',
    description:
      'Required for objective-match suggestions — keywords from each document’s scanned text feed the ranking.',
  },
  {
    key: 'mapped_only',
    label: 'Only import mapped subjects',
    description:
      'Skip documents whose tags aren’t mapped to a subject. Takes effect on the next sync.',
  },
]

/** Three labeled toggle rows; PATCHes on change (optimistic in the hook). */
const SyncOptionsCard: React.FC<SyncOptionsCardProps> = ({ status, onUpdate }) => (
  <div className="bg-panel border border-line rounded-card p-6">
    <div className="flex items-center gap-2 mb-4">
      <RefreshCw className="h-4 w-4 text-faint" />
      <h2 className="text-[15px] font-semibold text-ink">Sync options</h2>
    </div>

    <div className="space-y-5">
      {OPTIONS.map((option) => (
        <div key={option.key} className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-[13.5px] font-semibold text-ink">
              {option.label}
            </h3>
            <p className="text-[13px] text-muted mt-0.5">{option.description}</p>
          </div>
          <Toggle
            aria-label={option.label}
            checked={status[option.key]}
            onChange={(checked) => onUpdate({ [option.key]: checked })}
            className="mt-0.5 flex-shrink-0"
          />
        </div>
      ))}
    </div>
  </div>
)

export default SyncOptionsCard

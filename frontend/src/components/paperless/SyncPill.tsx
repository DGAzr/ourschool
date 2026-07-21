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

import { formatRelativeTime } from '../materials/materialsLogic'

interface SyncPillProps {
  lastSyncAt?: string | null
  /** Shows an error dot/label when the last sync failed. */
  status?: string | null
}

/** Monospace sync-state pill: green dot + "SYNCED 4M AGO". */
const SyncPill: React.FC<SyncPillProps> = ({ lastSyncAt, status }) => {
  const failed = status === 'error'
  // "partial": the listing hit the sync's page cap, so absent-document
  // detection was skipped — a caution dot, not a failure.
  const partial = status === 'partial'
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-pill border border-line bg-panel-2 font-mono text-[10px] font-semibold tracking-wide text-muted">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: failed
            ? 'var(--danger)'
            : partial
              ? 'var(--warn)'
              : 'var(--pos-fg)',
        }}
      />
      {failed
        ? 'SYNC FAILED'
        : partial
          ? 'PARTIAL SYNC'
          : `SYNCED ${formatRelativeTime(lastSyncAt).toUpperCase()}`}
    </span>
  )
}

export default SyncPill

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

import React, { useState } from 'react'
import { AlertTriangle, Check, RefreshCw } from 'lucide-react'

import { Button } from '../ui'
import ConfirmDialog from '../ui/ConfirmDialog'
import { PaperlessStatus } from '../../types/paperless'
import { formatRelativeTime } from '../materials/materialsLogic'

interface ConnectedStatusCardProps {
  status: PaperlessStatus
  syncing: boolean
  onSyncNow: () => void
  onEdit: () => void
  onDisconnect: () => Promise<void>
}

/** Connected state: ✓ tile, host, last-sync line, Sync now, token row + Edit/Disconnect. */
const ConnectedStatusCard: React.FC<ConnectedStatusCardProps> = ({
  status,
  syncing,
  onSyncNow,
  onEdit,
  onDisconnect,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setDisconnecting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="bg-panel border border-line rounded-card overflow-hidden">
      <div className="p-6 flex items-start gap-4">
        <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center bg-pos-bg text-pos-fg flex-shrink-0">
          <Check size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-[15px] font-semibold text-ink">Connected</h2>
            <span className="font-mono text-[12px] text-muted truncate">
              {status.url}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            Last sync {formatRelativeTime(status.last_sync_at)} ·{' '}
            {status.document_count} documents · {status.mapped_subject_count}{' '}
            subjects
          </p>
          {status.last_sync_status === 'error' && status.last_sync_error && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-neg-fg">
              <AlertTriangle size={13} className="flex-shrink-0" />
              Last sync failed: {status.last_sync_error}
            </p>
          )}
          {status.last_sync_status === 'partial' && status.last_sync_error && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warn">
              <AlertTriangle size={13} className="flex-shrink-0" />
              {status.last_sync_error}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={onSyncNow}
          loading={syncing}
          icon={<RefreshCw className="h-4 w-4" />}
          className="flex-shrink-0"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>

      <div className="px-6 py-3.5 bg-panel-2 border-t border-line flex items-center justify-between gap-4">
        <span className="font-mono text-[12px] text-faint">
          API token {status.token_masked}
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={onEdit}
            className="text-[12.5px] font-medium text-muted hover:text-ink transition-colors"
          >
            Edit connection
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="text-[12.5px] font-medium text-muted hover:text-danger transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Paperless-NGX"
        message={
          <>
            Remove the connection to <strong>{status.url}</strong>?
          </>
        }
        note="Documents already attached to lessons and assignments keep rendering from the local cache. Reconnecting re-syncs the library."
        tone="warn"
        confirmLabel="Disconnect"
        loading={disconnecting}
      />
    </div>
  )
}

export default ConnectedStatusCard

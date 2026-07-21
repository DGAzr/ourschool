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

import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { usePaperlessStatus } from '../../hooks/usePaperlessStatus'
import { subjectsApi } from '../../services/subjects'
import { getErrorMessage } from '../../services/api'
import { Subject } from '../../types/subject'
import { MaterialKind } from '../../types/paperless'
import { Spinner, useToast } from '../ui'
import ConnectCard from './ConnectCard'
import ConnectedStatusCard from './ConnectedStatusCard'
import ScopeCard from './ScopeCard'
import TagMapCard from './TagMapCard'
import DoctypeMapCard from './DoctypeMapCard'
import SyncOptionsCard from './SyncOptionsCard'

/**
 * Self-contained Paperless-NGX management body: connect card when
 * disconnected, otherwise the status/scope/mapping/sync cards. Rendered both
 * on the standalone settings page and inside the Admin Center's Integrations
 * shelf. Status lives in the shared PaperlessStatusProvider, so parents (nav,
 * Admin shelf badge) update on their own — no status callback needed.
 */
const PaperlessIntegrationPanel: React.FC = () => {
  const { toast } = useToast()
  const {
    status,
    loading,
    error,
    syncing,
    connect,
    disconnect,
    syncNow,
    updateSettings,
  } = usePaperlessStatus()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    subjectsApi
      .getAll()
      .then(setSubjects)
      .catch(() => setSubjects([]))
  }, [])

  const handleConnect = async (
    url: string,
    token: string,
    scopeTagIds: number[],
    scopeDoctypeIds: number[]
  ) => {
    await connect(url, token, scopeTagIds, scopeDoctypeIds)
    setEditing(false)
    toast(
      editing
        ? 'Connection updated — library re-synced'
        : 'Connected to Paperless — library imported'
    )
  }

  const handleScopeSave = async (tagIds: number[], doctypeIds: number[]) => {
    try {
      await updateSettings({
        scope_tag_ids: tagIds,
        scope_doctype_ids: doctypeIds,
      })
      const result = await syncNow()
      toast(`Scope saved — synced ${result.document_count} documents`)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not update the sync scope'), 'danger')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast('Paperless disconnected')
    } catch (err) {
      toast(getErrorMessage(err, 'Disconnect failed'), 'danger')
    }
  }

  const handleSyncNow = async () => {
    try {
      const result = await syncNow()
      // The partial detail (cap hit, what was skipped) shows on the status
      // card via last_sync_status/error.
      toast(
        result.truncated
          ? `Synced ${result.document_count} documents — partial sync`
          : `Synced ${result.document_count} documents`
      )
    } catch (err) {
      toast(getErrorMessage(err, 'Sync failed'), 'danger')
    }
  }

  const handleToggle = async (update: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(update)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not save setting'), 'danger')
    }
  }

  const handleTagRemap = (paperlessTagId: number, subjectId: number | null) =>
    handleToggle({ tag_maps: [{ paperless_tag_id: paperlessTagId, subject_id: subjectId }] })

  const handleDoctypeRemap = (paperlessDoctypeId: number, kind: MaterialKind) =>
    handleToggle({
      doctype_maps: [
        { paperless_doctype_id: paperlessDoctypeId, material_kind: kind },
      ],
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted">
        <Spinner size="sm" />
        Loading connection…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  // Connected + editing: reuse the connect card to change URL/token in place.
  if (status?.connected && editing) {
    return (
      <div className="space-y-6">
        <ConnectCard
          editing
          initialUrl={status.url ?? undefined}
          initialScope={{
            tagIds: status.scope_tag_ids,
            doctypeIds: status.scope_doctype_ids,
          }}
          onCancel={() => setEditing(false)}
          onConnect={handleConnect}
        />
      </div>
    )
  }

  if (!status?.connected) {
    return (
      <ConnectCard
        needsReconnect={status?.needs_reconnect}
        initialScope={
          status?.needs_reconnect
            ? {
                tagIds: status.scope_tag_ids,
                doctypeIds: status.scope_doctype_ids,
              }
            : undefined
        }
        onConnect={handleConnect}
      />
    )
  }

  return (
    <div className="space-y-6">
      <ConnectedStatusCard
        status={status}
        syncing={syncing}
        onSyncNow={handleSyncNow}
        onEdit={() => setEditing(true)}
        onDisconnect={handleDisconnect}
      />
      <ScopeCard status={status} syncing={syncing} onSave={handleScopeSave} />
      <TagMapCard
        tagMaps={status.tag_maps}
        subjects={subjects}
        onRemap={handleTagRemap}
      />
      <DoctypeMapCard doctypeMaps={status.doctype_maps} onRemap={handleDoctypeRemap} />
      <SyncOptionsCard status={status} onUpdate={handleToggle} />
      <p className="text-[12px] text-faint text-center pb-1">
        Read-only access · OurSchool never writes to your Paperless server.
      </p>
    </div>
  )
}

export default PaperlessIntegrationPanel

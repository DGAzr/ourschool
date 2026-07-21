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

import { useCallback, useState } from 'react'

import { paperlessApi } from '../services/paperless'
import { usePaperlessStatusContext } from '../contexts/PaperlessStatusContext'
import {
  PaperlessSettingsUpdate,
  PaperlessStatus,
  PaperlessSyncResult,
} from '../types/paperless'

/**
 * Paperless-NGX connection status + mutations (connect, disconnect, sync,
 * settings). Status itself lives in PaperlessStatusProvider — one fetch shared
 * across the app — and every mutation writes back through the provider, so
 * the nav and any open pickers update the moment a connect/disconnect lands.
 * Toggle updates apply optimistically and roll back on failure.
 */
export const usePaperlessStatus = () => {
  const { status, ready, error, refresh, applyStatus } =
    usePaperlessStatusContext()
  const [syncing, setSyncing] = useState(false)

  const connect = useCallback(
    async (
      url: string,
      token: string,
      scopeTagIds: number[] = [],
      scopeDoctypeIds: number[] = []
    ): Promise<PaperlessStatus> => {
      const next = await paperlessApi.connect(
        url,
        token,
        scopeTagIds,
        scopeDoctypeIds
      )
      applyStatus(next)
      return next
    },
    [applyStatus]
  )

  const disconnect = useCallback(async (): Promise<void> => {
    await paperlessApi.disconnect()
    await refresh()
  }, [refresh])

  const syncNow = useCallback(async (): Promise<PaperlessSyncResult> => {
    setSyncing(true)
    try {
      const result = await paperlessApi.syncNow()
      await refresh()
      return result
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  /**
   * Optimistically apply a settings PATCH (toggles and/or remaps); the
   * server's canonical status replaces the shared state on success, the
   * previous status is restored on failure (the thrown error carries the
   * message).
   */
  const updateSettings = useCallback(
    async (update: PaperlessSettingsUpdate): Promise<void> => {
      const snapshot = status
      if (status) {
        applyStatus({
          ...status,
          auto_import: update.auto_import ?? status.auto_import,
          index_ocr: update.index_ocr ?? status.index_ocr,
          mapped_only: update.mapped_only ?? status.mapped_only,
          scope_tag_ids: update.scope_tag_ids ?? status.scope_tag_ids,
          scope_doctype_ids:
            update.scope_doctype_ids ?? status.scope_doctype_ids,
        })
      }
      try {
        const next = await paperlessApi.updateSettings(update)
        applyStatus(next)
      } catch (err) {
        applyStatus(snapshot)
        throw err
      }
    },
    [status, applyStatus]
  )

  return {
    status,
    loading: !ready,
    error,
    syncing,
    refetch: refresh,
    connect,
    disconnect,
    syncNow,
    updateSettings,
  }
}

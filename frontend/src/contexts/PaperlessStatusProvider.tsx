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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { paperlessApi } from '../services/paperless'
import { getErrorMessage } from '../services/api'
import { PaperlessStatus } from '../types/paperless'
import {
  PaperlessStatusContext,
  type PaperlessStatusContextType,
} from './PaperlessStatusContext'
import { useAuth } from './AuthContext'

/**
 * App-wide Paperless-NGX connection status, fetched once per admin session so
 * consumers (nav, pickers, the Materials page, the settings panel) don't each
 * hit ``/integrations/paperless/status`` independently. Mutations flow back in
 * through ``applyStatus``/``refresh`` (see hooks/usePaperlessStatus), so the
 * nav updates the moment a connect/disconnect succeeds — no polling.
 *
 * The status endpoint is admin-only; for non-admin users the provider settles
 * immediately with a null status (students never need the connection state).
 */
export const PaperlessStatusProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [status, setStatus] = useState<PaperlessStatus | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await paperlessApi.getStatus()
      setStatus(next)
      setError(null)
    } catch (err) {
      setStatus(null)
      setError(getErrorMessage(err, 'Failed to load Paperless status.'))
    } finally {
      setReady(true)
    }
  }, [])

  const applyStatus = useCallback((next: PaperlessStatus | null) => {
    setStatus(next)
    setError(null)
    setReady(true)
  }, [])

  // Fetch (and refetch) whenever the authenticated admin changes. Non-admins
  // never fetch; their view is derived below (null status, always ready).
  useEffect(() => {
    if (!user || !isAdmin) return
    const load = async () => {
      await refresh()
    }
    load()
  }, [user, isAdmin, refresh])

  const value = useMemo<PaperlessStatusContextType>(
    () => ({
      status: isAdmin ? status : null,
      connected: isAdmin && status?.connected === true,
      ready: isAdmin ? ready : true,
      error: isAdmin ? error : null,
      refresh,
      applyStatus,
    }),
    [isAdmin, status, ready, error, refresh, applyStatus]
  )

  return (
    <PaperlessStatusContext.Provider value={value}>
      {children}
    </PaperlessStatusContext.Provider>
  )
}

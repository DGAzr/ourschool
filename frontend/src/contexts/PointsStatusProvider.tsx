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

import { pointsApi } from '../services/points'
import {
  PointsStatusContext,
  type PointsStatusContextType,
} from './PointsStatusContext'
import { useAuth } from './AuthContext'

/**
 * App-wide points-system status, fetched once so consumers (nav, points widgets)
 * don't each hit ``/points/status`` independently. Starts disabled with
 * ``ready`` false; consumers gate on ``ready`` so nothing flickers on load.
 */
export const PointsStatusProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [balanceVersion, setBalanceVersion] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const status = await pointsApi.getSystemStatus()
      setEnabled(status.enabled)
    } catch {
      // Transient failure — keep the last known enabled value.
    } finally {
      setReady(true)
    }
  }, [])

  const notifyBalanceChanged = useCallback(() => {
    setBalanceVersion((v) => v + 1)
  }, [])

  // Fetch (and refetch) whenever the authenticated user changes.
  useEffect(() => {
    if (!user) return
    const load = async () => {
      await refresh()
    }
    load()
  }, [user, refresh])

  const value = useMemo<PointsStatusContextType>(
    () => ({ enabled, ready, balanceVersion, notifyBalanceChanged, refresh }),
    [enabled, ready, balanceVersion, notifyBalanceChanged, refresh]
  )

  return (
    <PointsStatusContext.Provider value={value}>
      {children}
    </PointsStatusContext.Provider>
  )
}

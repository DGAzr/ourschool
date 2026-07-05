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

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { assignmentTypesApi } from '../services/assignmentTypes'
import { type AssignmentTypeConfig } from '../types/assignment'
import { AssignmentTypesContext, type AssignmentTypesContextValue } from './AssignmentTypesContext'
import { useAuth } from './AuthContext'

/** Default icon name used when a type has no configured icon. */
const DEFAULT_TYPE_ICON = 'clipboard-check'

const prettifyKey = (key: string) =>
  key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

export const AssignmentTypesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [loadedTypes, setTypes] = useState<AssignmentTypeConfig[]>([])

  const refresh = useCallback(async () => {
    try {
      const data = await assignmentTypesApi.getAll()
      setTypes(data)
    } catch {
      /* leave the last-known list in place; consumers fall back gracefully */
    }
  }, [])

  // Load (and reload) whenever the authenticated user changes.
  useEffect(() => {
    if (!user) return
    const load = async () => {
      await refresh()
    }
    load()
  }, [user, refresh])

  // Never expose a previous session's list while logged out; the next login
  // refreshes it.
  const types = useMemo(() => (user ? loadedTypes : []), [user, loadedTypes])

  const byKey = useMemo(
    () => Object.fromEntries(types.map(t => [t.key, t])) as Record<string, AssignmentTypeConfig>,
    [types],
  )

  const value = useMemo<AssignmentTypesContextValue>(() => ({
    types,
    byKey,
    getTypeLabel: (key) => (key ? byKey[key]?.name ?? prettifyKey(key) : ''),
    getTypeIcon: (key) => (key ? (byKey[key]?.icon ?? DEFAULT_TYPE_ICON) : DEFAULT_TYPE_ICON),
    getTypeColor: (key) => (key ? byKey[key]?.color : undefined),
    refresh,
  }), [types, byKey, refresh])

  return (
    <AssignmentTypesContext.Provider value={value}>
      {children}
    </AssignmentTypesContext.Provider>
  )
}

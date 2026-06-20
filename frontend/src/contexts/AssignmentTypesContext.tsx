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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { assignmentTypesApi } from '../services/assignmentTypes'
import { type AssignmentTypeConfig } from '../types/assignment'
import { useAuth } from './AuthContext'

// Emoji garnish for the built-in type keys; custom types fall back to a generic
// icon. Kept here so every consumer (cards, tables, list items) is consistent.
const TYPE_EMOJI: Record<string, string> = {
  homework: '📝', project: '🏗️', test: '📊', quiz: '❓', essay: '✍️',
  presentation: '🎤', worksheet: '📄', reading: '📚', practice: '🎯',
}

const prettifyKey = (key: string) =>
  key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

interface AssignmentTypesContextValue {
  types: AssignmentTypeConfig[]
  byKey: Record<string, AssignmentTypeConfig>
  /** Display name for a type key, falling back to a prettified key. */
  getTypeLabel: (key?: string | null) => string
  /** Emoji icon for a type key. */
  getTypeIcon: (key?: string | null) => string
  /** Configured color for a type key, or undefined when unknown. */
  getTypeColor: (key?: string | null) => string | undefined
  /** Re-fetch types (e.g. after the admin edits them). */
  refresh: () => Promise<void>
}

const AssignmentTypesContext = createContext<AssignmentTypesContextValue | undefined>(undefined)

export const AssignmentTypesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [types, setTypes] = useState<AssignmentTypeConfig[]>([])

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
    if (user) refresh()
    else setTypes([])
  }, [user, refresh])

  const byKey = useMemo(
    () => Object.fromEntries(types.map(t => [t.key, t])) as Record<string, AssignmentTypeConfig>,
    [types],
  )

  const value = useMemo<AssignmentTypesContextValue>(() => ({
    types,
    byKey,
    getTypeLabel: (key) => (key ? byKey[key]?.name ?? prettifyKey(key) : ''),
    getTypeIcon: (key) => (key ? TYPE_EMOJI[key] ?? '📋' : '📋'),
    getTypeColor: (key) => (key ? byKey[key]?.color : undefined),
    refresh,
  }), [types, byKey, refresh])

  return (
    <AssignmentTypesContext.Provider value={value}>
      {children}
    </AssignmentTypesContext.Provider>
  )
}

export const useAssignmentTypes = (): AssignmentTypesContextValue => {
  const ctx = useContext(AssignmentTypesContext)
  if (!ctx) {
    throw new Error('useAssignmentTypes must be used within an AssignmentTypesProvider')
  }
  return ctx
}

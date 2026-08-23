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

import { useCallback, useEffect, useState } from 'react'

import { lessonsApi } from '../services/lessons'
import { getErrorMessage } from '../services/api'
import { Lesson, LessonStatus } from '../types/lesson'

interface UseLessonsRange {
  startDate: string
  endDate: string
}

/** One lesson's material flipped to ``isGathered``; other lessons untouched. */
const setMaterialGathered = (
  lessons: Lesson[],
  lessonId: number,
  materialId: number,
  isGathered: boolean
): Lesson[] =>
  lessons.map((l) =>
    l.id === lessonId
      ? {
          ...l,
          materials: l.materials.map((m) =>
            m.id === materialId ? { ...m, is_gathered: isGathered } : m
          ),
        }
      : l
  )

/**
 * Fetch lessons within a date range and expose optimistic mutators for the
 * two Teach-mode interactions (mark taught, toggle a material). Both apply
 * locally, fire the PATCH, and roll back + surface an error on failure —
 * following the services + useState convention (no react-query in this app).
 */
export const useLessons = ({ startDate, endDate }: UseLessonsRange) => {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    return lessonsApi
      .list({ start_date: startDate, end_date: endDate })
      .then((data) => {
        setLessons(data || [])
        setError(null)
      })
      .catch((err) => {
        setError(getErrorMessage(err, 'Failed to load lessons.'))
        setLessons([])
      })
      .finally(() => setLoading(false))
  }, [startDate, endDate])

  const refetch = useCallback(async () => {
    setLoading(true)
    await fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /** Optimistically set a lesson's status; rolls back on failure. */
  const setStatus = useCallback(
    async (lessonId: number, status: LessonStatus): Promise<boolean> => {
      let previous: LessonStatus | undefined
      setLessons((prev) =>
        prev.map((l) => {
          if (l.id !== lessonId) return l
          previous = l.status
          return { ...l, status }
        })
      )
      try {
        const updated = await lessonsApi.setStatus(lessonId, status)
        setLessons((prev) => prev.map((l) => (l.id === lessonId ? updated : l)))
        return true
      } catch {
        if (previous !== undefined) {
          const rollback = previous
          setLessons((prev) =>
            prev.map((l) => (l.id === lessonId ? { ...l, status: rollback } : l))
          )
        }
        return false
      }
    },
    []
  )

  /** Optimistically toggle a lesson's status between ready and taught. */
  const markTaught = useCallback(
    (lesson: Lesson): Promise<boolean> => {
      const next: LessonStatus = lesson.status === 'taught' ? 'ready' : 'taught'
      return setStatus(lesson.id, next)
    },
    [setStatus]
  )

  /**
   * Optimistically apply a drag-and-drop reorder: `orderedIds` is the full
   * top-to-bottom order of `date` after the drop (the moved card, if any, is
   * included). Positions are reassigned locally and the moved card's date is
   * updated, then the PATCH fires; on success the affected day is reconciled
   * from the response (picks up any assignment-sync warnings), on failure the
   * previous state is restored and the error is returned as a warning so the
   * caller's toast explains why the card snapped back.
   */
  const reorder = useCallback(
    async (date: string | null, orderedIds: number[]): Promise<string[]> => {
      let snapshot: Lesson[] = []
      setLessons((prev) => {
        snapshot = prev
        const rank = new Map(orderedIds.map((id, i) => [id, i]))
        return prev.map((l) =>
          rank.has(l.id)
            ? { ...l, date, position: rank.get(l.id)! }
            : l
        )
      })
      try {
        const res = await lessonsApi.reorder(date, orderedIds)
        // Replace the affected day's lessons with the server's canonical rows.
        const updated = new Map(res.lessons.map((l) => [l.id, l]))
        setLessons((prev) => {
          const others = prev.filter(
            (l) => !updated.has(l.id) && !orderedIds.includes(l.id)
          )
          return date === null ? others : [...others, ...res.lessons]
        })
        return res.warnings
      } catch (err) {
        setLessons(snapshot)
        return [getErrorMessage(err, 'Reorder failed — the change was undone')]
      }
    },
    []
  )

  /** Optimistically toggle a material's gathered flag; rolls back on failure. */
  const toggleMaterial = useCallback(
    async (
      lessonId: number,
      materialId: number,
      isGathered: boolean
    ): Promise<boolean> => {
      setLessons((prev) =>
        setMaterialGathered(prev, lessonId, materialId, isGathered)
      )
      try {
        const updated = await lessonsApi.toggleMaterial(
          lessonId,
          materialId,
          isGathered
        )
        setLessons((prev) => prev.map((l) => (l.id === lessonId ? updated : l)))
        return true
      } catch {
        setLessons((prev) =>
          setMaterialGathered(prev, lessonId, materialId, !isGathered)
        )
        return false
      }
    },
    []
  )

  return {
    lessons,
    loading,
    error,
    refetch,
    markTaught,
    toggleMaterial,
    setStatus,
    reorder,
  }
}

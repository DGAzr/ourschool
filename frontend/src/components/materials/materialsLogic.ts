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

/**
 * Pure logic for the Materials library and Paperless surfaces — extracted for
 * unit testing (mirrors shopLogic.ts).
 */

import { MaterialKind, PaperlessDocument } from '../../types/paperless'
import { Lesson } from '../../types/lesson'

/** Display order of material kinds in facet rails and chip rows. */
export const MATERIAL_KIND_ORDER: MaterialKind[] = [
  'worksheet',
  'test',
  'reading',
  'reference',
  'form',
  'other',
]

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  worksheet: 'Worksheet',
  test: 'Test',
  reading: 'Reading',
  reference: 'Reference',
  form: 'Form',
  other: 'Other',
}

/** Monospace type badge text, e.g. "WORKSHEET". */
export const kindBadge = (kind: MaterialKind): string =>
  (MATERIAL_KIND_LABELS[kind] ?? kind).toUpperCase()

/**
 * Facet toggle semantics: clicking a value toggles it in/out of the
 * multi-select; an empty selection means "all".
 */
export const toggleFacetValue = <T>(selected: T[], value: T): T[] =>
  selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value]

/** "never" / "just now" / "4m ago" / "3h ago" / "2d ago" */
export const formatRelativeTime = (
  iso?: string | null,
  now: Date = new Date()
): string => {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never'
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Meta line under a document card, e.g. "WORKSHEET · 4 pp". */
export const documentMeta = (doc: PaperlessDocument): string => {
  const parts = [kindBadge(doc.material_kind)]
  if (doc.page_count) {
    parts.push(`${doc.page_count} pp`)
  }
  return parts.join(' · ')
}

/** Usage line under a document card. */
export const usageLabel = (usedInCount: number): string => {
  if (usedInCount === 0) return 'Not yet used'
  return usedInCount === 1 ? 'Used in 1 lesson' : `Used in ${usedInCount} lessons`
}

/** Result-count line above the grid, e.g. "14 documents". */
export const resultCountLabel = (total: number): string =>
  total === 1 ? '1 document' : `${total} documents`

/** A day's worth of lessons, used to render the "Add to a lesson" popover. */
export interface LessonDateGroup {
  /** The lessons' shared ISO date (YYYY-MM-DD). */
  date: string
  /** Header label, e.g. "Today · Jul 11" or "Mon · Jul 14". */
  label: string
  lessons: Lesson[]
}

/**
 * Sort lessons ascending (date, then position) and group them by date so the
 * "Add to a lesson" popover can render a header per day. Assumes an ISO
 * `date` (YYYY-MM-DD); groups keep their input relative order broken by
 * `position`.
 */
export const groupLessonsByDate = (
  lessons: Lesson[],
  today: string = new Date().toISOString().slice(0, 10)
): LessonDateGroup[] => {
  const sorted = lessons.filter(
    (lesson): lesson is Lesson & { date: string } => lesson.date !== null
  ).sort(
    (a, b) => a.date.localeCompare(b.date) || a.position - b.position
  )
  const groups: LessonDateGroup[] = []
  for (const lesson of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === lesson.date) {
      last.lessons.push(lesson)
    } else {
      groups.push({
        date: lesson.date,
        label: lessonDateLabel(lesson.date, today),
        lessons: [lesson],
      })
    }
  }
  return groups
}

/** "Today · Jul 11" for the current day, otherwise "Mon · Jul 14". */
export const lessonDateLabel = (
  iso: string,
  today: string = new Date().toISOString().slice(0, 10)
): string => {
  // Parse as local time (append T00:00) to avoid a UTC day-shift.
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const monthDay = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  if (iso === today) return `Today · ${monthDay}`
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
  return `${weekday} · ${monthDay}`
}

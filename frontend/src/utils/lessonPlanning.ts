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
 * Pure, unit-testable helpers behind the Lesson Planning board.
 *
 * All date math works on ISO ``YYYY-MM-DD`` strings parsed in LOCAL time (via
 * ``new Date(y, m-1, d)``) — never ``new Date("YYYY-MM-DD")``, which parses as
 * UTC and can shift the weekday/"today" a day in negative-offset zones.
 */

import { Lesson } from '../types/lesson'
import { addDays, parseISO, todayISO } from './dates'

export { todayISO }

export const MIN_DAYS = 5
export const MAX_DAYS = 21
export const DEFAULT_DAYS = 7

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export interface DayInfo {
  iso: string
  weekdayLabel: string
  dayNum: number
  isWeekend: boolean
  isToday: boolean
}

const isWeekendDay = (date: Date): boolean => {
  const wd = date.getDay()
  return wd === 0 || wd === 6
}

/** Clamp a day count into the supported [MIN_DAYS, MAX_DAYS] range. */
export const clampDaysShown = (n: number): number => {
  if (Number.isNaN(n)) return DEFAULT_DAYS
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n)))
}

/**
 * Generate the visible day columns starting at ``rangeStartISO``.
 *
 * Walks calendar days forward, skipping Sat/Sun when ``skipWeekends``, until
 * ``daysShown`` columns are collected (safety-capped at 400 iterations).
 */
export const generateDays = (
  rangeStartISO: string,
  daysShown: number,
  skipWeekends: boolean
): DayInfo[] => {
  const days: DayInfo[] = []
  const today = todayISO()
  let i = 0
  while (days.length < daysShown && i < 400) {
    const iso = addDays(rangeStartISO, i)
    const date = parseISO(iso)
    const weekend = isWeekendDay(date)
    // An explicitly selected weekend remains visible as the anchor column;
    // later weekends in the range still honor the school-days setting.
    if (!(skipWeekends && weekend && i !== 0)) {
      days.push({
        iso,
        weekdayLabel: WEEKDAY_LABELS[date.getDay()],
        dayNum: date.getDate(),
        isWeekend: weekend,
        isToday: iso === today,
      })
    }
    i++
  }
  return days
}

/**
 * Page the visible window by one range-width. ``dir`` +1 advances, -1 retreats.
 *
 * Forward: the day after the last generated day. Backward is the symmetric
 * inverse so that ``‹`` then ``›`` returns to the original start.
 */
export const stepRange = (
  rangeStartISO: string,
  daysShown: number,
  skipWeekends: boolean,
  dir: 1 | -1
): string => {
  if (dir === 1) {
    const days = generateDays(rangeStartISO, daysShown, skipWeekends)
    const last = days[days.length - 1]
    return advanceOneDay(last ? last.iso : rangeStartISO, skipWeekends)
  }
  // Backward: walk back until we've collected ``daysShown`` in-range days, then
  // the range starts at the earliest of them.
  let iso = rangeStartISO
  let collected = 0
  let guard = 0
  while (collected < daysShown && guard < 400) {
    const prev = retreatOneDay(iso, skipWeekends)
    iso = prev
    collected++
    guard++
  }
  return iso
}

/** The next in-range day strictly after ``iso`` (skips weekends if asked). */
const advanceOneDay = (iso: string, skipWeekends: boolean): string => {
  let next = addDays(iso, 1)
  let guard = 0
  while (skipWeekends && isWeekendDay(parseISO(next)) && guard < 14) {
    next = addDays(next, 1)
    guard++
  }
  return next
}

/** The previous in-range day strictly before ``iso`` (skips weekends if asked). */
const retreatOneDay = (iso: string, skipWeekends: boolean): string => {
  let prev = addDays(iso, -1)
  let guard = 0
  while (skipWeekends && isWeekendDay(parseISO(prev)) && guard < 14) {
    prev = addDays(prev, -1)
    guard++
  }
  return prev
}

export interface Readiness {
  readyOrTaught: number
  total: number
  needMaterials: number
}

/** Readiness rollup across a set of lessons. */
export const readiness = (lessons: Lesson[]): Readiness => {
  let readyOrTaught = 0
  let needMaterials = 0
  for (const lesson of lessons) {
    if (lesson.status === 'ready' || lesson.status === 'taught') readyOrTaught++
    const ungathered = lesson.materials.filter((m) => !m.is_gathered).length
    if (ungathered > 0) needMaterials++
  }
  return { readyOrTaught, total: lessons.length, needMaterials }
}

/** Per-lesson prep label for the meta row. */
export const prepLabel = (lesson: Lesson): string => {
  if (lesson.materials.length === 0) return 'No prep'
  const toGather = lesson.materials.filter((m) => !m.is_gathered).length
  if (toGather === 0) return 'Materials ready'
  return `${toGather} to gather`
}

/**
 * A human range label for the visible window, e.g. "Jun 22–30" (same month) or
 * "Jun 22 – Jul 5" (spanning months).
 */
export const rangeLabel = (days: DayInfo[]): string => {
  if (days.length === 0) return ''
  const first = parseISO(days[0].iso)
  const last = parseISO(days[days.length - 1].iso)
  const firstLabel = `${MONTH_LABELS[first.getMonth()]} ${first.getDate()}`
  if (first.getMonth() === last.getMonth()) {
    return `${firstLabel}–${last.getDate()}`
  }
  return `${firstLabel} – ${MONTH_LABELS[last.getMonth()]} ${last.getDate()}`
}

export interface SubjectTint {
  '--subject-ink': string
  '--subject-soft': string
  '--subject-line': string
}

/**
 * Derive a subject's ink/soft/line triple from its single hex color, mixing
 * against the theme tokens so dark mode is inherited for free. Falls back to
 * the accent token when a subject has no color.
 */
export const subjectTint = (hex?: string | null): SubjectTint => {
  const ink = hex && hex.trim() ? hex.trim() : 'var(--accent)'
  return {
    '--subject-ink': ink,
    '--subject-soft': `color-mix(in srgb, ${ink} 12%, var(--panel))`,
    '--subject-line': `color-mix(in srgb, ${ink} 32%, var(--line))`,
  }
}

/** Deterministic avatar background color from a student id (no color field). */
const AVATAR_HUES = [210, 150, 275, 35, 12, 190, 320, 95]
export const avatarColor = (studentId: number): string => {
  const hue = AVATAR_HUES[Math.abs(studentId) % AVATAR_HUES.length]
  return `hsl(${hue} 42% 46%)`
}

/** Initials for an avatar, from first/last name (falls back to username). */
export const studentInitials = (student: {
  first_name?: string
  last_name?: string
  username?: string
}): string => {
  const f = (student.first_name || '').trim()
  const l = (student.last_name || '').trim()
  if (f || l) return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || '?'
  return (student.username || '?').charAt(0).toUpperCase()
}

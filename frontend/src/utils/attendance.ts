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
 * Date/calendar helpers shared by the admin attendance page and the student's
 * read-only attendance view. All dates are local-time ISO strings.
 */

import React from 'react'

import { todayISO } from './dates'

/** The three statuses the P/A/E UI shows ('late' collapses to 'present'). */
export type AttendanceDisplayStatus = 'present' | 'absent' | 'excused'

export function formatDateShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isFuture(iso: string) {
  return iso > todayISO()
}

/** Every day of a (1-based) month as { iso, day }. */
export function monthDays(year: number, month: number) {
  const days: { iso: string; day: number }[] = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ iso, day: d })
  }
  return days
}

export function firstDowOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

/** Returns { year, month } for every month in [startIso, endIso]. */
export function monthsInRange(startIso: string, endIso: string): { year: number; month: number }[] {
  const [sy, sm] = startIso.split('-').map(Number)
  const [ey, em] = endIso.split('-').map(Number)
  const months: { year: number; month: number }[] = []
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

/** Calendar cell colors keyed by status; future days render dimmed. */
export const cellStyle = (
  status: AttendanceDisplayStatus | undefined,
  iso: string
): React.CSSProperties => {
  if (isFuture(iso)) return { background: 'var(--panel-2)', opacity: 0.4 }
  if (!status) return { background: 'var(--track)' }
  if (status === 'present') return { background: 'var(--pos-bg)', color: 'var(--pos-fg)' }
  if (status === 'absent')  return { background: 'var(--neg-bg)', color: 'var(--neg-fg)' }
  if (status === 'excused') return { background: 'var(--exc-bg)', color: 'var(--exc-fg)' }
  return {}
}

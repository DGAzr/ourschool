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
 * Local-time calendar-date helpers shared across features (lesson planning,
 * attendance, student assignments). All ISO strings are ``YYYY-MM-DD`` in
 * local time — never UTC, so a lesson planned "today" stays on today's date
 * regardless of timezone.
 */

/** Parse an ISO ``YYYY-MM-DD`` string into a local-time Date at midnight. */
export const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Return whether a value is a real calendar date in strict YYYY-MM-DD form. */
export const isValidISODate = (value: string | null | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}

/** Format a local Date as an ISO ``YYYY-MM-DD`` string. */
const toISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today's local date as an ISO string. */
export const todayISO = (): string => toISO(new Date())

/** ISO string ``days`` calendar days after ``iso``. */
export const addDays = (iso: string, days: number): string => {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

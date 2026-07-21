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

import { letterGrade } from '../../utils/grading'

export const parsePoints = (raw: string): number | null => {
  if (raw.trim() === '') return null
  const n = parseFloat(raw)
  return isNaN(n) ? null : n
}

export const pointsError = (raw: string): string | null => {
  const n = parsePoints(raw)
  if (n === null) return null
  if (n < 0) return 'Points must be at least 0.'
  return null
}

// Points earned may exceed `max` (e.g. extra credit) — the preview reflects
// the true percentage/letter rather than being suppressed above max.
export const gradePreview = (
  raw: string,
  max: number
): { pct: number; letter: string } | null => {
  const n = parsePoints(raw)
  if (n === null || n < 0 || max <= 0) return null
  const pct = Math.round((n / max) * 100)
  return { pct, letter: letterGrade(n, max) }
}

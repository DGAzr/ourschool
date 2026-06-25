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
 * Convert a points-earned + max-points pair to a letter grade.
 *
 * Matches the default scale used by the backend (app/utils/grading.py).
 * The backend persists the authoritative letter grade using the admin-
 * configured scale; this helper is used for live client-side preview only.
 */
export const letterGrade = (pts: number, max: number): string => {
  if (max <= 0) return 'F'
  const pct = Math.round((Math.max(0, Math.min(max, pts)) / max) * 100)
  if (pct >= 97) return 'A+'
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A−'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B−'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C−'
  if (pct >= 67) return 'D+'
  if (pct >= 63) return 'D'
  if (pct >= 60) return 'D−'
  return 'F'
}

/**
 * Color token for a grade percentage. Matches the Grading desk's
 * CSS variable scale for consistent display.
 */
export const gradeColor = (pct: number): string => {
  if (pct >= 90) return 'var(--grade-a)'
  if (pct >= 80) return 'var(--grade-b)'
  if (pct >= 70) return 'var(--grade-c)'
  return 'var(--grade-f)'
}

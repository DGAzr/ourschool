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

export type PillVariant = 'pos' | 'neg' | 'info' | 'sub' | 'exc' | 'ns' | 'accent' | 'neutral'

/* Convenience helper — maps assignment/attendance statuses to pill variants */
export function statusToPillVariant(
  status: string
): PillVariant {
  switch (status) {
    case 'graded':
    case 'present':    return 'pos'
    case 'overdue':
    case 'absent':     return 'neg'
    case 'in_progress':return 'info'
    case 'submitted':  return 'sub'
    case 'excused':    return 'exc'
    case 'not_started':return 'ns'
    default:           return 'neutral'
  }
}

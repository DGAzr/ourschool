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
 * Pure grouping/bucketing helpers for the student assignment views. Date
 * semantics mirror the backend (app/utils/grading.py): the effective due date
 * is the extension when granted, and term membership falls back to the
 * assigned date for undated work.
 *
 * All dates are local-time ISO strings (YYYY-MM-DD), compared lexically.
 */

import { StudentAssignment } from '../types/assignment'
import { Term } from '../types/term'
import { addDays, todayISO } from './dates'

export type StudentTab = 'todo' | 'submitted' | 'done'

export type UrgencyGroup = 'overdue' | 'today' | 'week' | 'later' | 'undated'

/** The date the work is actually due: extension wins over the original. */
export const effectiveDueDate = (a: StudentAssignment): string | undefined =>
  a.extended_due_date ?? a.due_date

const isActionable = (a: StudentAssignment): boolean =>
  a.status === 'not_started' || a.status === 'in_progress' || a.status === 'overdue'

/**
 * Whether unfinished work is past its effective due date. Computed from dates
 * rather than trusting the stored OVERDUE status, which is only recomputed
 * when the row is touched.
 */
export const isOverdue = (a: StudentAssignment, today = todayISO()): boolean => {
  const due = effectiveDueDate(a)
  return !!due && due < today && isActionable(a)
}

/** Which student-view tab an assignment belongs to. */
export const bucketTab = (a: StudentAssignment): StudentTab => {
  if (a.is_graded || a.status === 'graded' || a.status === 'excused') return 'done'
  if (a.status === 'submitted') return 'submitted'
  return 'todo'
}

/** Urgency section for the To-do tab. "week" = the next 7 days. */
export const urgencyGroup = (
  a: StudentAssignment,
  today = todayISO()
): UrgencyGroup => {
  const due = effectiveDueDate(a)
  if (!due) return 'undated'
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  if (due <= addDays(today, 7)) return 'week'
  return 'later'
}

export const URGENCY_ORDER: UrgencyGroup[] = [
  'overdue',
  'today',
  'week',
  'later',
  'undated',
]

export const URGENCY_LABELS: Record<UrgencyGroup, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'This week',
  later: 'Later',
  undated: 'No due date',
}

/**
 * Term membership, matching the backend's term_membership_filter:
 * coalesce(due_date, assigned_date) within the term's inclusive dates.
 * (Intentionally the original due date, not the extension.)
 */
export const inTerm = (a: StudentAssignment, term: Term): boolean => {
  const anchor = a.due_date ?? a.assigned_date
  return !!anchor && anchor >= term.start_date && anchor <= term.end_date
}

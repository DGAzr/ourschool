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
 * Student dashboard panel that answers "what should I do right now": overdue
 * work first, then work due today or in the next week, with one-click Start.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { assignmentsApi } from '../../services/assignments'
import { subjectsApi } from '../../services/subjects'
import { SubjectDot } from '../ui'
import { StudentAssignment } from '../../types/assignment'
import { Subject } from '../../types/subject'
import { formatDateOnly } from '../../utils/formatters'
import {
  UrgencyGroup,
  bucketTab,
  effectiveDueDate,
  urgencyGroup,
} from '../../utils/studentAssignments'

interface UpNextPanelProps {
  onViewAssignment: (assignmentId: number) => void
}

const MAX_ROWS = 6

const GROUP_META: Partial<Record<UrgencyGroup, { label: string; className: string }>> = {
  overdue: { label: 'Overdue', className: 'text-neg-fg' },
  today: { label: 'Due today', className: 'text-accent' },
  week: { label: 'Due soon', className: 'text-faint' },
}

const UpNextPanel: React.FC<UpNextPanelProps> = ({ onViewAssignment }) => {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<number | null>(null)

  const load = useCallback(() => {
    return Promise.all([assignmentsApi.getMyAssignments(), subjectsApi.getAll()])
      .then(([assignmentsData, subjectsData]) => {
        setAssignments(assignmentsData || [])
        setSubjects(subjectsData || [])
      })
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleStart = async (assignmentId: number) => {
    setStartingId(assignmentId)
    try {
      await assignmentsApi.startAssignment(assignmentId)
      await load()
    } catch {
      // Leave the row as-is; the assignments page surfaces errors.
    } finally {
      setStartingId(null)
    }
  }

  // Actionable work due within the week, most urgent first (API is already
  // due-date ordered, so a stable group sort keeps that ordering).
  const groups: UrgencyGroup[] = ['overdue', 'today', 'week']
  const upNext = groups.flatMap(g =>
    assignments.filter(a => bucketTab(a) === 'todo' && urgencyGroup(a) === g)
  )
  const rows = upNext.slice(0, MAX_ROWS)

  const subjectFor = (a: StudentAssignment) =>
    subjects.find(s => s.id === a.template?.subject_id)

  return (
    <div className="bg-panel border border-accent-line rounded-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-2">
        <h3 className="text-[15px] font-semibold text-ink">Up next</h3>
        <Link to="/assignments" className="text-[12.5px] font-semibold text-accent hover:text-ink transition-colors">
          All assignments
        </Link>
      </div>

      {loading ? (
        <div className="py-8 text-center text-[13px] text-faint">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[14px] font-semibold text-ink-2 mb-1">You're all caught up! 🎉</p>
          <p className="text-[12.5px] text-faint">Nothing is overdue or due this week.</p>
        </div>
      ) : (
        <div className="divide-y divide-line-2">
          {rows.map(assignment => {
            const group = urgencyGroup(assignment)
            const meta = GROUP_META[group]
            const subject = subjectFor(assignment)
            const due = effectiveDueDate(assignment)
            return (
              <div
                key={assignment.id}
                onClick={e => {
                  if ((e.target as HTMLElement).closest('button, a')) return
                  onViewAssignment(assignment.id)
                }}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent-soft transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SubjectDot color={subject?.color ?? '#74716A'} size={9} className="flex-none" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink truncate">
                      {assignment.template?.name ?? 'Assignment'}
                    </p>
                    <p className="text-[12px] mt-0.5">
                      {meta && <span className={`font-semibold ${meta.className}`}>{meta.label}</span>}
                      {due && (
                        <span className="text-faint">
                          {meta && ' · '}
                          {formatDateOnly(due, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {assignment.status === 'not_started' ? (
                  <button
                    onClick={() => handleStart(assignment.id)}
                    disabled={startingId === assignment.id}
                    className="flex-none h-[28px] px-3 text-[12.5px] font-semibold rounded-[7px] bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {startingId === assignment.id ? 'Starting…' : 'Start'}
                  </button>
                ) : (
                  <Link
                    to="/assignments"
                    className="flex-none text-[12.5px] font-semibold text-accent hover:text-ink transition-colors"
                  >
                    Continue →
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default UpNextPanel

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
 * work tucked into an expandable group, with current tasks first and one-click Start.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { assignmentsApi, assignmentPage } from '../../services/assignments'
import { subjectsApi } from '../../services/subjects'
import { SubjectDot } from '../ui'
import { StudentAssignment } from '../../types/assignment'
import { Subject } from '../../types/subject'
import { formatDateOnly } from '../../utils/formatters'
import {
  assignmentHref,
  assignmentProgress,
  UrgencyGroup,
  bucketTab,
  effectiveDueDate,
  urgencyGroup,
} from '../../utils/studentAssignments'

import { useAuth } from '../../contexts/AuthContext'
import { todayISO,addDays } from '../../utils/dates'
import { Icon } from '../ui'

const MAX_ROWS = 6

const GROUP_META: Partial<Record<UrgencyGroup, { label: string; className: string }>> = {
  overdue: { label: 'Overdue', className: 'text-neg-fg' },
  today: { label: 'Due today', className: 'text-accent' },
  week: { label: 'Due soon', className: 'text-faint' },
}

const UpNextPanel: React.FC = () => {
  const navigate = useNavigate()
  const {user}=useAuth()
  const simple=user?.student_ui_mode==='simple'
  const [older,setOlder]=useState<StudentAssignment[]>([])
  const [olderCount,setOlderCount]=useState(0)
  const [showOlder,setShowOlder]=useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<StudentAssignment[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [startingId, setStartingId] = useState<number | null>(null)

  const load = useCallback(() => {
    return Promise.all([assignmentPage({ student_view: true, tab: 'todo', due_from:todayISO(),due_to:addDays(todayISO(),6),include_undated:true,limit:MAX_ROWS }), subjectsApi.getAll(),assignmentPage({student_view:true,tab:'todo',due_to:addDays(todayISO(),-1),limit:MAX_ROWS})])
      .then(([assignmentsData, subjectsData,olderData]) => {
        setOlder(olderData.items);setOlderCount(olderData.total)
        setError(null)
        setAssignments(assignmentsData.items)
        setSubjects(subjectsData || [])
      })
      .catch(() => { setAssignments([]); setError('Could not load your next assignments. Open All assignments to try again.') })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleStart = async (assignmentId: number) => {
    setError(null)
    setStartingId(assignmentId)
    try {
      await assignmentsApi.startAssignment(assignmentId)
      navigate(assignmentHref(assignmentId))
    } catch {
      setError('Could not start your assignment. Please try again.')
    } finally {
      setStartingId(null)
    }
  }

  // Actionable work due within the week, most urgent first (API is already
  // due-date ordered, so a stable group sort keeps that ordering).
  const groups: UrgencyGroup[] = ['today', 'week', 'later', 'undated']
  const upNext = groups.flatMap(g =>
    assignments.filter(a => bucketTab(a) === 'todo' && urgencyGroup(a) === g)
  )
  const rows = [...upNext.slice(0, MAX_ROWS),...(showOlder ? older : [])]

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

      {error && <p role="alert" className="px-5 py-3 text-neg-fg">{error}</p>}
      {loading ? (
        <div className="py-8 text-center text-[13px] text-faint">Loading…</div>
      ) : error ? null : rows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[14px] font-semibold text-ink-2 mb-1">You're all caught up! 🎉</p>
          <p className="text-[12.5px] text-faint">No current tasks due this week. Older unfinished work is listed below.</p>
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
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-accent-soft transition-colors "
              >
                <div className="flex items-center gap-3 min-w-0">
                  {simple && <Icon name={subject?.icon ?? 'BookOpen'} size={30} />}
                  <SubjectDot color={subject?.color ?? '#74716A'} size={9} className="flex-none" />
                  <div className="min-w-0">
                    <Link to={assignmentHref(assignment.id)} className={simple ? 'block text-lg font-bold text-ink break-words hover:text-accent' : 'block text-[13.5px] font-semibold text-ink break-words hover:text-accent'}>
                      {assignment.template?.name ?? 'Assignment'}
                    </Link>
                    {simple && <><p className="text-sm text-muted">Open this activity. Work on it, then show your teacher.</p>{'speechSynthesis' in window && <button type="button" className="text-accent text-sm" onClick={()=>{if('speechSynthesis' in window){window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${assignment.template?.name ?? 'Activity'}. Open this activity, work on it, then show your teacher.`))}}}>Read aloud</button>}</>}
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
                {assignmentProgress(assignment) === 'not_started' ? (
                  <button
                    onClick={() => handleStart(assignment.id)}
                    disabled={startingId === assignment.id}
                    className="flex-none h-[28px] px-3 text-[12.5px] font-semibold rounded-[7px] bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {startingId === assignment.id ? 'Starting…' : 'Start'}
                  </button>
                ) : (
                  <Link
                    to={assignmentHref(assignment.id)}
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
      {olderCount>0 && <div className="border-t border-line p-4"><button className="text-sm font-semibold text-accent" aria-expanded={showOlder} onClick={()=>setShowOlder(!showOlder)}>{showOlder ? 'Hide' : 'Show'} older unfinished work · {olderCount}</button>{showOlder && olderCount>older.length && <Link to="/assignments" className="block text-sm text-accent mt-2">See all older work</Link>}</div>}
    </div>
  )
}

export default UpNextPanel

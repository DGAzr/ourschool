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

import React, { useState, useEffect, useRef } from 'react'
import { MoreVertical, Edit3, Trash2, Archive, Award, Play, FileCheck, Calendar, User } from 'lucide-react'
import { StudentAssignment, Subject, User as UserType } from '../../types'
import { ViewDensity } from '../layouts/CompactListLayout'
import { assignmentUtils } from '../../services/assignments'

interface GradingAssignmentListItemProps {
  assignment: StudentAssignment
  subject?: Subject
  student?: UserType
  onGrade?: (assignment: StudentAssignment) => void
  onUpdateStatus?: (assignmentId: number, status: string) => void
  onEdit?: (assignment: StudentAssignment) => void
  onDelete?: (assignment: StudentAssignment) => void
  onArchive?: (assignment: StudentAssignment) => void
  viewDensity: ViewDensity
}

const STATUS_BADGE: Record<string, string> = {
  not_started: 'bg-panel-2 text-muted',
  in_progress:  'bg-accent/10 text-accent',
  submitted:    'bg-pos-bg text-pos-fg',
  graded:       'bg-accent/10 text-accent',
}

const GradingAssignmentListItem: React.FC<GradingAssignmentListItemProps> = ({
  assignment, subject, student,
  onGrade, onUpdateStatus, onEdit, onDelete, onArchive, viewDensity
}) => {
  const [showActions, setShowActions] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const template = assignment.template

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false)
      }
    }
    if (showActions) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActions])

  const urgencyDot = () => {
    if (!assignment.due_date) return null
    const diff = Math.ceil((new Date(assignment.due_date + 'T00:00:00').getTime() - Date.now()) / 86400000)
    if (diff < 0) return <span className="w-2 h-2 bg-neg-fg rounded-full flex-none" title="Overdue" />
    if (diff <= 1) return <span className="w-2 h-2 bg-accent rounded-full flex-none" title="Due soon" />
    if (diff <= 3) return <span className="w-2 h-2 bg-[#B0762F] rounded-full flex-none" title="Due this week" />
    return null
  }

  if (viewDensity === 'spacious') return null

  const isCompact = viewDensity === 'compact'
  const pad = isCompact ? 'p-3' : 'p-4'

  return (
    <div
      className={`bg-panel border-l-4 border-b border-b-line-2 first:border-t first:border-t-line-2 last:border-b-0 hover:bg-panel-2 transition-colors ${pad}`}
      style={{ borderLeftColor: subject?.color || 'var(--faintest)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {urgencyDot()}
            <span className={isCompact ? 'text-base' : 'text-lg'}>
              {assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}
            </span>
            <h3 className={`font-semibold text-ink truncate ${isCompact ? 'text-[12px]' : 'text-[13px]'}`}>
              {template?.name}
            </h3>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[assignment.status] ?? 'bg-panel-2 text-muted'}`}>
              <span className="capitalize">{assignment.status.replace('_', ' ')}</span>
            </span>
          </div>

          <div className={`flex items-center gap-3 text-[11px] text-muted ${isCompact ? 'gap-2' : ''}`}>
            <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" />{student?.first_name} {student?.last_name}</span>
            <span>·</span>
            <span>{subject?.name}</span>
            <span>·</span>
            <span>{assignment.points_earned || 0} / {assignment.custom_max_points || template?.max_points || 0} pts</span>
            {assignment.is_graded && assignment.letter_grade && (
              <><span>·</span><span className="font-semibold text-accent">{assignment.letter_grade}</span></>
            )}
            {assignment.due_date && (
              <><span>·</span><span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />Due {new Date(assignment.due_date + 'T00:00:00').toLocaleDateString()}</span></>
            )}
          </div>

          {!isCompact && assignment.custom_instructions && (
            <div className="text-[11px] text-muted bg-panel-2 border border-line-2 rounded-field p-2 mt-1.5">
              <strong>Instructions:</strong> {assignment.custom_instructions}
            </div>
          )}
          {!isCompact && assignment.submission_notes && (
            <div className="text-[11px] text-pos-fg bg-pos-bg rounded-field p-2 mt-1.5">
              <strong>Submission:</strong> {assignment.submission_notes}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 ml-4">
          {assignment.status === 'submitted' && !assignment.is_graded && onGrade && (
            <button
              onClick={() => onGrade(assignment)}
              className={`text-pos-fg hover:bg-pos-bg rounded-field transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
              title="Grade assignment"
            >
              <Award className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
          )}
          {assignment.is_graded && onGrade && (
            <button
              onClick={() => onGrade(assignment)}
              className={`text-accent hover:bg-accent/10 rounded-field transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
              title="Edit grade"
            >
              <Edit3 className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
          )}
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className={`text-faint hover:text-ink hover:bg-panel-2 rounded-field transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
            >
              <MoreVertical className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
            {showActions && (
              <div className="absolute right-0 top-8 w-44 bg-panel border border-line rounded-card shadow-lg z-10">
                {onEdit && (
                  <button onClick={() => { onEdit(assignment); setShowActions(false) }} className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2">
                    <Edit3 className="h-3 w-3" />Edit Details
                  </button>
                )}
                {onUpdateStatus && assignment.status === 'not_started' && (
                  <button onClick={() => { onUpdateStatus(assignment.id, 'in_progress'); setShowActions(false) }} className="w-full text-left px-3 py-2 text-[12px] text-accent hover:bg-accent/10 flex items-center gap-2">
                    <Play className="h-3 w-3" />Start Assignment
                  </button>
                )}
                {onUpdateStatus && assignment.status === 'in_progress' && (
                  <button onClick={() => { onUpdateStatus(assignment.id, 'submitted'); setShowActions(false) }} className="w-full text-left px-3 py-2 text-[12px] text-pos-fg hover:bg-pos-bg flex items-center gap-2">
                    <FileCheck className="h-3 w-3" />Mark Submitted
                  </button>
                )}
                {onGrade && !assignment.is_graded && (
                  <button
                    onClick={() => {
                      if (assignment.status !== 'submitted' && onUpdateStatus) {
                        onUpdateStatus(assignment.id, 'submitted')
                        setTimeout(() => { onGrade(assignment); setShowActions(false) }, 100)
                      } else { onGrade(assignment); setShowActions(false) }
                    }}
                    className="w-full text-left px-3 py-2 text-[12px] text-pos-fg hover:bg-pos-bg flex items-center gap-2"
                  >
                    <Award className="h-3 w-3" />{assignment.status === 'submitted' ? 'Grade Now' : 'Submit & Grade'}
                  </button>
                )}
                {onArchive && (
                  <button onClick={() => { onArchive(assignment); setShowActions(false) }} className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2">
                    <Archive className="h-3 w-3" />Archive
                  </button>
                )}
                {onDelete && (
                  <button onClick={() => { onDelete(assignment); setShowActions(false) }} className="w-full text-left px-3 py-2 text-[12px] text-neg-fg hover:bg-neg-bg flex items-center gap-2">
                    <Trash2 className="h-3 w-3" />Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GradingAssignmentListItem

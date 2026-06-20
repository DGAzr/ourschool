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
import { Play, FileCheck, Award, Clock, Calendar, User, MoreVertical, Edit3, Trash2, Archive } from 'lucide-react'
import { StudentAssignment, Subject, User as UserType } from '../../types'
import { assignmentUtils } from '../../services/assignments'
import { formatDateOnly } from '../../utils/formatters'

interface GradingAssignmentCardProps {
  assignment: StudentAssignment
  subject?: Subject
  student?: UserType
  onGrade?: (assignment: StudentAssignment) => void
  onUpdateStatus?: (assignmentId: number, status: string) => void
  onEdit?: (assignment: StudentAssignment) => void
  onDelete?: (assignment: StudentAssignment) => void
  onArchive?: (assignment: StudentAssignment) => void
}

const STATUS_BADGE: Record<string, string> = {
  not_started: 'bg-panel-2 text-muted',
  in_progress:  'bg-accent/10 text-accent',
  submitted:    'bg-pos-bg text-pos-fg',
  graded:       'bg-accent/10 text-accent',
}

const GradingAssignmentCard: React.FC<GradingAssignmentCardProps> = ({
  assignment, subject, student,
  onGrade, onUpdateStatus, onEdit, onDelete, onArchive
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

  const statusIcon = (status: string) => {
    if (status === 'not_started') return <Clock className="h-3 w-3" />
    if (status === 'in_progress') return <Play className="h-3 w-3" />
    if (status === 'submitted') return <FileCheck className="h-3 w-3" />
    if (status === 'graded') return <Award className="h-3 w-3" />
    return <Clock className="h-3 w-3" />
  }

  const primaryAction = () => {
    if (assignment.status === 'submitted' && !assignment.is_graded && onGrade) {
      return (
        <button
          onClick={() => onGrade(assignment)}
          className="flex-1 h-[34px] flex items-center justify-center gap-2 rounded-field text-[12px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity"
        >
          <Award className="h-3.5 w-3.5" />Grade Assignment
        </button>
      )
    }
    if (assignment.is_graded && onGrade) {
      return (
        <button
          onClick={() => onGrade(assignment)}
          className="flex-1 h-[34px] flex items-center justify-center gap-2 rounded-field text-[12px] font-semibold border border-btn-border bg-panel text-ink hover:bg-track transition-colors"
        >
          <Edit3 className="h-3.5 w-3.5" />Edit Grade
        </button>
      )
    }
    return (
      <div className="flex-1 flex gap-2">
        {assignment.status === 'not_started' && onUpdateStatus && (
          <button
            onClick={() => onUpdateStatus(assignment.id, 'in_progress')}
            className="flex-1 h-[34px] flex items-center justify-center gap-1.5 rounded-field text-[12px] font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            <Play className="h-3 w-3" />Start
          </button>
        )}
        {assignment.status === 'in_progress' && onUpdateStatus && (
          <button
            onClick={() => onUpdateStatus(assignment.id, 'submitted')}
            className="flex-1 h-[34px] flex items-center justify-center gap-1.5 rounded-field text-[12px] font-semibold bg-pos-bg text-pos-fg hover:opacity-90 transition-opacity"
          >
            <FileCheck className="h-3 w-3" />Submit
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(assignment)}
            className="flex-1 h-[34px] flex items-center justify-center gap-1.5 rounded-field text-[12px] font-semibold border border-btn-border bg-panel text-ink hover:bg-track transition-colors"
          >
            <Edit3 className="h-3 w-3" />Edit
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-card-lg overflow-hidden hover:shadow-sm transition-shadow">
      <div className="h-1" style={{ backgroundColor: subject?.color || 'var(--faintest)' }} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}</span>
              <h3 className="text-[13px] font-semibold text-ink truncate">{template?.name}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted mb-2">
              <User className="h-3 w-3" />
              <span className="font-medium">{student?.first_name} {student?.last_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-faint">{subject?.name}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[assignment.status] ?? 'bg-panel-2 text-muted'}`}>
                {statusIcon(assignment.status)}
                <span className="capitalize">{assignment.status.replace('_', ' ')}</span>
              </span>
            </div>
          </div>

          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 rounded-field text-faint hover:text-ink hover:bg-panel-2 transition-colors"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-8 w-40 bg-panel border border-line rounded-card shadow-lg z-10">
                {onEdit && (
                  <button onClick={() => { onEdit(assignment); setShowActions(false) }} className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2">
                    <Edit3 className="h-3 w-3" />Edit Details
                  </button>
                )}
                {onGrade && !assignment.is_graded && (
                  <button
                    onClick={() => {
                      if (assignment.status !== 'submitted') {
                        onUpdateStatus?.(assignment.id, 'submitted')
                        setTimeout(() => { onGrade(assignment); setShowActions(false) }, 100)
                      } else { onGrade(assignment); setShowActions(false) }
                    }}
                    className="w-full text-left px-3 py-2 text-[12px] text-pos-fg hover:bg-pos-bg flex items-center gap-2"
                  >
                    <Award className="h-3 w-3" />
                    {assignment.status === 'submitted' ? 'Grade Now' : 'Submit & Grade'}
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

        <div className="space-y-1.5 mb-4 text-[11px] text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Assigned: {formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {assignment.due_date && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Due: {formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>Points: {assignment.points_earned || 0} / {assignment.custom_max_points || template?.max_points || 0}</span>
            {assignment.is_graded && assignment.letter_grade && (
              <span className="font-semibold text-accent">Grade: {assignment.letter_grade}</span>
            )}
          </div>
          {assignment.custom_instructions && (
            <div className="bg-panel-2 border border-line-2 rounded-field p-2 mt-1">
              <strong>Instructions:</strong> {assignment.custom_instructions}
            </div>
          )}
        </div>

        <div className="flex gap-2">{primaryAction()}</div>
      </div>
    </div>
  )
}

export default GradingAssignmentCard

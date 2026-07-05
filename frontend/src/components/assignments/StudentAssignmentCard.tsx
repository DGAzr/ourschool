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

import React from 'react'
import { Archive, Trash2 } from 'lucide-react'
import { StudentAssignment, Subject } from '../../types'
import { assignmentUtils } from '../../services/assignments'
import { formatDateOnly } from '../../utils/formatters'
import MarkdownRenderer from '../common/MarkdownRenderer'

interface StudentAssignmentCardProps {
  assignment: StudentAssignment
  subject?: Subject
  isAdmin?: boolean
  onStart?: (assignmentId: number) => void
  onComplete?: (assignment: StudentAssignment) => void
  onArchive?: (assignment: StudentAssignment) => void
  onDelete?: (assignment: StudentAssignment) => void
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'not_started':
      return 'bg-track text-faint border border-line'
    case 'in_progress':
      return 'bg-accent/10 text-accent border border-accent/20'
    case 'submitted':
      return 'bg-[var(--pos-bg)] text-[var(--pos-fg)] border border-[var(--pos-fg)]/20'
    case 'graded':
      return 'bg-pos-bg text-pos-fg border border-[var(--pos-fg)]/20'
    case 'overdue':
      return 'bg-neg-bg text-neg-fg border border-[var(--neg-fg)]/20'
    default:
      return 'bg-track text-faint border border-line'
  }
}

const StudentAssignmentCard: React.FC<StudentAssignmentCardProps> = ({
  assignment,
  subject,
  isAdmin = false,
  onStart,
  onComplete,
  onArchive,
  onDelete
}) => {
  const template = assignment.template

  const renderActionButton = () => {
    if (assignment.status === 'not_started' && onStart) {
      return (
        <button
          onClick={() => onStart(assignment.id)}
          className="flex-1 h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          Start Assignment
        </button>
      )
    }

    if (assignment.status === 'in_progress' && onComplete) {
      return (
        <button
          onClick={() => onComplete(assignment)}
          className="flex-1 h-[34px] px-4 rounded-field bg-pos-bg text-pos-fg text-[13px] font-semibold hover:opacity-80 transition-opacity"
        >
          Submit Assignment
        </button>
      )
    }

    if (assignment.status === 'submitted' && !assignment.is_graded) {
      return (
        <div className="flex-1 h-[34px] px-4 rounded-field bg-track text-muted text-[13px] font-medium flex items-center justify-center">
          Waiting for Grade
        </div>
      )
    }

    if (assignment.is_graded) {
      return (
        <div className="flex-1 h-[34px] px-4 rounded-field bg-pos-bg text-pos-fg text-[13px] font-medium flex items-center justify-center">
          Graded: {assignment.letter_grade || 'Not Set'}
        </div>
      )
    }

    return null
  }

  return (
    <div className="bg-panel border border-line rounded-card-lg overflow-hidden hover:border-accent/30 transition-colors">
      {/* Subject color stripe */}
      <div className="h-1" style={{ backgroundColor: subject?.color || 'var(--accent)' }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base leading-none">
                {assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}
              </span>
              <h3 className="text-[15px] font-semibold text-ink truncate">
                {template?.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-muted">
              <span>{subject?.name}</span>
              {assignment.due_date && (
                <>
                  <span className="text-faintest">·</span>
                  <span>Due {formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </>
              )}
            </div>
          </div>

          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${statusBadge(assignment.status)}`}>
            {assignment.status.replace('_', ' ')}
          </span>
        </div>

        {/* Description */}
        {template?.description && (
          <div className="mb-3 text-[13px] text-muted line-clamp-2">
            <MarkdownRenderer content={template.description} className="line-clamp-2" />
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between text-[12.5px] text-muted mb-4">
          <div className="flex items-center gap-3">
            <span>📋 {assignment.custom_max_points || template?.max_points || 0} pts</span>
            {template?.estimated_duration_minutes && (
              <span>⏱ {assignmentUtils.formatDuration(template.estimated_duration_minutes)}</span>
            )}
          </div>
          {assignment.percentage_grade !== null && assignment.percentage_grade !== undefined && (
            <span className={`font-semibold text-[13px] ${
              assignment.percentage_grade >= 90 ? 'text-pos-fg' :
              assignment.percentage_grade >= 70 ? 'text-accent' : 'text-neg-fg'
            }`}>
              {assignment.percentage_grade.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Submission preview */}
        {(assignment.status === 'submitted' || assignment.is_graded) &&
          (assignment.submission_notes || (assignment.submission_artifacts && assignment.submission_artifacts.length > 0)) && (
          <div className="mb-4 px-3 py-2.5 bg-accent/6 border border-accent/15 rounded-field">
            <p className="text-[11.5px] font-semibold text-accent mb-1 uppercase tracking-wide">Your Submission</p>
            {assignment.submission_notes && (
              <p className="text-[12.5px] text-muted line-clamp-2">{assignment.submission_notes}</p>
            )}
            {assignment.submission_artifacts && assignment.submission_artifacts.length > 0 && (
              <p className="text-[12px] text-muted">
                {assignment.submission_artifacts.length} link{assignment.submission_artifacts.length !== 1 ? 's' : ''} submitted
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {renderActionButton()}
          {isAdmin && onArchive && (
            <button
              onClick={() => onArchive(assignment)}
              className="w-[34px] h-[34px] flex items-center justify-center rounded-field text-faint hover:text-ink hover:bg-track transition-colors"
              title="Archive"
              aria-label="Archive assignment"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(assignment)}
              className="w-[34px] h-[34px] flex items-center justify-center rounded-field text-faint hover:text-neg-fg hover:bg-neg-bg transition-colors"
              title="Delete"
              aria-label="Delete assignment"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentAssignmentCard

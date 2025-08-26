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
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          Start Assignment
        </button>
      )
    }

    if (assignment.status === 'in_progress' && onComplete) {
      return (
        <button 
          onClick={() => onComplete(assignment)}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
        >
          Submit Assignment
        </button>
      )
    }

    if (assignment.status === 'submitted' && !assignment.is_graded) {
      return (
        <div className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-md text-sm font-medium text-center">
          Waiting for Grade
        </div>
      )
    }

    if (assignment.is_graded) {
      return (
        <div className="flex-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-2 rounded-md text-sm font-medium text-center">
          Graded: {assignment.letter_grade || 'Not Set'}
        </div>
      )
    }

    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
      {/* Header with Subject Color */}
      <div className="h-2" style={{ backgroundColor: subject?.color || '#6B7280' }}></div>
      
      <div className="p-6">
        {/* Assignment Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-2">
              <span className="text-lg mr-2">
                {assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}
              </span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {template?.name}
              </h3>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{subject?.name}</span>
              {assignment.due_date && (
                <>
                  <span>•</span>
                  <span>Due: {formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Status Badge */}
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${assignmentUtils.getStatusColor(assignment.status)}`}>
            {assignment.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Description */}
        {template?.description && (
          <div className="mb-4">
            <MarkdownRenderer 
              content={template.description} 
              className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2" 
            />
          </div>
        )}

        {/* Assignment Details */}
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center space-x-4">
            <span>📋 {assignment.custom_max_points || template?.max_points || 0} points</span>
            {template?.estimated_duration_minutes && (
              <span>⏱️ {assignmentUtils.formatDuration(template.estimated_duration_minutes)}</span>
            )}
          </div>
          {assignment.percentage_grade !== null && (
            <span className={`font-medium ${assignmentUtils.calculateGradeColor(assignment.percentage_grade)}`}>
              {assignment.percentage_grade?.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Submission Details */}
        {(assignment.status === 'submitted' || assignment.is_graded) && (assignment.submission_notes || (assignment.submission_artifacts && assignment.submission_artifacts.length > 0)) && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <h4 className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">Your Submission</h4>
            {assignment.submission_notes && (
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                <span className="font-medium">Notes:</span> {assignment.submission_notes.length > 100 ? assignment.submission_notes.substring(0, 100) + '...' : assignment.submission_notes}
              </p>
            )}
            {assignment.submission_artifacts && assignment.submission_artifacts.length > 0 && (
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <span className="font-medium">Links:</span> {assignment.submission_artifacts.length} artifact{assignment.submission_artifacts.length !== 1 ? 's' : ''} submitted
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          {renderActionButton()}
          {isAdmin && onArchive && (
            <button
              onClick={() => onArchive(assignment)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900 rounded-md transition-colors"
              title="Archive Assignment"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(assignment)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-md transition-colors"
              title="Delete Assignment"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentAssignmentCard
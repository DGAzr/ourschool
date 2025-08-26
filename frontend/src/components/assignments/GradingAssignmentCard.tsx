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
import { 
  Play, 
  FileCheck, 
  Award, 
  Clock, 
  Calendar,
  User,
  MoreVertical,
  Edit3,
  Trash2,
  Archive
} from 'lucide-react'
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

const GradingAssignmentCard: React.FC<GradingAssignmentCardProps> = ({
  assignment,
  subject,
  student,
  onGrade,
  onUpdateStatus,
  onEdit,
  onDelete,
  onArchive
}) => {
  const [showActions, setShowActions] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const template = assignment.template

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false)
      }
    }

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showActions])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock className="h-4 w-4 text-gray-500" />
      case 'in_progress':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'submitted':
        return <FileCheck className="h-4 w-4 text-purple-500" />
      case 'graded':
        return <Award className="h-4 w-4 text-indigo-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'submitted':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'graded':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const renderPrimaryAction = () => {
    if (assignment.status === 'submitted' && !assignment.is_graded && onGrade) {
      return (
        <button
          onClick={() => onGrade(assignment)}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
        >
          <Award className="h-4 w-4 mr-2" />
          Grade Assignment
        </button>
      )
    }

    if (assignment.is_graded && onGrade) {
      return (
        <button
          onClick={() => onGrade(assignment)}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Grade
        </button>
      )
    }

    // For other statuses, show status change options
    return (
      <div className="flex-1 grid grid-cols-2 gap-2">
        {assignment.status === 'not_started' && onUpdateStatus && (
          <button
            onClick={() => onUpdateStatus(assignment.id, 'in_progress')}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </button>
        )}
        {assignment.status === 'in_progress' && onUpdateStatus && (
          <button
            onClick={() => onUpdateStatus(assignment.id, 'submitted')}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            <FileCheck className="h-3 w-3 mr-1" />
            Submit
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(assignment)}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Edit
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 border border-gray-200 dark:border-gray-700">
      {/* Header with Subject Color */}
      <div className="h-1" style={{ backgroundColor: subject?.color || '#6B7280' }}></div>
      
      <div className="p-4">
        {/* Assignment Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-2">
              <span className="text-base mr-2">
                {assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}
              </span>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                {template?.name}
              </h3>
            </div>
            
            {/* Student Info */}
            <div className="flex items-center mb-2 text-sm text-gray-600 dark:text-gray-400">
              <User className="h-3 w-3 mr-1" />
              <span className="font-medium">
                {student?.first_name} {student?.last_name}
              </span>
            </div>

            {/* Subject and Status */}
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {subject?.name}
              </span>
              <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(assignment.status)}`}>
                {getStatusIcon(assignment.status)}
                <span className="ml-1 capitalize">{assignment.status.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {showActions && (
              <div className="absolute right-0 top-8 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                {onEdit && (
                  <button
                    onClick={() => {
                      onEdit(assignment)
                      setShowActions(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <Edit3 className="h-3 w-3 mr-2" />
                    Edit Details
                  </button>
                )}
                {onGrade && assignment.status !== 'graded' && (
                  <button
                    onClick={() => {
                      // If not submitted, update status to submitted first, then grade
                      if (assignment.status !== 'submitted') {
                        onUpdateStatus && onUpdateStatus(assignment.id, 'submitted')
                        // Use a small delay to allow status update to process
                        setTimeout(() => {
                          onGrade(assignment)
                          setShowActions(false)
                        }, 100)
                      } else {
                        onGrade(assignment)
                        setShowActions(false)
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 flex items-center"
                  >
                    <Award className="h-3 w-3 mr-2" />
                    {assignment.status === 'submitted' ? 'Grade Now' : 'Submit & Grade'}
                  </button>
                )}
                {onArchive && (
                  <button
                    onClick={() => {
                      onArchive(assignment)
                      setShowActions(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <Archive className="h-3 w-3 mr-2" />
                    Archive
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      onDelete(assignment)
                      setShowActions(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900 flex items-center"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Assignment Details */}
        <div className="space-y-2 mb-4">
          {/* Dates */}
          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              <span>Assigned: {formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            {assignment.due_date && (
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>Due: {formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            )}
          </div>

          {/* Points */}
          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <span>
              Points: {assignment.points_earned || 0} / {assignment.custom_max_points || template?.max_points || 0}
            </span>
            {assignment.is_graded && assignment.letter_grade && (
              <span className="font-medium text-indigo-600">
                Grade: {assignment.letter_grade}
              </span>
            )}
          </div>

          {/* Custom Instructions */}
          {assignment.custom_instructions && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
              <strong>Instructions:</strong> {assignment.custom_instructions}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          {renderPrimaryAction()}
        </div>
      </div>
    </div>
  )
}

export default GradingAssignmentCard
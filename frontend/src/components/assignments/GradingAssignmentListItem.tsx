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
  MoreVertical, 
  Edit3, 
  Trash2, 
  Archive, 
  Award,
  Play,
  FileCheck,
  Clock,
  Calendar,
  User
} from 'lucide-react'
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

const GradingAssignmentListItem: React.FC<GradingAssignmentListItemProps> = ({
  assignment,
  subject,
  student,
  onGrade,
  onUpdateStatus,
  onEdit,
  onDelete,
  onArchive,
  viewDensity
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
        return <Clock className="h-3 w-3 text-gray-500" />
      case 'in_progress':
        return <Play className="h-3 w-3 text-blue-500" />
      case 'submitted':
        return <FileCheck className="h-3 w-3 text-purple-500" />
      case 'graded':
        return <Award className="h-3 w-3 text-indigo-500" />
      default:
        return <Clock className="h-3 w-3 text-gray-500" />
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
      case 'submitted':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
      case 'graded':
        return 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
    }
  }

  const getUrgencyIndicator = () => {
    if (!assignment.due_date) return null
    
    const dueDate = new Date(assignment.due_date + 'T00:00:00')
    const today = new Date()
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return <span className="w-2 h-2 bg-red-500 rounded-full" title="Overdue" />
    } else if (diffDays <= 1) {
      return <span className="w-2 h-2 bg-orange-500 rounded-full" title="Due soon" />
    } else if (diffDays <= 3) {
      return <span className="w-2 h-2 bg-yellow-500 rounded-full" title="Due this week" />
    }
    return null
  }

  if (viewDensity === 'spacious') {
    // Return null to indicate this item should render as a card
    return null
  }

  const isCompact = viewDensity === 'compact'
  const containerPadding = isCompact ? 'p-3' : 'p-4'

  return (
    <div className={`bg-white dark:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-750 border-l-4 border-b border-b-gray-100 dark:border-b-gray-700 first:border-t first:border-t-gray-100 dark:first:border-t-gray-700 last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${containerPadding}`}
         style={{ borderLeftColor: subject?.color || '#6B7280' }}>
      <div className="flex items-start justify-between">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Primary Line */}
          <div className="flex items-center space-x-3 mb-1">
            {/* Urgency Indicator */}
            {getUrgencyIndicator()}
            
            {/* Type Icon */}
            <span className={isCompact ? 'text-lg' : 'text-xl'}>
              {assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}
            </span>
            
            {/* Assignment Name */}
            <h3 className={`font-semibold text-gray-900 dark:text-gray-100 truncate ${
              isCompact ? 'text-sm' : 'text-base'
            }`}>
              {template?.name}
            </h3>
            
            {/* Status Badge */}
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)} ${
              isCompact ? 'px-1.5 py-0.5' : ''
            }`}>
              {getStatusIcon(assignment.status)}
              <span className="ml-1 capitalize">{assignment.status.replace('_', ' ')}</span>
            </div>
          </div>
          
          {/* Secondary Line */}
          <div className={`flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400 ${
            isCompact ? 'space-x-3' : ''
          }`}>
            {/* Student */}
            <div className="flex items-center">
              <User className="h-3 w-3 mr-1" />
              <span className="font-medium">
                {student?.first_name} {student?.last_name}
              </span>
            </div>
            
            {/* Subject */}
            <span>•</span>
            <span>{subject?.name}</span>
            
            {/* Points */}
            <span>•</span>
            <span>
              {assignment.points_earned || 0} / {assignment.custom_max_points || template?.max_points || 0} pts
            </span>
            
            {/* Grade */}
            {assignment.is_graded && assignment.letter_grade && (
              <>
                <span>•</span>
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  {assignment.letter_grade}
                </span>
              </>
            )}
            
            {/* Due Date */}
            {assignment.due_date && (
              <>
                <span>•</span>
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>Due {new Date(assignment.due_date + 'T00:00:00').toLocaleDateString()}</span>
                </div>
              </>
            )}
          </div>
          
          {/* Custom Instructions (for comfortable view only) */}
          {!isCompact && assignment.custom_instructions && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded mt-2">
              <strong>Instructions:</strong> {assignment.custom_instructions}
            </div>
          )}
          
          {/* Submission Notes (for comfortable view only) */}
          {!isCompact && assignment.submission_notes && (
            <div className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900 p-2 rounded mt-2">
              <strong>Submission:</strong> {assignment.submission_notes}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {/* Primary Action */}
          {assignment.status === 'submitted' && !assignment.is_graded && onGrade && (
            <button
              onClick={() => onGrade(assignment)}
              className={`text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors ${
                isCompact ? 'p-1' : 'p-1.5'
              }`}
              title="Grade assignment"
            >
              <Award className={isCompact ? 'h-3 w-3' : 'h-4 w-4'} />
            </button>
          )}
          
          {assignment.is_graded && onGrade && (
            <button
              onClick={() => onGrade(assignment)}
              className={`text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors ${
                isCompact ? 'p-1' : 'p-1.5'
              }`}
              title="Edit grade"
            >
              <Edit3 className={isCompact ? 'h-3 w-3' : 'h-4 w-4'} />
            </button>
          )}
          
          {/* More Actions Menu */}
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${
                isCompact ? 'p-1' : 'p-1.5'
              }`}
            >
              <MoreVertical className={isCompact ? 'h-3 w-3' : 'h-4 w-4'} />
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
                
                {onUpdateStatus && assignment.status === 'not_started' && (
                  <button
                    onClick={() => {
                      onUpdateStatus(assignment.id, 'in_progress')
                      setShowActions(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 flex items-center"
                  >
                    <Play className="h-3 w-3 mr-2" />
                    Start Assignment
                  </button>
                )}
                
                {onUpdateStatus && assignment.status === 'in_progress' && (
                  <button
                    onClick={() => {
                      onUpdateStatus(assignment.id, 'submitted')
                      setShowActions(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 flex items-center"
                  >
                    <FileCheck className="h-3 w-3 mr-2" />
                    Mark Submitted
                  </button>
                )}
                
                {onGrade && !assignment.is_graded && (
                  <button
                    onClick={() => {
                      if (assignment.status !== 'submitted' && onUpdateStatus) {
                        onUpdateStatus(assignment.id, 'submitted')
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
      </div>
    </div>
  )
}

export default GradingAssignmentListItem
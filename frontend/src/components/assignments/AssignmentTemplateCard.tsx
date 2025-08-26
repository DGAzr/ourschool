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
import { Edit, Trash2, Users, Clock, Target, Archive, Download, MoreVertical } from 'lucide-react'
import { AssignmentTemplate, Subject, Lesson } from '../../types'
import { assignmentUtils } from '../../services/assignments'
import MarkdownRenderer from '../common/MarkdownRenderer'

interface AssignmentTemplateCardProps {
  template: AssignmentTemplate
  subject?: Subject
  lesson?: Lesson
  onEdit: (template: AssignmentTemplate) => void
  onDelete: (template: AssignmentTemplate) => void
  onAssign: (template: AssignmentTemplate) => void
  onArchive: (template: AssignmentTemplate) => void
  onExport?: (template: AssignmentTemplate) => void
  isSelected?: boolean
  onSelectionToggle?: (templateId: number) => void
}

const AssignmentTemplateCard: React.FC<AssignmentTemplateCardProps> = ({
  template,
  subject,
  lesson,
  onEdit,
  onDelete,
  onAssign,
  onArchive,
  onExport,
  isSelected = false,
  onSelectionToggle
}) => {
  const [showActions, setShowActions] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

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
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 relative">
      {/* Header with Subject Color */}
      <div className="h-2" style={{ backgroundColor: subject?.color || '#6B7280' }}></div>
      
      <div className="p-6">
        {/* Template Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-2">
              {onSelectionToggle && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelectionToggle(template.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                />
              )}
              <span className="text-lg mr-2">
                {assignmentUtils.getAssignmentTypeIcon(template.assignment_type)}
              </span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {template.name}
              </h3>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{subject?.name}</span>
              {lesson && (
                <>
                  <span>•</span>
                  <span>{lesson.title}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Actions Menu */}
          <div className="relative ml-4" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="More actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            
            {showActions && (
              <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                <button
                  onClick={() => {
                    onAssign(template)
                    setShowActions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900 flex items-center"
                >
                  <Users className="h-4 w-4 mr-2 text-green-600" />
                  Assign to Students
                </button>
                <button
                  onClick={() => {
                    onEdit(template)
                    setShowActions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900 flex items-center"
                >
                  <Edit className="h-4 w-4 mr-2 text-blue-600" />
                  Edit Template
                </button>
                {onExport && (
                  <button
                    onClick={() => {
                      onExport(template)
                      setShowActions(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900 flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2 text-orange-600" />
                    Export Template
                  </button>
                )}
                <button
                  onClick={() => {
                    onArchive(template)
                    setShowActions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-yellow-50 dark:hover:bg-yellow-900 flex items-center"
                >
                  <Archive className="h-4 w-4 mr-2 text-yellow-600" />
                  Archive Template
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700"></div>
                <button
                  onClick={() => {
                    onDelete(template)
                    setShowActions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900 flex items-center"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Template
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {template.description && (
          <div className="mb-4">
            <MarkdownRenderer 
              content={template.description} 
              className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2" 
            />
          </div>
        )}

        {/* Template Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <Target className="h-4 w-4 mr-1" />
                <span>{template.max_points} pts</span>
              </div>
              {template.estimated_duration_minutes && (
                <div className="flex items-center text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{assignmentUtils.formatDuration(template.estimated_duration_minutes)}</span>
                </div>
              )}
            </div>
            
          </div>

          {/* Assignment Stats */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">{template.total_assigned || 0}</span> students assigned
            </div>
            {template.average_grade && (
              <div className={`text-sm font-medium ${assignmentUtils.calculateGradeColor(template.average_grade)}`}>
                Avg: {template.average_grade.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssignmentTemplateCard
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
  Edit, 
  Trash2, 
  Archive, 
  Users, 
  Download,
  CheckSquare,
  Square,
  Clock,
  BookOpen
} from 'lucide-react'
import { AssignmentTemplate, Subject, Lesson } from '../../types'
import { ViewDensity } from '../layouts/CompactListLayout'

interface AssignmentTemplateListItemProps {
  template: AssignmentTemplate
  subject?: Subject
  lesson?: Lesson
  isSelected?: boolean
  onSelectionToggle?: () => void
  onEdit: () => void
  onDelete: () => void
  onAssign: () => void
  onArchive: () => void
  onExport: () => void
  viewDensity: ViewDensity
}

const AssignmentTemplateListItem: React.FC<AssignmentTemplateListItemProps> = ({
  template,
  subject,
  lesson,
  isSelected = false,
  onSelectionToggle,
  onEdit,
  onDelete,
  onAssign,
  onArchive,
  onExport,
  viewDensity
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

  const getAssignmentTypeIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      homework: '📝',
      quiz: '❓',
      test: '📋',
      project: '🗂️',
      essay: '📄',
      lab: '🧪',
      presentation: '📊',
      other: '📚'
    }
    return iconMap[type] || '📚'
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
            {/* Selection Checkbox */}
            {onSelectionToggle && (
              <button
                onClick={onSelectionToggle}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isSelected ? (
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
            )}
            
            {/* Type Icon */}
            <span className={isCompact ? 'text-lg' : 'text-xl'}>
              {getAssignmentTypeIcon(template.assignment_type)}
            </span>
            
            {/* Template Name */}
            <h3 className={`font-semibold text-gray-900 dark:text-gray-100 truncate ${
              isCompact ? 'text-sm' : 'text-base'
            }`}>
              {template.name}
            </h3>
            
            {/* Assignment Count Badge */}
            {template.total_assigned && template.total_assigned > 0 && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 ${
                isCompact ? 'px-1.5 py-0.5' : ''
              }`}>
                <Users className="h-3 w-3 mr-1" />
                {template.total_assigned}
              </span>
            )}
          </div>
          
          {/* Secondary Line */}
          <div className={`flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400 ${
            isCompact ? 'space-x-3' : ''
          }`}>
            {/* Subject */}
            <span className="font-medium">
              {subject?.name}
            </span>
            
            {/* Lesson */}
            {lesson && (
              <>
                <span>•</span>
                <div className="flex items-center">
                  <BookOpen className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-32">{lesson.title}</span>
                </div>
              </>
            )}
            
            {/* Points */}
            <span>•</span>
            <span>{template.max_points} pts</span>
            
            {/* Estimated Time */}
            {template.estimated_duration_minutes && (
              <>
                <span>•</span>
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{template.estimated_duration_minutes}min</span>
                </div>
              </>
            )}
            
            {/* Type */}
            <span>•</span>
            <span className="capitalize">{template.assignment_type}</span>
          </div>
          
          {/* Description (for comfortable view only) */}
          {!isCompact && template.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">
              {template.description}
            </p>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {/* Quick Actions */}
          <button
            onClick={onAssign}
            className={`text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors ${
              isCompact ? 'p-1' : 'p-1.5'
            }`}
            title="Assign to students"
          >
            <Users className={isCompact ? 'h-3 w-3' : 'h-4 w-4'} />
          </button>
          
          <button
            onClick={onExport}
            className={`text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors ${
              isCompact ? 'p-1' : 'p-1.5'
            }`}
            title="Export template"
          >
            <Download className={isCompact ? 'h-3 w-3' : 'h-4 w-4'} />
          </button>
          
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
                <button
                  onClick={() => {
                    onEdit()
                    setShowActions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit Template
                </button>
                <button
                  onClick={() => {
                    onArchive()
                    setShowActions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                >
                  <Archive className="h-3 w-3 mr-2" />
                  Archive
                </button>
                <button
                  onClick={() => {
                    onDelete()
                    setShowActions(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900 flex items-center"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssignmentTemplateListItem
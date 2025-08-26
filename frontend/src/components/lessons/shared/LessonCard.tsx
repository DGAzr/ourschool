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
import { 
  ChevronRight, 
  ChevronDown, 
  Download, 
  FileText, 
  Users, 
  Edit, 
  Trash2,
  Calendar,
  Clock
} from 'lucide-react'
import { Lesson } from '../../../types'
import { Card } from '../../ui'

interface LessonCardProps {
  lesson: Lesson
  isExpanded: boolean
  onToggleExpansion: (lessonId: number) => void
  onEdit: (lesson: Lesson) => void
  onDelete: (lesson: Lesson) => void
  onExport: (lesson: Lesson) => void
  onManageAssignments: (lesson: Lesson) => void
  onAssignToStudents: (lesson: Lesson) => void
}

// Helper functions for status and colors
const getStatusColor = (date: string): string => {
  const lessonDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  lessonDate.setHours(0, 0, 0, 0)
  
  if (lessonDate < today) {
    return 'bg-green-100 text-green-800 border-green-200'
  } else if (lessonDate.getTime() === today.getTime()) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  } else {
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }
}

const getStatusText = (date: string): string => {
  const lessonDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  lessonDate.setHours(0, 0, 0, 0)
  
  if (lessonDate < today) {
    return 'completed'
  } else if (lessonDate.getTime() === today.getTime()) {
    return 'today'
  } else {
    return 'upcoming'
  }
}

const getTextColor = (backgroundColor: string): string => {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  isExpanded,
  onToggleExpansion,
  onEdit,
  onDelete,
  onExport,
  onManageAssignments,
  onAssignToStudents
}) => {
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this lesson?')) {
      onDelete(lesson)
    }
  }

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-200 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600">
      {/* Enhanced Header Bar */}
      <div 
        className="h-1.5" 
        style={{ 
          background: lesson.subjects && lesson.subjects.length > 1
            ? `linear-gradient(to right, ${lesson.subjects.map(s => s.color).join(', ')})`
            : lesson.subjects && lesson.subjects.length === 1
              ? lesson.subjects[0].color
              : '#8B5CF6'
        }}
      />
      
      <Card.Content className="p-6">
        {/* Lesson Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => onToggleExpansion(lesson.id)}
              className="text-gray-400 dark:text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900 p-1 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
            <div>
              <div className="flex items-center flex-wrap gap-2 mb-2">
                {lesson.subjects && lesson.subjects.length > 0 ? (
                  lesson.subjects.map((subject) => (
                    <span 
                      key={subject.id}
                      className="text-xs font-medium px-3 py-1 rounded-full shadow-sm"
                      style={{ 
                        backgroundColor: subject.color,
                        color: getTextColor(subject.color)
                      }}
                    >
                      {subject.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    No Subjects
                  </span>
                )}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(lesson.scheduled_date)} border`}>
                  {getStatusText(lesson.scheduled_date)}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {lesson.title}
              </h3>
            </div>
          </div>
          
          {/* Enhanced Action Buttons */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onExport(lesson)}
              className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
              title="Export lesson"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => onManageAssignments(lesson)}
              className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
              title="Manage assignments"
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              onClick={() => onAssignToStudents(lesson)}
              className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
              title="Assign to students"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              onClick={() => onEdit(lesson)}
              className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
              title="Edit lesson"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
              title="Delete lesson"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Info */}
        <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            {new Date(lesson.scheduled_date).toLocaleDateString()}
          </div>
          {lesson.start_time && lesson.end_time && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              {lesson.start_time} - {lesson.end_time}
            </div>
          )}
          {lesson.estimated_duration_minutes && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              {lesson.estimated_duration_minutes} minutes
            </div>
          )}
        </div>

        {/* Description */}
        {lesson.description && (
          <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-2">
            {lesson.description}
          </p>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lesson.objectives && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Objectives</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{lesson.objectives}</p>
                </div>
              )}
              {lesson.prerequisites && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Prerequisites</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{lesson.prerequisites}</p>
                </div>
              )}
              {lesson.materials_needed && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Materials Needed</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{lesson.materials_needed}</p>
                </div>
              )}
              {lesson.resources && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Resources</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{lesson.resources}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  )
}

export default LessonCard
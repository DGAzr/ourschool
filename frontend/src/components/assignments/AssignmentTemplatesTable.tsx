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
  BookOpen,
  Calendar
} from 'lucide-react'
import { AssignmentTemplate, Subject, Lesson } from '../../types'

interface AssignmentTemplatesTableProps {
  templates: AssignmentTemplate[]
  subjects: Subject[]
  lessons: Lesson[]
  selectedTemplates: Set<number>
  onTemplateSelectionToggle: (templateId: number) => void
  onEditTemplate: (template: AssignmentTemplate) => void
  onDeleteTemplate: (template: AssignmentTemplate) => void
  onAssignTemplate: (template: AssignmentTemplate) => void
  onArchiveTemplate: (template: AssignmentTemplate) => void
  onExportTemplate: (template: AssignmentTemplate) => void
  emptyMessage?: string
  emptyDescription?: string
}

const AssignmentTemplatesTable: React.FC<AssignmentTemplatesTableProps> = ({
  templates,
  subjects,
  lessons,
  selectedTemplates,
  onTemplateSelectionToggle,
  onEditTemplate,
  onDeleteTemplate,
  onAssignTemplate,
  onArchiveTemplate,
  onExportTemplate,
  emptyMessage = 'No assignment templates found',
  emptyDescription = 'Get started by creating your first assignment template.'
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId && dropdownRefs.current[openDropdownId] && 
          !dropdownRefs.current[openDropdownId]?.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
    }

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdownId])

  const getSubjectById = (id: number) => subjects.find(s => s.id === id)
  const getLessonById = (id: number) => lessons.find(l => l.id === id)

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

  if (templates.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{emptyMessage}</h3>
          <p className="text-gray-500 dark:text-gray-400">{emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <BookOpen className="h-5 w-5 mr-2" />
          Assignment Templates
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({templates.length} template{templates.length !== 1 ? 's' : ''})
          </span>
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                <CheckSquare className="h-4 w-4" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Template
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Lesson
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Points
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Assigned
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {templates.map((template) => {
              const subject = getSubjectById(template.subject_id)
              const lesson = template.lesson_id ? getLessonById(template.lesson_id) : undefined
              
              return (
                <tr 
                  key={template.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {/* Selection Checkbox */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onTemplateSelectionToggle(template.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {selectedTemplates.has(template.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  
                  {/* Template Name & Description */}
                  <td className="px-6 py-4">
                    <div className="flex items-start space-x-2">
                      <span className="text-lg mt-0.5">
                        {getAssignmentTypeIcon(template.assignment_type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {template.name}
                        </div>
                        {template.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {template.description}
                          </div>
                        )}
                        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          Created: {new Date(template.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Subject */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: subject?.color || '#9CA3AF' }}
                      ></div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {subject?.name || 'Unknown'}
                      </div>
                    </div>
                  </td>
                  
                  {/* Lesson */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lesson ? (
                      <div className="text-sm text-gray-900 dark:text-gray-100 max-w-32 truncate">
                        {lesson.title}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </td>
                  
                  {/* Type */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      {template.assignment_type.charAt(0).toUpperCase() + template.assignment_type.slice(1)}
                    </span>
                  </td>
                  
                  {/* Points */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {template.max_points} pts
                  </td>
                  
                  {/* Duration */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {template.estimated_duration_minutes ? (
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1 text-gray-400" />
                        {template.estimated_duration_minutes}min
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </td>
                  
                  {/* Assignment Count */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {template.total_assigned && template.total_assigned > 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        <Users className="h-3 w-3 mr-1" />
                        {template.total_assigned}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">0</span>
                    )}
                  </td>
                  
                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {/* Quick Actions */}
                      <button
                        onClick={() => onAssignTemplate(template)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                        title="Assign to students"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => onExportTemplate(template)}
                        className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors p-1"
                        title="Export template"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      
                      {/* More Actions Dropdown */}
                      <div className="relative" ref={(el) => dropdownRefs.current[template.id] = el}>
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === template.id ? null : template.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {openDropdownId === template.id && (
                          <div className="absolute right-0 top-8 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                            <button
                              onClick={() => {
                                onEditTemplate(template)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                            >
                              <Edit className="h-3 w-3 mr-2" />
                              Edit Template
                            </button>
                            <button
                              onClick={() => {
                                onArchiveTemplate(template)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                            >
                              <Archive className="h-3 w-3 mr-2" />
                              Archive
                            </button>
                            <button
                              onClick={() => {
                                onDeleteTemplate(template)
                                setOpenDropdownId(null)
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
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AssignmentTemplatesTable
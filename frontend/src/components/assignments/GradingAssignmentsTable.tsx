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
  Calendar,
  User,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { StudentAssignment, Subject, User as UserType } from '../../types'
import { assignmentUtils } from '../../services/assignments'

interface GradingAssignmentsTableProps {
  assignments: StudentAssignment[]
  subjects: Subject[]
  students: UserType[]
  onGradeAssignment: (assignment: StudentAssignment) => void
  onEditAssignment: (assignment: StudentAssignment) => void
  onArchiveAssignment: (assignment: StudentAssignment) => void
  onDeleteAssignment: (assignment: StudentAssignment) => void
  onUpdateAssignmentStatus: (assignmentId: number, status: string) => void
  emptyMessage?: string
  emptyDescription?: string
}

const GradingAssignmentsTable: React.FC<GradingAssignmentsTableProps> = ({
  assignments,
  subjects,
  students,
  onGradeAssignment,
  onEditAssignment,
  onArchiveAssignment,
  onDeleteAssignment,
  onUpdateAssignmentStatus,
  emptyMessage = 'No assignments found',
  emptyDescription = 'No assignments have been created yet.'
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
  const getStudentById = (id: number) => students.find(s => s.id === id)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'submitted':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'graded':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'not_started':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'submitted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'graded':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getUrgencyIndicator = (assignment: StudentAssignment) => {
    if (!assignment.due_date) return null
    
    const dueDate = new Date(assignment.due_date + 'T00:00:00')
    const today = new Date()
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return <span className="w-2 h-2 bg-red-500 rounded-full mr-2" title="Overdue" />
    } else if (diffDays <= 1) {
      return <span className="w-2 h-2 bg-orange-500 rounded-full mr-2" title="Due soon" />
    } else if (diffDays <= 3) {
      return <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2" title="Due this week" />
    }
    return null
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="text-center py-8">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{emptyMessage}</h3>
          <p className="text-gray-600 dark:text-gray-400">{emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <BookOpen className="h-5 w-5 mr-2" />
          Assignment Details
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({assignments.length} assignment{assignments.length !== 1 ? 's' : ''})
          </span>
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Assignment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Points
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Grade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {assignments.map((assignment) => {
              const subject = assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined
              const student = getStudentById(assignment.student_id)
              const template = assignment.template
              const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date() && assignment.status !== 'graded'
              
              return (
                <tr 
                  key={assignment.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {/* Assignment Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-start space-x-2">
                      {getUrgencyIndicator(assignment)}
                      <span className="text-lg mt-0.5">
                        {assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {template?.name || 'Unknown Assignment'}
                        </div>
                        {assignment.custom_instructions && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            <strong>Instructions:</strong> {assignment.custom_instructions}
                          </div>
                        )}
                        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          Assigned: {new Date(assignment.assigned_date + 'T00:00:00').toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Student */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {student?.first_name} {student?.last_name}
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
                  
                  {/* Due Date */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-900 dark:text-gray-100'}`}>
                      {assignment.due_date ? new Date(assignment.due_date + 'T00:00:00').toLocaleDateString() : 'No due date'}
                    </div>
                    {isOverdue && (
                      <div className="text-xs text-red-500 dark:text-red-400">
                        Overdue
                      </div>
                    )}
                  </td>
                  
                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(assignment.status)}`}>
                      {getStatusIcon(assignment.status)}
                      <span className="ml-1">
                        {assignment.status.replace('_', ' ').charAt(0).toUpperCase() + assignment.status.replace('_', ' ').slice(1)}
                      </span>
                    </span>
                  </td>
                  
                  {/* Points */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {assignment.points_earned !== null && assignment.points_earned !== undefined
                      ? `${assignment.points_earned} / ${assignment.custom_max_points || template?.max_points || 0}`
                      : `— / ${assignment.custom_max_points || template?.max_points || 0}`
                    }
                  </td>
                  
                  {/* Grade */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {assignment.is_graded && assignment.letter_grade ? (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        (assignment.points_earned || 0) / (assignment.custom_max_points || template?.max_points || 100) * 100 >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                        (assignment.points_earned || 0) / (assignment.custom_max_points || template?.max_points || 100) * 100 >= 80 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                        (assignment.points_earned || 0) / (assignment.custom_max_points || template?.max_points || 100) * 100 >= 70 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                      }`}>
                        {assignment.letter_grade}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">Not graded</span>
                    )}
                  </td>
                  
                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {/* Primary Action */}
                      {assignment.status === 'submitted' && !assignment.is_graded && (
                        <button
                          onClick={() => onGradeAssignment(assignment)}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors p-1"
                          title="Grade assignment"
                        >
                          <Award className="h-4 w-4" />
                        </button>
                      )}
                      
                      {assignment.status !== 'submitted' && !assignment.is_graded && (
                        <button
                          onClick={() => {
                            onUpdateAssignmentStatus(assignment.id, 'submitted')
                            setTimeout(() => {
                              onGradeAssignment(assignment)
                            }, 100)
                          }}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors p-1"
                          title="Submit and grade"
                        >
                          <Award className="h-4 w-4" />
                        </button>
                      )}
                      
                      {assignment.is_graded && (
                        <button
                          onClick={() => onGradeAssignment(assignment)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                          title="Edit grade"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      
                      {/* More Actions Dropdown */}
                      <div className="relative" ref={(el) => dropdownRefs.current[assignment.id] = el}>
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === assignment.id ? null : assignment.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {openDropdownId === assignment.id && (
                          <div className="absolute right-0 top-8 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                            <button
                              onClick={() => {
                                onEditAssignment(assignment)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                            >
                              <Edit3 className="h-3 w-3 mr-2" />
                              Edit Details
                            </button>
                            
                            {assignment.status === 'not_started' && (
                              <button
                                onClick={() => {
                                  onUpdateAssignmentStatus(assignment.id, 'in_progress')
                                  setOpenDropdownId(null)
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 flex items-center"
                              >
                                <Play className="h-3 w-3 mr-2" />
                                Start Assignment
                              </button>
                            )}
                            
                            {assignment.status === 'in_progress' && (
                              <button
                                onClick={() => {
                                  onUpdateAssignmentStatus(assignment.id, 'submitted')
                                  setOpenDropdownId(null)
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 flex items-center"
                              >
                                <FileCheck className="h-3 w-3 mr-2" />
                                Mark Submitted
                              </button>
                            )}
                            
                            {!assignment.is_graded && (
                              <button
                                onClick={() => {
                                  if (assignment.status !== 'submitted') {
                                    onUpdateAssignmentStatus(assignment.id, 'submitted')
                                    setTimeout(() => {
                                      onGradeAssignment(assignment)
                                      setOpenDropdownId(null)
                                    }, 100)
                                  } else {
                                    onGradeAssignment(assignment)
                                    setOpenDropdownId(null)
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 flex items-center"
                              >
                                <Award className="h-3 w-3 mr-2" />
                                {assignment.status === 'submitted' ? 'Grade Now' : 'Submit & Grade'}
                              </button>
                            )}
                            
                            <button
                              onClick={() => {
                                onArchiveAssignment(assignment)
                                setOpenDropdownId(null)
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                            >
                              <Archive className="h-3 w-3 mr-2" />
                              Archive
                            </button>
                            
                            <button
                              onClick={() => {
                                onDeleteAssignment(assignment)
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

export default GradingAssignmentsTable
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

import React, { useState, useEffect } from 'react'
import { 
  X, 
  FileText, 
  User, 
  Calendar, 
  Clock, 
  Target, 
  Award, 
  BookOpen, 
  MessageSquare, 
  Paperclip,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Users
} from 'lucide-react'
import { assignmentsApi } from '../../services/assignments'
import { StudentAssignment, AssignmentTemplate } from '../../types'
import MarkdownRenderer from '../common/MarkdownRenderer'
import { formatDateOnly } from '../../utils/formatters'

interface AssignmentDetailModalProps {
  assignmentId: number
  studentId?: number
  isOpen: boolean
  onClose: () => void
}

interface DetailedAssignment extends StudentAssignment {
  template: AssignmentTemplate
  student_name?: string
}

const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  assignmentId,
  studentId,
  isOpen,
  onClose
}) => {
  const [assignment, setAssignment] = useState<DetailedAssignment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && assignmentId) {
      fetchAssignmentDetails()
    }
  }, [isOpen, assignmentId, studentId])

  const fetchAssignmentDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch assignment details
      const assignmentData = await assignmentsApi.getStudentAssignment(assignmentId)
      if (assignmentData.template) {
        setAssignment(assignmentData as DetailedAssignment)
      } else {
        setError('Assignment template not found')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load assignment details')
      // Failed to fetch assignment details
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    return formatDateOnly(dateString)
  }


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'graded':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getGradeColor = (percentage?: number | null) => {
    if (percentage === null || percentage === undefined) return 'text-gray-500'
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Assignment Details
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Complete assignment information
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading assignment details...</span>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-md">
                {error}
              </div>
            </div>
          )}

          {assignment && (
            <div className="p-6 space-y-6">
              {/* Assignment Header */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {assignment.template?.name}
                    </h2>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center">
                        <BookOpen className="h-4 w-4 mr-1" />
                        Assignment #{assignment.id}
                      </span>
                      {assignment.student_name && (
                        <span className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {assignment.student_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(assignment.status)}`}>
                      {assignment.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {assignment.percentage_grade !== null && (
                      <span className={`text-lg font-bold ${getGradeColor(assignment.percentage_grade)}`}>
                        {assignment.percentage_grade?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white dark:bg-gray-600 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {assignment.points_earned !== null ? assignment.points_earned : '—'} / {assignment.custom_max_points || assignment.template?.max_points || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Points</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-600 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {assignment.letter_grade || '—'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Letter Grade</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-600 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {assignment.template?.estimated_duration_minutes ? `${assignment.template.estimated_duration_minutes}m` : '—'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Est. Duration</div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-600 rounded-lg">
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {assignment.time_spent_minutes}m
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Time Spent</div>
                  </div>
                </div>
              </div>

              {/* Assignment Description & Instructions */}
              {(assignment.template?.description || assignment.template?.instructions) && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Assignment Details
                  </h3>
                  
                  {assignment.template?.description && (
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Description</h4>
                      <div className="prose dark:prose-invert max-w-none">
                        <MarkdownRenderer content={assignment.template.description} />
                      </div>
                    </div>
                  )}

                  {assignment.template?.instructions && (
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Instructions</h4>
                      <div className="prose dark:prose-invert max-w-none">
                        <MarkdownRenderer content={assignment.template.instructions} />
                      </div>
                    </div>
                  )}

                  {assignment.custom_instructions && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="text-md font-medium text-blue-800 dark:text-blue-200 mb-2">Custom Instructions</h4>
                      <div className="prose dark:prose-invert max-w-none text-blue-700 dark:text-blue-300">
                        <MarkdownRenderer content={assignment.custom_instructions} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Timeline
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned Date</span>
                    </div>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(assignment.assigned_date)}</span>
                  </div>

                  {assignment.due_date && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                      <div className="flex items-center">
                        <Target className="h-4 w-4 text-orange-500 mr-2" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</span>
                      </div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(assignment.due_date)}</span>
                    </div>
                  )}

                  {assignment.started_date && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-blue-500 mr-2" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Started</span>
                      </div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(assignment.started_date)}</span>
                    </div>
                  )}

                  {assignment.submitted_date && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 text-yellow-500 mr-2" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Submitted</span>
                      </div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(assignment.submitted_date)}</span>
                    </div>
                  )}

                  {assignment.graded_date && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                      <div className="flex items-center">
                        <Award className="h-4 w-4 text-green-500 mr-2" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Graded</span>
                      </div>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(assignment.graded_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Student Submission */}
              {(assignment.submission_notes || (assignment.submission_artifacts && assignment.submission_artifacts.length > 0)) && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Student Submission
                  </h3>

                  {assignment.submission_notes && (
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Notes to Admin
                      </h4>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-blue-700 dark:text-blue-300 whitespace-pre-wrap">{assignment.submission_notes}</p>
                      </div>
                    </div>
                  )}

                  {assignment.submission_artifacts && assignment.submission_artifacts.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center">
                        <Paperclip className="h-4 w-4 mr-2" />
                        Artifact Links ({assignment.submission_artifacts.length})
                      </h4>
                      <div className="space-y-2">
                        {assignment.submission_artifacts.map((link, index) => (
                          <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                            <ExternalLink className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline break-all flex-1"
                            >
                              {link}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Teacher Feedback & Student Notes */}
              {(assignment.teacher_feedback || assignment.student_notes) && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Notes & Feedback
                  </h3>

                  {assignment.teacher_feedback && (
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Teacher Feedback</h4>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-green-700 dark:text-green-300 whitespace-pre-wrap">{assignment.teacher_feedback}</p>
                      </div>
                    </div>
                  )}

                  {assignment.student_notes && (
                    <div>
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Student Notes</h4>
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <p className="text-purple-700 dark:text-purple-300 whitespace-pre-wrap">{assignment.student_notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Information */}
              {(assignment.template?.prerequisites || assignment.template?.materials_needed) && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Additional Information
                  </h3>

                  {assignment.template?.prerequisites && (
                    <div className="mb-4">
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Prerequisites</h4>
                      <div className="prose dark:prose-invert max-w-none">
                        <MarkdownRenderer content={assignment.template.prerequisites} />
                      </div>
                    </div>
                  )}

                  {assignment.template?.materials_needed && (
                    <div>
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">Materials Needed</h4>
                      <div className="prose dark:prose-invert max-w-none">
                        <MarkdownRenderer content={assignment.template.materials_needed} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AssignmentDetailModal
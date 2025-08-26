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
import { Users, FileText } from 'lucide-react'
import { lessonsApi } from '../../services/lessons'
import { Lesson } from '../../types'
import { 
  AssignmentModalBase, 
  AssignmentFormError, 
  AssignmentModalFooter
} from '../assignments/shared'
import { Input, TextArea } from '../ui'

interface Student {
  id: number
  first_name: string
  last_name: string
  email: string
  grade_level?: number
}

interface AssignToStudentsModalProps {
  lesson: Lesson
  onClose: () => void
  onSuccess: () => void
}

const AssignToStudentsModal: React.FC<AssignToStudentsModalProps> = ({ 
  lesson, 
  onClose, 
  onSuccess 
}) => {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [dueDate, setDueDate] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const studentsData = await lessonsApi.getStudents()
      setStudents(studentsData || [])
      
      // Set default due date to one week from now
      const oneWeekFromNow = new Date()
      // Use proper date arithmetic that handles month boundaries correctly
      oneWeekFromNow.setTime(oneWeekFromNow.getTime() + (7 * 24 * 60 * 60 * 1000))
      setDueDate(oneWeekFromNow.toISOString().split('T')[0])
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const handleStudentToggle = (studentId: number) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([])
    } else {
      setSelectedStudentIds(students.map(s => s.id))
    }
  }

  const handleAssignLesson = async () => {
    try {
      setSubmitting(true)
      setError(null)
      
      if (selectedStudentIds.length === 0) {
        setError('Please select at least one student')
        return
      }

      const assignmentData = {
        lesson_id: lesson.id,
        student_ids: selectedStudentIds,
        due_date: dueDate || undefined,
        custom_instructions: customInstructions || undefined
      }

      await lessonsApi.assignLessonToStudents(assignmentData)
      onSuccess()
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to assign lesson to students')
    } finally {
      setSubmitting(false)
    }
  }

  const isSubmitDisabled = selectedStudentIds.length === 0 || submitting

  return (
    <AssignmentModalBase
      isOpen={true}
      onClose={onClose}
      title="Assign Lesson to Students"
      subtitle={`Assign "${lesson.title}" to your students`}
      size="xl"
      footer={
        <AssignmentModalFooter
          onCancel={onClose}
          onSubmit={handleAssignLesson}
          submitText={submitting ? 'Assigning...' : `Assign to ${selectedStudentIds.length} Student${selectedStudentIds.length !== 1 ? 's' : ''}`}
          loading={submitting}
          disabled={isSubmitDisabled}
        />
      }
    >
      <div className="space-y-6">
        <AssignmentFormError error={error} />
        
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading students...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Assignment Details */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Lesson: {lesson.title}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Scheduled for: {new Date(lesson.scheduled_date).toLocaleDateString()}
                  </p>
                  {lesson.description && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                      {lesson.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Due Date and Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Due Date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div></div>
            </div>

            <TextArea
              label="Custom Instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              placeholder="Optional instructions for students about this lesson assignment..."
            />

            {/* Student Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Select Students ({selectedStudentIds.length} of {students.length} selected)
                  </h3>
                </div>
                
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                >
                  {selectedStudentIds.length === students.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {students.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400">
                    No students found. Please add students to your program first.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    {students.map((student) => (
                      <label 
                        key={student.id} 
                        className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {student.first_name} {student.last_name}
                            </span>
                            {student.grade_level && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                Grade {student.grade_level}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {student.email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Assignment Summary */}
            {selectedStudentIds.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                  Assignment Summary
                </h4>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p>• Lesson: {lesson.title}</p>
                  <p>• Students: {selectedStudentIds.length} selected</p>
                  {dueDate && <p>• Due Date: {new Date(dueDate).toLocaleDateString()}</p>}
                  {customInstructions && <p>• Custom instructions included</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AssignmentModalBase>
  )
}

export default AssignToStudentsModal
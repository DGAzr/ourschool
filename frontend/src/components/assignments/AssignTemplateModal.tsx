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
import { assignmentsApi } from '../../services/assignments'
import { AssignmentTemplate, User, StudentAssignment } from '../../types'
import { formatDateOnly } from '../../utils/formatters'

interface AssignTemplateModalProps {
  template: AssignmentTemplate
  students: User[]
  onClose: () => void
  onSuccess: () => void
}

const AssignTemplateModal: React.FC<AssignTemplateModalProps> = ({ 
  template, 
  students, 
  onClose, 
  onSuccess 
}) => {
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [assignedStudents, setAssignedStudents] = useState<StudentAssignment[]>([])
  const [dueDate, setDueDate] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [customMaxPoints, setCustomMaxPoints] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [unassignLoading, setUnassignLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'assign' | 'manage'>('assign')

  // Fetch assigned students when modal opens
  useEffect(() => {
    const fetchAssignedStudents = async () => {
      try {
        const assignments = await assignmentsApi.getTemplateAssignments(template.id)
        setAssignedStudents(assignments)
        // Set active tab based on whether there are active assignments (not completed ones)
        const activeAssignments = assignments.filter(assignment => 
          !['submitted', 'graded', 'excused'].includes(assignment.status)
        )
        if (activeAssignments.length > 0) {
          setActiveTab('manage')
        }
      } catch (err) {
        // Failed to fetch assigned students
      }
    }
    
    fetchAssignedStudents()
  }, [template.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Only handle form submission on assign tab
    if (activeTab !== 'assign') {
      return
    }
    
    if (selectedStudents.length === 0) {
      setError('Please select at least one student')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const assignmentData = {
        template_id: template.id,
        student_ids: selectedStudents,
        due_date: dueDate || undefined,
        custom_instructions: customInstructions || undefined,
        custom_max_points: customMaxPoints || undefined
      }
      
      await assignmentsApi.assignToStudents(assignmentData)
      
      // Refresh the assigned students list and switch to manage tab
      const assignments = await assignmentsApi.getTemplateAssignments(template.id)
      setAssignedStudents(assignments)
      setSelectedStudents([])
      setActiveTab('manage')
      
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to assign template to students')
    } finally {
      setLoading(false)
    }
  }

  const handleUnassign = async (assignmentId: number) => {
    try {
      setUnassignLoading(true)
      setError(null)
      await assignmentsApi.deleteStudentAssignment(assignmentId)
      
      // Refresh assigned students list
      const assignments = await assignmentsApi.getTemplateAssignments(template.id)
      setAssignedStudents(assignments)
      
      // If no more active assignments, switch to assign tab
      const activeAssignments = assignments.filter(assignment => 
        !['submitted', 'graded', 'excused'].includes(assignment.status)
      )
      if (activeAssignments.length === 0) {
        setActiveTab('assign')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unassign student')
    } finally {
      setUnassignLoading(false)
    }
  }

  const toggleStudent = (studentId: number) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  // All students are available for assignment (templates can be assigned multiple times)
  const availableStudents = students

  // Filter to only show active assignments (not completed ones)
  const activeAssignments = assignedStudents.filter(assignment => 
    !['submitted', 'graded', 'excused'].includes(assignment.status)
  )

  const toggleAllStudents = () => {
    if (selectedStudents.length === availableStudents.length) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(availableStudents.map(s => s.id))
    }
  }

  const getStudentName = (studentId: number) => {
    const student = students.find(s => s.id === studentId)
    return student ? `${student.first_name} ${student.last_name}` : 'Unknown Student'
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Manage Template Assignment</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              "{template.name}" - {activeAssignments.length} active assignment{activeAssignments.length !== 1 ? 's' : ''}
            </p>
            
            {/* Tabs */}
            <div className="flex mt-4 space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setActiveTab('assign')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'assign'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Assign to Students ({availableStudents.length} students)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'manage'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Manage Assigned ({activeAssignments.length})
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {activeTab === 'assign' ? (
              <>
                {/* Assignment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Max Points (Optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={customMaxPoints || ''}
                      onChange={(e) => setCustomMaxPoints(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder={`Default: ${template.max_points}`}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Custom Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Instructions (Optional)
                  </label>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Any specific instructions for this assignment..."
                  />
                </div>

                {/* Student Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Select Students ({selectedStudents.length} of {availableStudents.length} selected)
                    </label>
                    {availableStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllStudents}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        {selectedStudents.length === availableStudents.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  
                  <div className="border border-gray-300 dark:border-gray-600 rounded-md max-h-48 overflow-y-auto">
                    {availableStudents.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        No students available
                      </div>
                    ) : (
                      availableStudents.map((student) => {
                        // Only show "Active assignment" indicator if student has assignments that are not yet completed
                        const activeAssignments = assignedStudents.filter(assignment => 
                          assignment.student_id === student.id && 
                          !['submitted', 'graded', 'excused'].includes(assignment.status)
                        )
                        const hasActiveAssignment = activeAssignments.length > 0
                        return (
                          <label
                            key={student.id}
                            className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-3 text-sm text-gray-900 dark:text-gray-100 flex-1">
                              {student.first_name} {student.last_name}
                            </span>
                            {hasActiveAssignment && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded">
                                Active assignment ({activeAssignments.length})
                              </span>
                            )}
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Manage Assigned Students */
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Currently Assigned Students
                </h4>
                
                <div className="border border-gray-300 dark:border-gray-600 rounded-md max-h-64 overflow-y-auto">
                  {activeAssignments.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      No active assignments for this template
                    </div>
                  ) : (
                    activeAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {getStudentName(assignment.student_id)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Status: {assignment.status} | Assigned: {formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric' })}
                            {assignment.due_date && ` | Due: ${formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric' })}`}
                          </p>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handleUnassign(assignment.id)}
                          disabled={unassignLoading}
                          className="ml-3 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-800 disabled:opacity-50 transition-colors"
                        >
                          {unassignLoading ? 'Removing...' : 'Unassign'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || unassignLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {activeTab === 'manage' ? 'Done' : 'Cancel'}
            </button>
            {activeTab === 'assign' && (
              <button
                type="submit"
                disabled={loading || selectedStudents.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Assigning...' : `Assign to ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default AssignTemplateModal
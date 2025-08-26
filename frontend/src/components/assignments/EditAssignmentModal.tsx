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

import React, { useState } from 'react'
import { assignmentsApi } from '../../services/assignments'
import { StudentAssignment, User as UserType } from '../../types'
import { formatDateOnly } from '../../utils/formatters'

interface EditAssignmentModalProps {
  assignment: StudentAssignment
  student?: UserType
  onClose: () => void
  onSuccess: () => void
}

const EditAssignmentModal: React.FC<EditAssignmentModalProps> = ({ 
  assignment, 
  student, 
  onClose, 
  onSuccess 
}) => {
  const [dueDate, setDueDate] = useState<string>(assignment.due_date || '')
  const [extendedDueDate, setExtendedDueDate] = useState<string>(assignment.extended_due_date || '')
  const [customInstructions, setCustomInstructions] = useState<string>(assignment.custom_instructions || '')
  const [customMaxPoints, setCustomMaxPoints] = useState<number | undefined>(assignment.custom_max_points || undefined)
  const [studentNotes, setStudentNotes] = useState<string>(assignment.student_notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (customMaxPoints !== undefined && customMaxPoints <= 0) {
      setError('Custom max points must be greater than 0')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await assignmentsApi.updateStudentAssignment(assignment.id, {
        due_date: dueDate || undefined,
        extended_due_date: extendedDueDate || undefined,
        custom_instructions: customInstructions || undefined,
        custom_max_points: customMaxPoints || undefined,
        student_notes: studentNotes || undefined
      })
      
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to update assignment')
    } finally {
      setLoading(false)
    }
  }

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return ''
    // Handle both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss' formats
    return dateString.split('T')[0]
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Edit Assignment</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {assignment.template?.name} - {student?.first_name} {student?.last_name}
            </p>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Assignment Status Info */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <span className="ml-2 capitalize">{assignment.status.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Assigned:</span>
                  <span className="ml-2">{formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {assignment.is_graded && (
                  <>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Points:</span>
                      <span className="ml-2">{assignment.points_earned || 0} / {assignment.custom_max_points || assignment.template?.max_points || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Grade:</span>
                      <span className="ml-2">{assignment.letter_grade || 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Due Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formatDateForInput(dueDate)}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Extended Due Date
                </label>
                <input
                  type="date"
                  value={formatDateForInput(extendedDueDate)}
                  onChange={(e) => setExtendedDueDate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Optional extension for this student
                </p>
              </div>
            </div>

            {/* Custom Max Points */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Max Points
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={customMaxPoints || ''}
                onChange={(e) => setCustomMaxPoints(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder={`Default: ${assignment.template?.max_points || 'Not set'}`}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Override the default max points for this specific assignment
              </p>
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom Instructions
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any specific instructions for this assignment..."
              />
            </div>

            {/* Student Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student Notes
              </label>
              <textarea
                value={studentNotes}
                onChange={(e) => setStudentNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Notes visible to the student about this assignment..."
              />
            </div>

            {/* Template Information (Read-only) */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Template Information</h4>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Template:</strong> {assignment.template?.name}</p>
                {assignment.template?.description && (
                  <p><strong>Description:</strong> {assignment.template.description}</p>
                )}
                <p><strong>Type:</strong> {assignment.template?.assignment_type}</p>
                <p><strong>Default Points:</strong> {assignment.template?.max_points}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAssignmentModal
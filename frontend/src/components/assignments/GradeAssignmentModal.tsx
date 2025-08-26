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

interface GradeAssignmentModalProps {
  assignment: StudentAssignment
  student?: UserType
  onClose: () => void
  onSuccess: () => void
}

const GradeAssignmentModal: React.FC<GradeAssignmentModalProps> = ({ 
  assignment, 
  student, 
  onClose, 
  onSuccess 
}) => {
  const maxPoints = assignment.custom_max_points || assignment.template?.max_points || 100
  
  const [pointsEarned, setPointsEarned] = useState<number>(
    assignment.points_earned !== null && assignment.points_earned !== undefined 
      ? assignment.points_earned 
      : maxPoints
  )
  const calculateLetterGrade = (points: number) => {
    if (maxPoints === 0) return 'F'
    const percentage = Math.round((points / maxPoints) * 100)
    if (percentage >= 97) return 'A+'
    if (percentage >= 93) return 'A'
    if (percentage >= 90) return 'A-'
    if (percentage >= 87) return 'B+'
    if (percentage >= 83) return 'B'
    if (percentage >= 80) return 'B-'
    if (percentage >= 77) return 'C+'
    if (percentage >= 73) return 'C'
    if (percentage >= 70) return 'C-'
    if (percentage >= 67) return 'D+'
    if (percentage >= 63) return 'D'
    if (percentage >= 60) return 'D-'
    return 'F'
  }

  const [letterGrade, setLetterGrade] = useState<string>(
    assignment.letter_grade || 
    (assignment.points_earned !== null && assignment.points_earned !== undefined 
      ? '' 
      : calculateLetterGrade(maxPoints))
  )
  const [teacherFeedback, setTeacherFeedback] = useState<string>(assignment.teacher_feedback || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pointsEarned < 0 || pointsEarned > maxPoints) {
      setError(`Points must be between 0 and ${maxPoints}`)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await assignmentsApi.gradeStudentAssignment(assignment.id, {
        points_earned: pointsEarned,
        teacher_feedback: teacherFeedback || undefined,
        letter_grade: letterGrade || undefined
      })
      
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to grade assignment')
    } finally {
      setLoading(false)
    }
  }

  const calculatePercentage = () => {
    if (maxPoints === 0) return 0
    return Math.round((pointsEarned / maxPoints) * 100)
  }

  const suggestLetterGrade = () => {
    const percentage = calculatePercentage()
    if (percentage >= 97) return 'A+'
    if (percentage >= 93) return 'A'
    if (percentage >= 90) return 'A-'
    if (percentage >= 87) return 'B+'
    if (percentage >= 83) return 'B'
    if (percentage >= 80) return 'B-'
    if (percentage >= 77) return 'C+'
    if (percentage >= 73) return 'C'
    if (percentage >= 70) return 'C-'
    if (percentage >= 67) return 'D+'
    if (percentage >= 63) return 'D'
    if (percentage >= 60) return 'D-'
    return 'F'
  }

  const handlePointsChange = (value: number) => {
    setPointsEarned(value)
    // Auto-update letter grade when points change
    const newLetterGrade = calculateLetterGrade(value)
    setLetterGrade(newLetterGrade)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Grade Assignment</h3>
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

            {/* Assignment Details */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignment Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <span className="ml-2 capitalize">{assignment.status.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Max Points:</span>
                  <span className="ml-2">{maxPoints}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Assigned:</span>
                  <span className="ml-2">{formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {assignment.due_date && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Due:</span>
                    <span className="ml-2">{formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
              {assignment.submission_notes && (
                <div className="mt-3">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Student Notes:</span>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mt-1 bg-white dark:bg-gray-600 p-2 rounded">
                    {assignment.submission_notes}
                  </p>
                </div>
              )}
              {assignment.submission_artifacts && assignment.submission_artifacts.length > 0 && (
                <div className="mt-3">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Student Artifact Links:</span>
                  <div className="mt-1 bg-white dark:bg-gray-600 p-2 rounded">
                    {assignment.submission_artifacts.map((link, index) => (
                      <div key={index} className="flex items-center space-x-2 py-1">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">•</span>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 text-sm hover:text-blue-800 dark:hover:text-blue-300 underline break-all"
                        >
                          {link}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Points Earned */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Points Earned *
                </label>
                <input
                  type="number"
                  min="0"
                  max={maxPoints}
                  step="0.5"
                  value={pointsEarned}
                  onChange={(e) => handlePointsChange(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Percentage: {calculatePercentage()}%
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Letter Grade
                </label>
                <select
                  value={letterGrade}
                  onChange={(e) => setLetterGrade(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No Letter Grade</option>
                  <option value="A+">A+</option>
                  <option value="A">A</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B">B</option>
                  <option value="B-">B-</option>
                  <option value="C+">C+</option>
                  <option value="C">C</option>
                  <option value="C-">C-</option>
                  <option value="D+">D+</option>
                  <option value="D">D</option>
                  <option value="D-">D-</option>
                  <option value="F">F</option>
                </select>
                <button
                  type="button"
                  onClick={() => setLetterGrade(suggestLetterGrade())}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-1"
                >
                  Use suggested: {suggestLetterGrade()}
                </button>
              </div>
            </div>

            {/* Teacher Feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Teacher Feedback
              </label>
              <textarea
                value={teacherFeedback}
                onChange={(e) => setTeacherFeedback(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Provide feedback on the student's work..."
              />
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
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving Grade...' : assignment.is_graded ? 'Update Grade' : 'Save Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GradeAssignmentModal
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
import { letterGrade as sharedLetterGrade } from '../../utils/grading'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

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
  const calculateLetterGrade = (points: number) => sharedLetterGrade(points, maxPoints)

  const [letterGrade, setLetterGrade] = useState<string>(
    assignment.letter_grade ||
    (assignment.points_earned !== null && assignment.points_earned !== undefined
      ? ''
      : calculateLetterGrade(maxPoints))
  )
  const [teacherFeedback, setTeacherFeedback] = useState<string>(assignment.teacher_feedback || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

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
    const newLetterGrade = calculateLetterGrade(value)
    setLetterGrade(newLetterGrade)
  }

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'
  const LABEL = 'block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Grade Assignment"
      subtitle={`${assignment.template?.name} — ${student?.first_name} ${student?.last_name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              const form = document.getElementById('grade-assignment-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            {assignment.is_graded ? 'Update Grade' : 'Save Grade'}
          </Button>
        </>
      }
    >
      <form id="grade-assignment-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-danger-soft border border-danger-line text-danger rounded-field px-4 py-3 text-[13px]">{error}</div>
        )}

        <div className="bg-panel-2 border border-line rounded-[11px] p-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Assignment Details</p>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><span className="text-muted">Status:</span><span className="ml-2 text-ink capitalize">{assignment.status.replace('_', ' ')}</span></div>
            <div><span className="text-muted">Max Points:</span><span className="ml-2 text-ink">{maxPoints}</span></div>
            <div><span className="text-muted">Assigned:</span><span className="ml-2 text-ink">{formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
            {assignment.due_date && (
              <div><span className="text-muted">Due:</span><span className="ml-2 text-ink">{formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
            )}
          </div>
          {assignment.submission_notes && (
            <div className="mt-3">
              <p className="text-[11px] text-muted mb-1">Student Notes:</p>
              <p className="text-[13px] text-ink bg-panel border border-line p-2 rounded-field">{assignment.submission_notes}</p>
            </div>
          )}
          {assignment.submission_artifacts && assignment.submission_artifacts.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] text-muted mb-1">Student Artifact Links:</p>
              <div className="bg-panel border border-line p-2 rounded-field space-y-1">
                {assignment.submission_artifacts.map((link, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-faintest text-xs">•</span>
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      className="text-[12px] text-accent hover:underline break-all">{link}</a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Points Earned *</label>
            <input type="number" min="0" max={maxPoints} step="0.5" value={pointsEarned}
              onChange={(e) => handlePointsChange(parseFloat(e.target.value) || 0)}
              className={`${FIELD} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} required />
            <p className="text-[11px] text-faint mt-1">Percentage: {calculatePercentage()}%</p>
          </div>
          <div>
            <label className={LABEL}>Letter Grade</label>
            <select value={letterGrade} onChange={(e) => setLetterGrade(e.target.value)} className={FIELD}>
              <option value="">No Letter Grade</option>
              {['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button type="button" onClick={() => setLetterGrade(suggestLetterGrade())}
              className="text-[11px] text-accent hover:underline mt-1">
              Use suggested: {suggestLetterGrade()}
            </button>
          </div>
        </div>

        <div>
          <label className={LABEL}>Teacher Feedback</label>
          <textarea value={teacherFeedback} onChange={(e) => setTeacherFeedback(e.target.value)}
            rows={4} className={FIELD} placeholder="Provide feedback on the student's work..." />
        </div>

        {(assignment.template?.description || assignment.template?.instructions || assignment.custom_instructions) && (
          <div className="bg-panel-2 border border-line rounded-[11px] overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-panel transition-colors"
            >
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Assignment Info</p>
              <svg
                className={`w-4 h-4 text-muted transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {detailsOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
                {assignment.template?.description && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Description</p>
                    <p className="text-[13px] text-ink whitespace-pre-wrap">{assignment.template.description}</p>
                  </div>
                )}
                {assignment.template?.instructions && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Instructions</p>
                    <p className="text-[13px] text-ink whitespace-pre-wrap">{assignment.template.instructions}</p>
                  </div>
                )}
                {assignment.custom_instructions && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Custom Instructions</p>
                    <p className="text-[13px] text-ink whitespace-pre-wrap">{assignment.custom_instructions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

export default GradeAssignmentModal

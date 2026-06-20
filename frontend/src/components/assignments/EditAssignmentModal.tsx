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
import Modal from '../ui/Modal'
import Button from '../ui/Button'

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
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return ''
    return dateString.split('T')[0]
  }

  const [dueDate, setDueDate] = useState<string>(assignment.due_date || '')
  const [extendedDueDate, setExtendedDueDate] = useState<string>(assignment.extended_due_date || '')
  const [assignedDate, setAssignedDate] = useState<string>(formatDateForInput(assignment.assigned_date) || '')
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
        assigned_date: assignedDate || undefined,
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

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent w-full'
  const LABEL = 'block text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Assignment"
      subtitle={`${assignment.template?.name} — ${student?.first_name} ${student?.last_name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              const form = document.getElementById('edit-assignment-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <form id="edit-assignment-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-danger-soft border border-danger-line text-danger rounded-field px-4 py-3 text-[13px]">{error}</div>
        )}

        <div className="bg-panel-2 border border-line rounded-[11px] p-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Current Status</p>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div><span className="text-muted">Status:</span><span className="ml-2 text-ink capitalize">{assignment.status.replace('_', ' ')}</span></div>
            <div><span className="text-muted">Assigned:</span><span className="ml-2 text-ink">{formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
            {assignment.is_graded && (
              <>
                <div><span className="text-muted">Points:</span><span className="ml-2 text-ink">{assignment.points_earned || 0} / {assignment.custom_max_points || assignment.template?.max_points || 0}</span></div>
                <div><span className="text-muted">Grade:</span><span className="ml-2 text-ink">{assignment.letter_grade || 'N/A'}</span></div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={LABEL}>Assign Date</label>
            <input type="date" value={formatDateForInput(assignedDate)} onChange={(e) => setAssignedDate(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Due Date</label>
            <input type="date" value={formatDateForInput(dueDate)} onChange={(e) => setDueDate(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>Extended Due Date</label>
            <input type="date" value={formatDateForInput(extendedDueDate)} onChange={(e) => setExtendedDueDate(e.target.value)} className={FIELD} />
            <p className="text-[11px] text-faint mt-1">Optional extension for this student</p>
          </div>
        </div>

        <div>
          <label className={LABEL}>Custom Max Points</label>
          <input type="number" min="1" max="1000" value={customMaxPoints || ''}
            onChange={(e) => setCustomMaxPoints(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder={`Default: ${assignment.template?.max_points || 'Not set'}`} className={FIELD} />
          <p className="text-[11px] text-faint mt-1">Override the default max points for this specific assignment</p>
        </div>

        <div>
          <label className={LABEL}>Custom Instructions</label>
          <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)}
            rows={3} className={FIELD} placeholder="Any specific instructions for this assignment..." />
        </div>

        <div>
          <label className={LABEL}>Student Notes</label>
          <textarea value={studentNotes} onChange={(e) => setStudentNotes(e.target.value)}
            rows={3} className={FIELD} placeholder="Notes visible to the student about this assignment..." />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">Template Information</p>
          <div className="bg-panel-2 border border-line rounded-field p-3 text-[13px] text-muted space-y-1">
            <p><strong className="text-ink">Template:</strong> {assignment.template?.name}</p>
            {assignment.template?.description && <p><strong className="text-ink">Description:</strong> {assignment.template.description}</p>}
            <p><strong className="text-ink">Type:</strong> {assignment.template?.assignment_type}</p>
            <p><strong className="text-ink">Default Points:</strong> {assignment.template?.max_points}</p>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default EditAssignmentModal

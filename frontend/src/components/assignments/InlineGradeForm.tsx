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
import { Check, X } from 'lucide-react'
import { assignmentsApi } from '../../services/assignments'
import { StudentAssignment } from '../../types'

interface InlineGradeFormProps {
  assignment: StudentAssignment
  onSuccess: () => void
  onCancel: () => void
}

const InlineGradeForm: React.FC<InlineGradeFormProps> = ({ assignment, onSuccess, onCancel }) => {
  const maxPoints = assignment.custom_max_points || assignment.template?.max_points || 100
  const [points, setPoints] = useState<string>(assignment.points_earned?.toString() ?? '')
  const [feedback, setFeedback] = useState(assignment.teacher_feedback ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pts = parseFloat(points)
    if (isNaN(pts) || pts < 0) { setError('Enter a valid points value'); return }
    if (pts > maxPoints) { setError(`Points cannot exceed ${maxPoints}`); return }

    try {
      setLoading(true)
      setError(null)
      await assignmentsApi.gradeStudentAssignment(assignment.id, { points_earned: pts, teacher_feedback: feedback || undefined })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to save grade')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3 p-3 bg-accent/6 border border-accent/20 rounded-field">
      <div className="flex items-center gap-1.5 shrink-0">
        <input
          type="number" min={0} max={maxPoints} step="0.5"
          value={points} onChange={e => setPoints(e.target.value)}
          placeholder="pts"
          className="w-20 bg-field-bg border border-field-border rounded-field px-2 py-1 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          autoFocus disabled={loading}
        />
        <span className="text-[12px] text-muted shrink-0">/ {maxPoints}</span>
      </div>
      <input
        type="text" value={feedback} onChange={e => setFeedback(e.target.value)}
        placeholder="Feedback (optional)"
        className="flex-1 bg-field-bg border border-field-border rounded-field px-2 py-1 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent min-w-0"
        disabled={loading}
      />
      {error && <p className="text-[11px] text-neg-fg shrink-0">{error}</p>}
      <button type="submit" disabled={loading || !points}
        className="shrink-0 p-1.5 bg-pos-bg text-pos-fg border border-pos-fg/20 rounded-field hover:opacity-80 disabled:opacity-50" title="Save grade">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={onCancel} disabled={loading}
        className="shrink-0 p-1.5 bg-panel-2 text-muted border border-line rounded-field hover:bg-track hover:text-ink disabled:opacity-50" title="Cancel">
        <X className="h-4 w-4" />
      </button>
    </form>
  )
}

export default InlineGradeForm

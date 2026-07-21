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
import { gradeColor } from '../../utils/grading'
import { gradePreview, parsePoints, pointsError } from './gradeFormLogic'

interface GradeFormProps {
  maxPoints: number
  initialPoints?: number | null
  initialFeedback?: string
  hasNext: boolean
  queuePosition?: { index: number; total: number }
  onSave: (points: number, feedback: string, advance: boolean) => void
  saving?: boolean
}

const GradeForm: React.FC<GradeFormProps> = ({
  maxPoints,
  initialPoints,
  initialFeedback,
  hasNext,
  queuePosition,
  onSave,
  saving,
}) => {
  const [points, setPoints] = useState<string>(
    initialPoints !== null && initialPoints !== undefined ? String(initialPoints) : ''
  )
  const [feedback, setFeedback] = useState<string>(initialFeedback ?? '')

  const preview = gradePreview(points, maxPoints)
  const error = pointsError(points)
  const currentGradeColor = preview ? gradeColor(preview.pct) : 'var(--check-border)'
  const canSave = parsePoints(points) !== null && error === null && !saving

  const submit = (advance: boolean) => {
    const n = parsePoints(points)
    if (n === null || pointsError(points) !== null) return
    onSave(n, feedback, advance)
  }

  return (
    <>
      <div className="flex gap-5 flex-wrap items-end">
        <div>
          <label htmlFor="grading-points-earned" className="block text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Points earned</label>
          <div className="flex items-center gap-2">
            <input
              id="grading-points-earned"
              type="number"
              inputMode="decimal"
              min={0}
              value={points}
              onChange={e => setPoints(e.target.value)}
              placeholder="0"
              className="w-[88px] h-[46px] bg-field-bg border border-field-border rounded-[10px] font-mono text-[20px] font-semibold text-center text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="font-mono text-[18px] text-faint">/ {maxPoints}</span>
          </div>
          {error && <p className="text-[12px] text-danger mt-1">{error}</p>}
        </div>
        {preview && (
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">Grade</span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[30px] font-semibold tracking-[-0.02em]" style={{ color: currentGradeColor }}>
                {preview.letter}
              </span>
              <span className="font-mono text-[16px] text-faint">{preview.pct}%</span>
            </div>
          </div>
        )}
        <div className="flex gap-1.5 flex-1 justify-end flex-wrap">
          {[maxPoints, Math.round(maxPoints * 0.9), Math.round(maxPoints * 0.8), Math.round(maxPoints * 0.7)].map((v, i) => (
            <button
              key={i}
              onClick={() => setPoints(String(v))}
              className="h-[32px] px-3 border border-field-border bg-panel rounded-[7px] font-mono text-[12.5px] font-semibold text-muted hover:bg-track transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="grading-feedback" className="block text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Feedback to student</label>
        <textarea
          id="grading-feedback"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          rows={3}
          placeholder="Optional — what went well, what to work on…"
          className="w-full bg-field-bg border border-field-border rounded-[10px] px-3 py-2.5 text-[13.5px] text-ink leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
        />
      </div>

      <div className="flex items-center gap-2.5 pt-1.5 border-t border-line-2">
        <button
          onClick={() => submit(true)}
          disabled={!canSave}
          className="h-[42px] px-5 border-none bg-btn-primary-bg text-btn-primary-fg rounded-[10px] text-[14px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed"
        >
          {hasNext ? 'Save & next' : 'Save & finish'}
        </button>
        <button
          onClick={() => submit(false)}
          disabled={!canSave}
          className="h-[42px] px-4 border border-btn-border bg-panel text-ink-2 rounded-[10px] text-[14px] font-semibold disabled:opacity-40 hover:bg-track transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          Save
        </button>
        <div className="flex-1" />
        {queuePosition && (
          <span className="text-[12.5px] text-faint">
            {queuePosition.index + 1} of {queuePosition.total} in queue
          </span>
        )}
      </div>
    </>
  )
}

export default GradeForm

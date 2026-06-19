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

const SECTION = 'bg-panel-2 border border-line rounded-card-lg p-5'
const SECTION_TITLE = 'text-[13px] font-semibold text-ink mb-4 flex items-center gap-2'
const ROW = 'flex items-center justify-between py-2.5 border-b border-line last:border-0'
const ROW_LABEL = 'text-[12.5px] text-muted flex items-center gap-2'
const ROW_VALUE = 'text-[13px] font-medium text-ink'

const statusBadge = (status: string) => {
  switch (status) {
    case 'not_started': return 'bg-track text-faint border border-line'
    case 'in_progress': return 'bg-accent/10 text-accent border border-accent/20'
    case 'submitted': return 'bg-pos-bg text-pos-fg border border-[var(--pos-fg)]/20'
    case 'graded': return 'bg-pos-bg text-pos-fg border border-[var(--pos-fg)]/20'
    case 'overdue': return 'bg-neg-bg text-neg-fg border border-[var(--neg-fg)]/20'
    default: return 'bg-track text-faint border border-line'
  }
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
    if (isOpen && assignmentId) fetchAssignmentDetails()
  }, [isOpen, assignmentId, studentId])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose() }
    if (isOpen) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [isOpen, onClose])

  const fetchAssignmentDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await assignmentsApi.getStudentAssignment(assignmentId)
      if (data.template) {
        setAssignment(data as DetailedAssignment)
      } else {
        setError('Assignment template not found')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assignment details')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const pct = assignment?.percentage_grade
  const pctColor = pct == null ? 'text-muted' : pct >= 90 ? 'text-pos-fg' : pct >= 70 ? 'text-accent' : 'text-neg-fg'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Assignment Details</h3>
            {assignment && (
              <p className="text-[12px] text-muted mt-0.5">{assignment.template?.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-faint">Loading…</p>
            </div>
          )}

          {error && (
            <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{error}</div>
          )}

          {assignment && (
            <>
              {/* Hero summary */}
              <div className={SECTION}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-[18px] font-bold text-ink mb-1">{assignment.template?.name}</h2>
                    <p className="text-[12.5px] text-muted">Assignment #{assignment.id}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${statusBadge(assignment.status)}`}>
                    {assignment.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      value: assignment.points_earned !== null && assignment.points_earned !== undefined
                        ? `${assignment.points_earned} / ${assignment.custom_max_points || assignment.template?.max_points || 0}`
                        : `— / ${assignment.custom_max_points || assignment.template?.max_points || 0}`,
                      label: 'Points'
                    },
                    { value: assignment.letter_grade || '—', label: 'Letter Grade' },
                    {
                      value: assignment.template?.estimated_duration_minutes
                        ? `${assignment.template.estimated_duration_minutes}m` : '—',
                      label: 'Est. Duration'
                    },
                    { value: `${assignment.time_spent_minutes ?? 0}m`, label: 'Time Spent' },
                  ].map(({ value, label }) => (
                    <div key={label} className="bg-panel border border-line rounded-field p-3 text-center">
                      <div className={`text-[15px] font-semibold ${label === 'Letter Grade' && pct != null ? pctColor : 'text-ink'}`}>{value}</div>
                      <div className="text-[11px] text-faint mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {pct !== null && pct !== undefined && (
                  <p className={`text-right text-[12.5px] font-semibold mt-2 ${pctColor}`}>{pct.toFixed(1)}%</p>
                )}
              </div>

              {/* Description & instructions */}
              {(assignment.template?.description || assignment.template?.instructions || assignment.custom_instructions) && (
                <div className={SECTION}>
                  <h3 className={SECTION_TITLE}><FileText className="w-4 h-4 text-muted" /> Assignment Details</h3>

                  {assignment.template?.description && (
                    <div className="mb-4">
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5">Description</p>
                      <div className="text-[13.5px] text-ink">
                        <MarkdownRenderer content={assignment.template.description} />
                      </div>
                    </div>
                  )}

                  {assignment.template?.instructions && (
                    <div className="mb-4">
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5">Instructions</p>
                      <div className="text-[13.5px] text-ink">
                        <MarkdownRenderer content={assignment.template.instructions} />
                      </div>
                    </div>
                  )}

                  {assignment.custom_instructions && (
                    <div className="px-3 py-2.5 bg-accent/6 border border-accent/20 rounded-field">
                      <p className="text-[11.5px] font-semibold text-accent uppercase tracking-wide mb-1">Custom Instructions</p>
                      <div className="text-[13px] text-ink">
                        <MarkdownRenderer content={assignment.custom_instructions} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className={SECTION}>
                <h3 className={SECTION_TITLE}><Clock className="w-4 h-4 text-muted" /> Timeline</h3>
                <div>
                  {assignment.assigned_date && (
                    <div className={ROW}>
                      <span className={ROW_LABEL}><Calendar className="w-3.5 h-3.5" /> Assigned</span>
                      <span className={ROW_VALUE}>{formatDateOnly(assignment.assigned_date)}</span>
                    </div>
                  )}
                  {assignment.due_date && (
                    <div className={ROW}>
                      <span className={ROW_LABEL}><Target className="w-3.5 h-3.5 text-[var(--neg-fg)]" /> Due</span>
                      <span className={ROW_VALUE}>{formatDateOnly(assignment.due_date)}</span>
                    </div>
                  )}
                  {assignment.started_date && (
                    <div className={ROW}>
                      <span className={ROW_LABEL}><CheckCircle className="w-3.5 h-3.5 text-accent" /> Started</span>
                      <span className={ROW_VALUE}>{formatDateOnly(assignment.started_date)}</span>
                    </div>
                  )}
                  {assignment.submitted_date && (
                    <div className={ROW}>
                      <span className={ROW_LABEL}><AlertCircle className="w-3.5 h-3.5 text-pos-fg" /> Submitted</span>
                      <span className={ROW_VALUE}>{formatDateOnly(assignment.submitted_date)}</span>
                    </div>
                  )}
                  {assignment.graded_date && (
                    <div className={ROW}>
                      <span className={ROW_LABEL}><Award className="w-3.5 h-3.5 text-pos-fg" /> Graded</span>
                      <span className={ROW_VALUE}>{formatDateOnly(assignment.graded_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submission */}
              {(assignment.submission_notes || (assignment.submission_artifacts && assignment.submission_artifacts.length > 0)) && (
                <div className={SECTION}>
                  <h3 className={SECTION_TITLE}><Users className="w-4 h-4 text-muted" /> Your Submission</h3>

                  {assignment.submission_notes && (
                    <div className="mb-3">
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" /> Notes
                      </p>
                      <div className="px-3 py-2.5 bg-accent/6 border border-accent/15 rounded-field text-[13px] text-ink whitespace-pre-wrap">
                        {assignment.submission_notes}
                      </div>
                    </div>
                  )}

                  {assignment.submission_artifacts && assignment.submission_artifacts.length > 0 && (
                    <div>
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" /> Links ({assignment.submission_artifacts.length})
                      </p>
                      <div className="space-y-1.5">
                        {assignment.submission_artifacts.map((link, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-panel border border-line rounded-field">
                            <ExternalLink className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] text-accent underline hover:opacity-80 break-all"
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

              {/* Feedback & notes */}
              {(assignment.teacher_feedback || assignment.student_notes) && (
                <div className={SECTION}>
                  <h3 className={SECTION_TITLE}><MessageSquare className="w-4 h-4 text-muted" /> Notes & Feedback</h3>

                  {assignment.teacher_feedback && (
                    <div className="mb-3">
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5">Teacher Feedback</p>
                      <div className="px-3 py-2.5 bg-pos-bg border border-[var(--pos-fg)]/20 rounded-field text-[13px] text-pos-fg whitespace-pre-wrap">
                        {assignment.teacher_feedback}
                      </div>
                    </div>
                  )}

                  {assignment.student_notes && (
                    <div>
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5">Student Notes</p>
                      <div className="px-3 py-2.5 bg-track border border-line rounded-field text-[13px] text-ink whitespace-pre-wrap">
                        {assignment.student_notes}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Additional info */}
              {(assignment.template?.prerequisites || assignment.template?.materials_needed) && (
                <div className={SECTION}>
                  <h3 className={SECTION_TITLE}><BookOpen className="w-4 h-4 text-muted" /> Additional Information</h3>

                  {assignment.template?.prerequisites && (
                    <div className="mb-4">
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5">Prerequisites</p>
                      <div className="text-[13.5px] text-ink">
                        <MarkdownRenderer content={assignment.template.prerequisites} />
                      </div>
                    </div>
                  )}

                  {assignment.template?.materials_needed && (
                    <div>
                      <p className="text-[11.5px] font-semibold text-muted uppercase tracking-wide mb-1.5">Materials Needed</p>
                      <div className="text-[13.5px] text-ink">
                        <MarkdownRenderer content={assignment.template.materials_needed} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-line bg-panel-2">
          <button
            onClick={onClose}
            className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AssignmentDetailModal

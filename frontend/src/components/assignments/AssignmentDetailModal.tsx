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
  FileText,
  Calendar,
  Clock,
  Target,
  Award,
  BookOpen,
  MessageSquare,
  Paperclip,
  CheckCircle,
  AlertCircle,
  Users
} from 'lucide-react'
import { assignmentsApi } from '../../services/assignments'
import { paperlessApi } from '../../services/paperless'
import { StudentAssignment, AssignmentTemplate } from '../../types'
import MarkdownRenderer from '../common/MarkdownRenderer'
import { formatDateOnly } from '../../utils/formatters'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Spinner, useToast } from '../ui'
import { getErrorMessage } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { usePaperlessStatus } from '../../hooks/usePaperlessStatus'
import DocumentThumb from '../materials/DocumentThumb'
import DocumentViewerModal from '../materials/DocumentViewerModal'
import PaperlessPickerModal from '../lessons/PaperlessPickerModal'
import { kindBadge } from '../materials/materialsLogic'
import { PaperlessMaterial } from '../../types/paperless'
import { attachedIds, combinedMaterials } from './assignmentMaterialsLogic'
import { AssignmentInfo, SubmissionCard } from './AssignmentInfo'
import AssignmentTimeLog from './AssignmentTimeLog'

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

// Outer shell remounts the content when the target assignment changes so
// loading/detail state resets through useState initializers.
const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = (props) => (
  <AssignmentDetailModalContent key={props.assignmentId} {...props} />
)

const AssignmentDetailModalContent: React.FC<AssignmentDetailModalProps> = ({
  assignmentId,
  studentId,
  isOpen,
  onClose
}) => {
  const { toast } = useToast()
  const { user } = useAuth()
  const { status: paperlessStatus } = usePaperlessStatus()
  const [assignment, setAssignment] = useState<DetailedAssignment | null>(null)
  const [loading, setLoading] = useState(isOpen && !!assignmentId)
  const [error, setError] = useState<string | null>(null)
  const [viewingMaterial, setViewingMaterial] = useState<PaperlessMaterial | null>(null)
  // One-off materials on this instance; editable by admins (write-through).
  const [instanceMaterials, setInstanceMaterials] = useState<PaperlessMaterial[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busyDocId, setBusyDocId] = useState<number | null>(null)

  useEffect(() => {
    if (!isOpen || !assignmentId) return
    const fetchAssignmentDetails = async () => {
      try {
        const data = await assignmentsApi.getStudentAssignment(assignmentId)
        if (data.template) {
          setAssignment(data as DetailedAssignment)
          setInstanceMaterials(data.paperless_materials ?? [])
          setError(null)
        } else {
          setError('Assignment template not found')
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load assignment details'))
      } finally {
        setLoading(false)
      }
    }
    fetchAssignmentDetails()
  }, [isOpen, assignmentId, studentId])

  const isAdmin = user?.role === 'admin'
  const canEditMaterials = isAdmin && paperlessStatus?.connected === true
  const materialRows = combinedMaterials(
    assignment?.template?.paperless_materials ?? [],
    instanceMaterials
  )

  const handleRemoveInstanceMaterial = async (material: PaperlessMaterial) => {
    if (!assignment) return
    setBusyDocId(material.document_id)
    try {
      await paperlessApi.detachFromAssignment(assignment.id, material.document_id)
      setInstanceMaterials((prev) =>
        prev.filter((m) => m.document_id !== material.document_id)
      )
      toast('Material removed from this assignment')
    } catch (err) {
      toast(getErrorMessage(err, 'Could not remove document'), 'danger')
    } finally {
      setBusyDocId(null)
    }
  }

  const pct = assignment?.percentage_grade
  const pctColor = pct == null ? 'text-muted' : pct >= 90 ? 'text-pos-fg' : pct >= 70 ? 'text-accent' : 'text-neg-fg'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assignment Details"
      subtitle={assignment?.template?.name}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>Close</Button>
      }
    >
      <div className="space-y-4">
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
                  <div className="flex items-center gap-2">
                    <p className="text-[12.5px] text-muted">Assignment #{assignment.id}</p>
                    {assignment.is_student_created && <span className="px-2 py-0.5 rounded-pill bg-accent-soft text-accent text-[10px] font-semibold uppercase tracking-wide">Student created</span>}
                  </div>
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

                <AssignmentInfo
                  description={assignment.template?.description}
                  instructions={assignment.template?.instructions}
                  customInstructions={assignment.custom_instructions}
                />
              </div>
            )}

            {/* Attached documents (template materials + this assignment's) */}
            {(materialRows.length > 0 || canEditMaterials) && (
              <div className={SECTION}>
                <h3 className={SECTION_TITLE}>
                  <Paperclip className="w-4 h-4 text-muted" /> Attached Documents
                </h3>
                <div className="space-y-1.5">
                  {materialRows.map(({ material, fromTemplate, fromInstance }) => (
                    <div
                      key={material.document_id}
                      className="flex items-center gap-3 px-3 py-2 bg-panel border border-line rounded-field"
                    >
                      <DocumentThumb
                        externalId={material.external_id}
                        title={material.title}
                        className="w-[28px] h-[36px] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate">
                          {material.title}
                        </p>
                        <p className="font-mono text-[9.5px] text-faint tracking-wide">
                          {kindBadge(material.material_kind)}
                          {material.page_count ? ` · ${material.page_count} pp` : ''}
                          {isAdmin &&
                            ` · ${
                              fromTemplate && fromInstance
                                ? 'TEMPLATE + THIS ASSIGNMENT'
                                : fromTemplate
                                  ? 'TEMPLATE'
                                  : 'THIS ASSIGNMENT'
                            }`}
                        </p>
                      </div>
                      {canEditMaterials &&
                        fromInstance &&
                        (busyDocId === material.document_id ? (
                          <Spinner size="sm" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveInstanceMaterial(material)}
                            className="text-[12px] font-medium text-muted hover:text-danger transition-colors flex-shrink-0"
                          >
                            Remove
                          </button>
                        ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingMaterial(material)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                  {canEditMaterials && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="w-full py-2.5 rounded-[10px] border border-dashed border-btn-border text-[12.5px] font-semibold text-faint hover:text-ink hover:border-faint transition-colors"
                    >
                      ＋ Attach to this assignment
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className={SECTION}>
              <h3 className={SECTION_TITLE}><Clock className="w-4 h-4 text-muted" /> Work sessions</h3>
              <AssignmentTimeLog
                assignment={assignment}
                onTotalChanged={minutes => setAssignment(current => current ? { ...current, time_spent_minutes: minutes } : current)}
              />
            </div>

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

                <SubmissionCard
                  notes={assignment.submission_notes}
                  artifacts={assignment.submission_artifacts}
                />
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

      <DocumentViewerModal
        material={viewingMaterial}
        onClose={() => setViewingMaterial(null)}
      />

      {canEditMaterials && assignment && (
        <PaperlessPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          attachedDocumentIds={attachedIds(
            assignment.template?.paperless_materials ?? [],
            instanceMaterials
          )}
          subjectId={assignment.template?.subject_id}
          attach={(doc) => paperlessApi.attachToAssignment(assignment.id, doc.id)}
          attachNoun="assignment"
          onAttached={(added) =>
            setInstanceMaterials((prev) => [...prev, ...added])
          }
        />
      )}
    </Modal>
  )
}

export default AssignmentDetailModal

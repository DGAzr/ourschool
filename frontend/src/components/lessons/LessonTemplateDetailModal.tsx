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

import { useEffect, useState } from 'react'
import { ClipboardList, GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { AssignmentInfo } from '../assignments/AssignmentInfo'
import { assignmentsApi } from '../../services/assignments'
import { AssignmentTemplate, StudentAssignment } from '../../types/assignment'
import {
  LessonStudentSummary,
  LessonTemplateLink,
  LessonTemplateSummary,
} from '../../types/lesson'

interface LessonTemplateDetailModalProps {
  /** The lesson's template link to show, or null when closed. */
  link: LessonTemplateLink | null
  lessonId: number
  students: LessonStudentSummary[]
  onClose: () => void
}

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">{label}</p>
    <p className="text-[13.5px] text-ink font-medium">{value}</p>
  </div>
)

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Read-only detail view for an assignment template linked to a lesson.
 *
 * The outer component remounts the content per link so template/error state
 * starts fresh (DocumentViewerModal pattern — no state-sync effect).
 */
const LessonTemplateDetailModal: React.FC<LessonTemplateDetailModalProps> = (
  props
) =>
  props.link && props.link.template ? (
    <DetailContent key={props.link.id} {...props} link={props.link} />
  ) : null

interface DetailContentProps extends LessonTemplateDetailModalProps {
  link: LessonTemplateLink
}

const DetailContent: React.FC<DetailContentProps> = ({
  link,
  lessonId,
  students,
  onClose,
}) => {
  const navigate = useNavigate()
  const [template, setTemplate] = useState<AssignmentTemplate | null>(null)
  const [gradingAssignments, setGradingAssignments] = useState<
    StudentAssignment[]
  >([])
  const [error, setError] = useState(false)
  const templateId = link.template_id ?? null

  useEffect(() => {
    if (templateId == null) return
    let cancelled = false
    assignmentsApi
      .getById(templateId)
      .then((t) => { if (!cancelled) setTemplate(t) })
      .catch(() => { if (!cancelled) setError(true) })
    assignmentsApi
      .getTemplateAssignments(templateId)
      .then((assignments) => {
        if (!cancelled) {
          setGradingAssignments(
            assignments.filter((assignment) => assignment.lesson_id === lessonId)
          )
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [lessonId, templateId])

  const summary = link.template as LessonTemplateSummary

  const points =
    link.custom_max_points != null
      ? `${link.custom_max_points} pts (lesson override, normally ${summary.max_points})`
      : `${summary.max_points} pts`

  const studentLabel = (studentId: number) => {
    const student = students.find((candidate) => candidate.id === studentId)
    if (!student) return `Student ${studentId}`
    return (
      `${student.first_name} ${student.last_name}`.trim() || student.username
    )
  }

  const openGrading = (assignmentId: number) => {
    onClose()
    navigate('/grading', { state: { assignmentId } })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={summary.name}
      subtitle="Assignment template"
      icon={<ClipboardList size={15} />}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Meta label="Type" value={summary.assignment_type} />
          <Meta label="Points" value={points} />
          {summary.estimated_duration_minutes != null && (
            <Meta label="Duration" value={`${summary.estimated_duration_minutes} min`} />
          )}
          {link.custom_due_date && (
            <Meta label="Due (lesson override)" value={formatDueDate(link.custom_due_date)} />
          )}
        </div>

        {error ? (
          <p className="text-[13px] text-neg-fg">
            Could not load assignment details. Close and try again.
          </p>
        ) : template ? (
          <AssignmentInfo
            description={template.description}
            instructions={template.instructions}
            customInstructions={link.custom_instructions}
          />
        ) : (
          <p className="text-[13px] text-faint">Loading details…</p>
        )}

        {gradingAssignments.length > 0 && (
          <div className="border-t border-line pt-4">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-2">
              Grading
            </p>
            <div className="flex flex-wrap gap-2">
              {gradingAssignments.map((assignment) => (
                <Button
                  key={assignment.id}
                  variant="outline"
                  size="sm"
                  icon={<GraduationCap size={14} />}
                  onClick={() => openGrading(assignment.id)}
                >
                  {gradingAssignments.length === 1
                    ? 'Open in grading'
                    : `Open ${studentLabel(assignment.student_id)} in grading`}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default LessonTemplateDetailModal

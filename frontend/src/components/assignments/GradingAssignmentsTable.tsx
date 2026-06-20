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

import React, { useState, useEffect, useRef } from 'react'
import { MoreVertical, Edit3, Trash2, Archive, Award, Play, FileCheck, Calendar, User, BookOpen } from 'lucide-react'
import { StudentAssignment, Subject, User as UserType } from '../../types'
import { assignmentUtils } from '../../services/assignments'
import { isPastDateOnly } from '../../utils/formatters'
import InlineGradeForm from './InlineGradeForm'

interface GradingAssignmentsTableProps {
  assignments: StudentAssignment[]
  subjects: Subject[]
  students: UserType[]
  onGradeAssignment: (assignment: StudentAssignment) => void
  onEditAssignment: (assignment: StudentAssignment) => void
  onArchiveAssignment: (assignment: StudentAssignment) => void
  onDeleteAssignment: (assignment: StudentAssignment) => void
  onUpdateAssignmentStatus: (assignmentId: number, status: string) => void
  onRefresh?: () => void
  emptyMessage?: string
  emptyDescription?: string
}

const STATUS_BADGE: Record<string, string> = {
  not_started: 'bg-panel-2 text-muted',
  in_progress:  'bg-accent/10 text-accent',
  submitted:    'bg-pos-bg text-pos-fg',
  graded:       'bg-accent/10 text-accent',
}

const GRADE_BADGE = (pct: number) => {
  if (pct >= 90) return 'bg-pos-bg text-pos-fg'
  if (pct >= 80) return 'bg-accent/10 text-accent'
  if (pct >= 70) return 'bg-panel-2 text-muted'
  return 'bg-neg-bg text-neg-fg'
}

const GradingAssignmentsTable: React.FC<GradingAssignmentsTableProps> = ({
  assignments, subjects, students,
  onGradeAssignment, onEditAssignment, onArchiveAssignment, onDeleteAssignment,
  onUpdateAssignmentStatus, onRefresh,
  emptyMessage = 'No assignments found',
  emptyDescription = 'No assignments have been created yet.'
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [inlineGradeId, setInlineGradeId] = useState<number | null>(null)
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId && dropdownRefs.current[openDropdownId] &&
          !dropdownRefs.current[openDropdownId]?.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
    }
    if (openDropdownId) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdownId])

  const getSubjectById = (id: number) => subjects.find(s => s.id === id)
  const getStudentById = (id: number) => students.find(s => s.id === id)

  const urgencyDot = (assignment: StudentAssignment) => {
    if (!assignment.due_date) return null
    const diff = Math.ceil((new Date(assignment.due_date + 'T00:00:00').getTime() - Date.now()) / 86400000)
    if (diff < 0) return <span className="w-2 h-2 bg-neg-fg rounded-full flex-none" title="Overdue" />
    if (diff <= 1) return <span className="w-2 h-2 bg-accent rounded-full flex-none" title="Due soon" />
    if (diff <= 3) return <span className="w-2 h-2 bg-[#B0762F] rounded-full flex-none" title="Due this week" />
    return null
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-panel border border-line rounded-card-lg p-6">
        <div className="text-center py-8">
          <BookOpen className="h-10 w-10 text-faintest mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-ink mb-1">{emptyMessage}</p>
          <p className="text-[13px] text-muted">{emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-card-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-line flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted" />
        <h3 className="text-[14px] font-semibold text-ink">Assignment Details</h3>
        <span className="text-[12px] text-faint">({assignments.length})</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-panel-2 border-b border-line">
            <tr>
              {['Assignment', 'Student', 'Subject', 'Due Date', 'Status', 'Points', 'Grade', 'Actions'].map(col => (
                <th key={col} className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {assignments.map((assignment) => {
              const subject = assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined
              const student = getStudentById(assignment.student_id)
              const template = assignment.template
              const isOverdue = isPastDateOnly(assignment.due_date) && assignment.status !== 'graded'
              const maxPts = assignment.custom_max_points || template?.max_points || 100
              const pct = maxPts > 0 ? ((assignment.points_earned || 0) / maxPts) * 100 : 0

              return (
                <React.Fragment key={assignment.id}>
                  <tr className="hover:bg-panel-2 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-2">
                        {urgencyDot(assignment)}
                        <span className="text-base mt-0.5">{assignmentUtils.getAssignmentTypeIcon(template?.assignment_type || '')}</span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ink">{template?.name || 'Unknown'}</div>
                          {assignment.custom_instructions && (
                            <div className="text-[11px] text-faint mt-0.5 line-clamp-1">
                              <strong>Instructions:</strong> {assignment.custom_instructions}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-[11px] text-faintest mt-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(assignment.assigned_date + 'T00:00:00').toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[13px] text-ink">
                        <User className="h-3 w-3 text-faint" />
                        {student?.first_name} {student?.last_name}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject?.color || 'var(--faintest)' }} />
                        <span className="text-[13px] text-ink">{subject?.name || 'Unknown'}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className={`text-[13px] ${isOverdue ? 'text-neg-fg font-semibold' : 'text-ink'}`}>
                        {assignment.due_date ? new Date(assignment.due_date + 'T00:00:00').toLocaleDateString() : 'No due date'}
                      </div>
                      {isOverdue && <div className="text-[11px] text-neg-fg">Overdue</div>}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[assignment.status] ?? 'bg-panel-2 text-muted'}`}>
                        {assignment.status.replace('_', ' ').charAt(0).toUpperCase() + assignment.status.replace('_', ' ').slice(1)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-ink font-mono">
                      {assignment.points_earned != null
                        ? `${assignment.points_earned} / ${maxPts}`
                        : `— / ${maxPts}`}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {assignment.is_graded && assignment.letter_grade
                        ? <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${GRADE_BADGE(pct)}`}>{assignment.letter_grade}</span>
                        : <span className="text-[12px] text-faint">Not graded</span>}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {!assignment.is_graded && (
                          <button
                            onClick={() => setInlineGradeId(inlineGradeId === assignment.id ? null : assignment.id)}
                            className={`p-1.5 rounded-field transition-colors ${inlineGradeId === assignment.id ? 'text-accent bg-accent/10' : 'text-pos-fg hover:bg-pos-bg'}`}
                            title="Grade inline"
                          >
                            <Award className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {assignment.is_graded && (
                          <button
                            onClick={() => setInlineGradeId(inlineGradeId === assignment.id ? null : assignment.id)}
                            className={`p-1.5 rounded-field transition-colors ${inlineGradeId === assignment.id ? 'text-accent bg-accent/10' : 'text-accent hover:bg-accent/10'}`}
                            title="Edit grade inline"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <div className="relative" ref={(el) => dropdownRefs.current[assignment.id] = el}>
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === assignment.id ? null : assignment.id)}
                            className="p-1.5 rounded-field text-faint hover:text-ink hover:bg-panel-2 transition-colors"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                          {openDropdownId === assignment.id && (
                            <div className="absolute right-0 top-8 w-44 bg-panel border border-line rounded-card shadow-lg z-10">
                              <button onClick={() => { onEditAssignment(assignment); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2">
                                <Edit3 className="h-3 w-3" />Edit Details
                              </button>
                              {assignment.status === 'not_started' && (
                                <button onClick={() => { onUpdateAssignmentStatus(assignment.id, 'in_progress'); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-accent hover:bg-accent/10 flex items-center gap-2">
                                  <Play className="h-3 w-3" />Start Assignment
                                </button>
                              )}
                              {assignment.status === 'in_progress' && (
                                <button onClick={() => { onUpdateAssignmentStatus(assignment.id, 'submitted'); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-pos-fg hover:bg-pos-bg flex items-center gap-2">
                                  <FileCheck className="h-3 w-3" />Mark Submitted
                                </button>
                              )}
                              {!assignment.is_graded && (
                                <button
                                  onClick={() => {
                                    if (assignment.status !== 'submitted') {
                                      onUpdateAssignmentStatus(assignment.id, 'submitted')
                                      setTimeout(() => { onGradeAssignment(assignment); setOpenDropdownId(null) }, 100)
                                    } else { onGradeAssignment(assignment); setOpenDropdownId(null) }
                                  }}
                                  className="w-full text-left px-3 py-2 text-[12px] text-pos-fg hover:bg-pos-bg flex items-center gap-2"
                                >
                                  <Award className="h-3 w-3" />{assignment.status === 'submitted' ? 'Grade Now' : 'Submit & Grade'}
                                </button>
                              )}
                              <button onClick={() => { onArchiveAssignment(assignment); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2">
                                <Archive className="h-3 w-3" />Archive
                              </button>
                              <button onClick={() => { onDeleteAssignment(assignment); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-neg-fg hover:bg-neg-bg flex items-center gap-2">
                                <Trash2 className="h-3 w-3" />Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {inlineGradeId === assignment.id && (
                    <tr>
                      <td colSpan={8} className="px-5 pb-3 pt-0">
                        <InlineGradeForm
                          assignment={assignment}
                          onSuccess={() => { setInlineGradeId(null); onRefresh?.() }}
                          onCancel={() => setInlineGradeId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default GradingAssignmentsTable

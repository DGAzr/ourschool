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

import React, { useState, useMemo, useEffect } from 'react'
import { AssignmentReport as AssignmentReportType } from '../../../types'
import { Term } from '../../../types/term'
import { reportsApi } from '../../../services/reports'
import AssignmentDetailModal from '../../assignments/AssignmentDetailModal'
import ReportHeader from '../shared/ReportHeader'
import { StatTile, Pill, statusToPillVariant, Select } from '../../ui'

interface AssignmentReportProps {
  assignmentReport: AssignmentReportType | null
  loading: boolean
}

const gradeBg = (p: number) =>
  p >= 90 ? 'bg-pos-bg text-pos-fg' : p >= 80 ? 'bg-info-bg text-info-fg' : p >= 70 ? 'bg-sub-bg text-sub-fg' : 'bg-neg-bg text-neg-fg'

const AssignmentReport: React.FC<AssignmentReportProps> = ({ assignmentReport, loading }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)
  const [allTerms, setAllTerms] = useState<Term[]>([])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [selectedAssignmentStudentId, setSelectedAssignmentStudentId] = useState<number | null>(null)

  useEffect(() => {
    reportsApi.getTerms().then(setAllTerms).catch(() => {})
  }, [])

  useEffect(() => {
    if (assignmentReport?.available_students?.length && selectedStudentId === null) {
      setSelectedStudentId(assignmentReport.available_students[0].id)
    }
    if (assignmentReport?.available_terms?.length && allTerms.length && selectedTermId === null) {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const availableIds = new Set(assignmentReport.available_terms.map(t => t.id))
      const active = allTerms.filter(t => t.is_active && availableIds.has(t.id))
      let best = active[0] || assignmentReport.available_terms[0]
      if (active.length > 0) {
        const seasonal = active.find(t => {
          const n = t.name.toLowerCase()
          if (currentMonth >= 8 && currentMonth <= 12) return n.includes('fall') || n.includes('semester 1') || n.includes('q1')
          if (currentMonth >= 1 && currentMonth <= 5) return n.includes('spring') || n.includes('semester 2') || n.includes('q2')
          return n.includes('summer') || n.includes('q3')
        })
        if (seasonal) best = seasonal
      }
      setSelectedTermId(best.id)
    }
  }, [assignmentReport, selectedStudentId, selectedTermId, allTerms])

  const filteredAssignments = useMemo(() => {
    if (!assignmentReport?.assignments) return []
    return assignmentReport.assignments.filter(a => {
      const matchesStudent = !selectedStudentId || a.student_id === selectedStudentId
      const matchesTerm = !selectedTermId || a.term_id === selectedTermId
      return matchesStudent && matchesTerm
    })
  }, [assignmentReport?.assignments, selectedStudentId, selectedTermId])

  const summary = useMemo(() => {
    const total = filteredAssignments.length
    const completed = filteredAssignments.filter(a => a.status === 'graded').length
    const inProgress = filteredAssignments.filter(a => a.status === 'in_progress').length
    const overdue = filteredAssignments.filter(a => a.due_date && new Date(a.due_date) < new Date() && a.status !== 'graded').length
    const graded = filteredAssignments.filter(a => a.percentage_grade != null)
    const avgGrade = graded.length ? graded.reduce((s, a) => s + (a.percentage_grade || 0), 0) / graded.length : null
    return { total, completed, inProgress, overdue, avgGrade }
  }, [filteredAssignments])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  if (!assignmentReport) {
    return (
      <>
        <ReportHeader title="Assignment Report" subtitle="Detailed assignment data filtered by student and term." />
        <div className="py-16 text-center bg-panel border border-line rounded-card">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">No assignment data yet</p>
          <p className="text-[13px] text-muted">Reports will appear once assignments are created and submitted.</p>
        </div>
      </>
    )
  }

  const studentOptions = [
    { value: '', label: 'All students' },
    ...(assignmentReport.available_students || []).map(s => ({ value: String(s.id), label: s.name })),
  ]
  const termOptions = [
    { value: '', label: 'All terms' },
    ...(assignmentReport.available_terms || []).map(t => ({ value: String(t.id), label: `${t.name} (${t.academic_year})` })),
  ]

  return (
    <div className="space-y-5">
      <ReportHeader title="Assignment Report" subtitle="Detailed assignment data filtered by student and term." />

      {/* Filters */}
      <div className="bg-panel border border-line rounded-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Student"
            value={String(selectedStudentId || '')}
            onChange={e => setSelectedStudentId(Number(e.target.value) || null)}
            options={studentOptions}
          />
          <Select
            label="Term"
            value={String(selectedTermId || '')}
            onChange={e => setSelectedTermId(Number(e.target.value) || null)}
            options={termOptions}
          />
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Total" value={String(summary.total)} />
        <StatTile label="Completed" value={String(summary.completed)} accent={summary.completed > 0} />
        <StatTile label="In Progress" value={String(summary.inProgress)} />
        <StatTile label="Overdue" value={String(summary.overdue)} />
        <StatTile label="Avg Grade" value={summary.avgGrade != null ? `${summary.avgGrade.toFixed(1)}%` : '—'} accent={summary.avgGrade != null && summary.avgGrade >= 80} />
      </div>

      {/* Table */}
      {filteredAssignments.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-panel-2">
              <tr>
                {['Assignment', 'Subject', 'Due Date', 'Status', 'Points', 'Grade'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-panel divide-y divide-line">
              {filteredAssignments.map(a => {
                const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'graded'
                return (
                  <tr
                    key={a.assignment_id}
                    className="hover:bg-panel-2 transition-colors cursor-pointer"
                    onClick={() => { setSelectedAssignmentId(a.assignment_id); setSelectedAssignmentStudentId(a.student_id || null); setShowDetailModal(true) }}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="text-[13.5px] font-semibold text-ink">{a.assignment_name}</p>
                      <p className="text-[11.5px] text-faint font-mono">Assigned {new Date(a.assigned_date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: a.subject_color || 'var(--accent)' }} />
                        <span className="text-[13.5px] text-ink-2">{a.subject_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`text-[13px] font-mono ${isOverdue ? 'text-neg-fg font-semibold' : 'text-ink-2'}`}>
                        {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Pill variant={statusToPillVariant(a.status)}>{a.status.replace('_', ' ')}</Pill>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13.5px] font-mono text-ink-2">
                      {a.points_earned != null ? `${a.points_earned} / ${a.max_points}` : `— / ${a.max_points}`}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {a.percentage_grade != null ? (
                        <span className={`text-[11.5px] font-bold px-2 py-0.5 rounded-pill ${gradeBg(a.percentage_grade)}`}>
                          {a.percentage_grade.toFixed(1)}% {a.letter_grade ? `· ${a.letter_grade}` : ''}
                        </span>
                      ) : (
                        <span className="text-[13px] text-faint">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-16 text-center bg-panel border border-line rounded-card">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">No assignments found</p>
          <p className="text-[13px] text-muted">Try adjusting your student or term filter.</p>
        </div>
      )}

      {showDetailModal && selectedAssignmentId && (
        <AssignmentDetailModal
          assignmentId={selectedAssignmentId}
          studentId={selectedAssignmentStudentId || undefined}
          isOpen={showDetailModal}
          onClose={() => { setShowDetailModal(false); setSelectedAssignmentId(null); setSelectedAssignmentStudentId(null) }}
        />
      )}
    </div>
  )
}

export default AssignmentReport

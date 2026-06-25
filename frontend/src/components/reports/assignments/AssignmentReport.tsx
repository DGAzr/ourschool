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
import { Pill, statusToPillVariant, Select } from '../../ui'
import { isPastDateOnly, formatDateOnly } from '../../../utils/formatters'
import DonutChart from '../shared/DonutChart'

interface AssignmentReportProps {
  assignmentReport: AssignmentReportType | null
  loading: boolean
}

const DONUT_COLORS: Record<string, string> = {
  graded: 'var(--pos-fg)',
  in_progress: '#4F7CAC',
  submitted: 'var(--accent)',
  not_started: 'var(--faintest)',
  overdue: 'var(--neg-fg)',
}

const STATUS_LABELS: Record<string, string> = {
  graded: 'Graded',
  in_progress: 'In progress',
  submitted: 'Submitted',
  not_started: 'Not started',
  overdue: 'Overdue',
}

const gradeBg = (p: number) =>
  p >= 90
    ? 'bg-pos-bg text-pos-fg'
    : p >= 80
    ? 'bg-info-bg text-info-fg'
    : p >= 70
    ? 'bg-sub-bg text-sub-fg'
    : 'bg-neg-bg text-neg-fg'

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
      const availableIds = new Set(assignmentReport.available_terms.map((t) => t.id))
      const active = allTerms.filter((t) => t.is_active && availableIds.has(t.id))
      let best = active[0] || assignmentReport.available_terms[0]
      if (active.length > 0) {
        const seasonal = active.find((t) => {
          const n = t.name.toLowerCase()
          if (currentMonth >= 8 && currentMonth <= 12)
            return n.includes('fall') || n.includes('semester 1') || n.includes('q1')
          if (currentMonth >= 1 && currentMonth <= 5)
            return n.includes('spring') || n.includes('semester 2') || n.includes('q2')
          return n.includes('summer') || n.includes('q3')
        })
        if (seasonal) best = seasonal
      }
      setSelectedTermId(best.id)
    }
  }, [assignmentReport, selectedStudentId, selectedTermId, allTerms])

  const filteredAssignments = useMemo(() => {
    if (!assignmentReport?.assignments) return []
    return assignmentReport.assignments.filter((a) => {
      const matchesStudent = !selectedStudentId || a.student_id === selectedStudentId
      const matchesTerm = !selectedTermId || a.term_id === selectedTermId
      return matchesStudent && matchesTerm
    })
  }, [assignmentReport?.assignments, selectedStudentId, selectedTermId])

  const summary = useMemo(() => {
    const total = filteredAssignments.length
    const completed = filteredAssignments.filter((a) => a.status === 'graded').length
    const inProgress = filteredAssignments.filter((a) => a.status === 'in_progress').length
    const notStarted = filteredAssignments.filter((a) => a.status === 'not_started').length
    const submitted = filteredAssignments.filter((a) => a.status === 'submitted').length
    const overdue = filteredAssignments.filter(
      (a) => isPastDateOnly(a.due_date) && a.status !== 'graded' && a.status !== 'excused',
    ).length
    const graded = filteredAssignments.filter((a) => a.percentage_grade != null)
    const avgGrade =
      graded.length
        ? graded.reduce((s, a) => s + (a.percentage_grade || 0), 0) / graded.length
        : null
    return { total, completed, inProgress, notStarted, submitted, overdue, avgGrade }
  }, [filteredAssignments])

  // Completion by subject
  const bySubject = useMemo(() => {
    if (!filteredAssignments.length) return []
    const map: Record<
      number,
      { name: string; color: string; total: number; done: number }
    > = {}
    for (const a of filteredAssignments) {
      if (!map[a.subject_id]) {
        map[a.subject_id] = { name: a.subject_name, color: a.subject_color, total: 0, done: 0 }
      }
      map[a.subject_id].total++
      if (a.status === 'graded') map[a.subject_id].done++
    }
    return Object.values(map).sort((a, b) => b.done / b.total - a.done / a.total)
  }, [filteredAssignments])

  // Recently graded (last 10, newest first)
  const recentlyGraded = useMemo(() => {
    return filteredAssignments
      .filter((a) => a.is_graded && a.graded_date)
      .sort((a, b) => {
        const da = new Date(a.graded_date!).getTime()
        const db = new Date(b.graded_date!).getTime()
        return db - da
      })
      .slice(0, 10)
  }, [filteredAssignments])

  const donutSegments = [
    { label: STATUS_LABELS.graded, count: summary.completed, color: DONUT_COLORS.graded },
    { label: STATUS_LABELS.in_progress, count: summary.inProgress, color: DONUT_COLORS.in_progress },
    { label: STATUS_LABELS.submitted, count: summary.submitted, color: DONUT_COLORS.submitted },
    { label: STATUS_LABELS.not_started, count: summary.notStarted, color: DONUT_COLORS.not_started },
    { label: STATUS_LABELS.overdue, count: summary.overdue, color: DONUT_COLORS.overdue },
  ].filter((s) => s.count > 0)

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
      <div className="py-16 text-center bg-panel border border-line rounded-card">
        <p className="text-[15px] font-semibold text-ink-2 mb-1">No assignment data yet</p>
        <p className="text-[13px] text-muted">
          Reports will appear once assignments are created and submitted.
        </p>
      </div>
    )
  }

  const studentOptions = [
    { value: '', label: 'All students' },
    ...(assignmentReport.available_students || []).map((s) => ({
      value: String(s.id),
      label: s.name,
    })),
  ]
  const termOptions = [
    { value: '', label: 'All terms' },
    ...(assignmentReport.available_terms || []).map((t) => ({
      value: String(t.id),
      label: `${t.name} (${t.academic_year})`,
    })),
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-panel border border-line rounded-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Student"
            value={String(selectedStudentId || '')}
            onChange={(e) => setSelectedStudentId(Number(e.target.value) || null)}
            options={studentOptions}
          />
          <Select
            label="Term"
            value={String(selectedTermId || '')}
            onChange={(e) => setSelectedTermId(Number(e.target.value) || null)}
            options={termOptions}
          />
        </div>
      </div>

      {/* Summary tiles + donut */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '340px 1fr' }}>
        {/* Donut + legend */}
        <div
          className="bg-panel border border-line rounded-card"
          style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h3
            style={{
              margin: '0 0 16px',
              alignSelf: 'flex-start',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            Status distribution
          </h3>
          <DonutChart segments={donutSegments} total={summary.total} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 18, width: '100%' }}>
            {donutSegments.map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: s.color,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{s.label}</span>
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'var(--ink)',
                    fontWeight: 600,
                  }}
                >
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Completion by subject */}
        <div className="bg-panel border border-line rounded-card" style={{ padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            Completion by subject
          </h3>
          {bySubject.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No data yet.</p>
          ) : (
            bySubject.map((b) => {
              const pct = b.total > 0 ? (b.done / b.total) * 100 : 0
              return (
                <div key={b.name} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '9999px',
                          background: b.color,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{b.name}</span>
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'var(--muted)',
                        fontSize: 11.5,
                      }}
                    >
                      {b.done}/{b.total} done
                    </span>
                  </div>
                  <div
                    style={{
                      height: 7,
                      borderRadius: '9999px',
                      background: 'var(--track)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: '9999px',
                        width: `${pct}%`,
                        background: b.color,
                      }}
                    />
                  </div>
                </div>
              )
            })
          )}
          {/* Avg grade summary tile */}
          {summary.avgGrade != null && (
            <div
              style={{
                marginTop: 20,
                padding: '10px 14px',
                background: 'var(--panel-2)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Average grade</span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  fontSize: 15,
                  color: 'var(--ink)',
                }}
              >
                {summary.avgGrade.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Recently graded */}
      {recentlyGraded.length > 0 && (
        <div className="bg-panel border border-line rounded-card overflow-hidden">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
              Recently graded
            </h3>
          </div>
          {recentlyGraded.map((a) => (
            <div
              key={a.assignment_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 18px',
                borderTop: '1px solid var(--line-2)',
                cursor: 'pointer',
              }}
              className="hover:bg-panel-2 transition-colors"
              onClick={() => {
                setSelectedAssignmentId(a.assignment_id)
                setSelectedAssignmentStudentId(a.student_id || null)
                setShowDetailModal(true)
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '9999px',
                  flexShrink: 0,
                  background: a.subject_color || 'var(--accent)',
                }}
              />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)' }}>
                {a.assignment_name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{a.student_name}</span>
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>
                {a.graded_date ? formatDateOnly(a.graded_date) : '—'}
              </span>
              <span
                style={{
                  width: 64,
                  textAlign: 'right',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  color: 'var(--ink)',
                }}
              >
                {a.points_earned != null ? `${a.points_earned}/${a.max_points}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Full filterable table */}
      {filteredAssignments.length > 0 ? (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-panel-2">
              <tr>
                {['Assignment', 'Subject', 'Due Date', 'Status', 'Points', 'Grade'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-panel divide-y divide-line">
              {filteredAssignments.map((a) => {
                const isOverdue = isPastDateOnly(a.due_date) && a.status !== 'graded'
                return (
                  <tr
                    key={a.assignment_id}
                    className="hover:bg-panel-2 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedAssignmentId(a.assignment_id)
                      setSelectedAssignmentStudentId(a.student_id || null)
                      setShowDetailModal(true)
                    }}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="text-[13.5px] font-semibold text-ink">{a.assignment_name}</p>
                      <p className="text-[11.5px] text-faint font-mono">
                        Assigned {new Date(a.assigned_date).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-none"
                          style={{ background: a.subject_color || 'var(--accent)' }}
                        />
                        <span className="text-[13.5px] text-ink-2">{a.subject_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`text-[13px] font-mono ${isOverdue ? 'text-neg-fg font-semibold' : 'text-ink-2'}`}
                      >
                        {a.due_date ? formatDateOnly(a.due_date) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <Pill variant={statusToPillVariant(a.status)}>
                        {a.status.replace('_', ' ')}
                      </Pill>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13.5px] font-mono text-ink-2">
                      {a.points_earned != null
                        ? `${a.points_earned} / ${a.max_points}`
                        : `— / ${a.max_points}`}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {a.percentage_grade != null ? (
                        <span
                          className={`text-[11.5px] font-bold px-2 py-0.5 rounded-pill ${gradeBg(a.percentage_grade)}`}
                        >
                          {a.percentage_grade.toFixed(1)}%{' '}
                          {a.letter_grade ? `· ${a.letter_grade}` : ''}
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
        <div className="py-12 text-center bg-panel border border-line rounded-card">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">No assignments found</p>
          <p className="text-[13px] text-muted">Try adjusting your student or term filter.</p>
        </div>
      )}

      {showDetailModal && selectedAssignmentId && (
        <AssignmentDetailModal
          assignmentId={selectedAssignmentId}
          studentId={selectedAssignmentStudentId || undefined}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedAssignmentId(null)
            setSelectedAssignmentStudentId(null)
          }}
        />
      )}
    </div>
  )
}

export default AssignmentReport

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
import { StudentProgress } from '../../../types'
import { Term } from '../../../types/term'
import { formatAttendanceRate } from '../../../utils/formatters'
import ReportHeader from '../shared/ReportHeader'
import { StatTile, Select } from '../../ui'

interface StudentsReportProps {
  studentProgress: StudentProgress[]
  terms: Term[]
  loading: boolean
  selectedTermId?: number
  onTermChange?: (termId: number) => void
}

const gradeColor = (p: number) =>
  p >= 90 ? 'text-pos-fg' : p >= 80 ? 'text-info-fg' : p >= 70 ? 'text-sub-fg' : 'text-neg-fg'
const gradeBg = (p: number) =>
  p >= 90 ? 'bg-pos-bg text-pos-fg' : p >= 80 ? 'bg-info-bg text-info-fg' : p >= 70 ? 'bg-sub-bg text-sub-fg' : 'bg-neg-bg text-neg-fg'

const StudentsReport: React.FC<StudentsReportProps> = ({ studentProgress, terms, loading, selectedTermId, onTermChange }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    studentProgress.length > 0 ? studentProgress[0].student_id : null
  )

  const selectedStudent = selectedStudentId
    ? studentProgress.find(s => s.student_id === selectedStudentId)
    : null

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

  if (studentProgress.length === 0) {
    return (
      <>
        <ReportHeader title="Student Progress" subtitle="Detailed per-student academic performance and subject breakdown." />
        <div className="py-16 text-center bg-panel border border-line rounded-card">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">No student data yet</p>
          <p className="text-[13px] text-muted">Progress reports will appear once students are enrolled and assignments are completed.</p>
        </div>
      </>
    )
  }

  const studentOptions = studentProgress.map(s => ({
    value: String(s.student_id),
    label: s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.student_name,
  }))
  const termOptions = [
    { value: '', label: 'Current term' },
    ...terms.map(t => ({ value: String(t.id), label: `${t.name} (${t.academic_year})` })),
  ]

  const grade = selectedStudent ? (selectedStudent.overall_grade || selectedStudent.average_grade || 0) : 0
  const overallLetter = selectedStudent?.overall_letter_grade ?? ''
  const subjects = selectedStudent ? (selectedStudent.subject_grades || selectedStudent.subjects || []) : []
  const displayName = selectedStudent
    ? (selectedStudent.first_name && selectedStudent.last_name
        ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
        : selectedStudent.student_name)
    : ''
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  return (
    <div className="space-y-5">
      <ReportHeader title="Student Progress" subtitle="Detailed per-student academic performance and subject breakdown." />

      {/* Selectors */}
      <div className="bg-panel border border-line rounded-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Student"
            value={String(selectedStudentId || '')}
            onChange={e => setSelectedStudentId(Number(e.target.value) || null)}
            options={studentOptions}
          />
          <Select
            label="Academic Term"
            value={String(selectedTermId || '')}
            onChange={e => onTermChange?.(Number(e.target.value))}
            options={termOptions}
          />
        </div>
      </div>

      {selectedStudent ? (
        <>
          {/* Student header */}
          <div className="bg-panel border border-line rounded-card p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-accent-soft border border-accent-line flex items-center justify-center flex-none">
                <span className="text-[13px] font-bold text-accent">{initials}</span>
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-ink tracking-[-0.01em]">{displayName}</h2>
                <p className="text-[13px] text-muted">
                  {selectedStudent.grade_level ? `Grade ${selectedStudent.grade_level}` : 'Grade not set'}
                  {selectedStudent.email ? ` · ${selectedStudent.email}` : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="Overall Grade" value={`${grade.toFixed(1)}%`} sub={overallLetter} accent={grade >= 80} />
              <StatTile label="Assignments" value={`${selectedStudent.completed_assignments} / ${selectedStudent.total_assignments}`} sub="completed" />
              <StatTile label="Completion" value={`${(selectedStudent.completion_rate || (selectedStudent.total_assignments ? selectedStudent.completed_assignments / selectedStudent.total_assignments * 100 : 0)).toFixed(1)}%`} />
              <StatTile label="Attendance" value={formatAttendanceRate(selectedStudent.attendance_rate)} />
            </div>

            {selectedStudent.last_activity_date && (
              <p className="mt-4 text-[12.5px] text-faint border-t border-line-2 pt-3">
                Last activity: {new Date(selectedStudent.last_activity_date).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Subject breakdown */}
          {subjects.length > 0 && (
            <div className="overflow-x-auto rounded-card border border-line">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-panel-2">
                  <tr>
                    {['Subject', 'Assignments', 'Points', 'Grade', 'Trend'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-panel divide-y divide-line">
                  {subjects.map((subject: any) => {
                    const completion = subject.total_assignments > 0
                      ? (subject.completed_assignments / subject.total_assignments * 100) : 0
                    const trendDir = subject.trend_data && subject.trend_data.length >= 2
                      ? subject.trend_data[subject.trend_data.length - 1].average_grade - subject.trend_data[0].average_grade
                      : 0
                    return (
                      <tr key={subject.subject_id} className="hover:bg-panel-2 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: subject.subject_color || 'var(--accent)' }} />
                            <div>
                              <p className="text-[13.5px] font-semibold text-ink">{subject.subject_name}</p>
                              <p className="text-[11.5px] text-faint">{completion.toFixed(0)}% complete</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-[13.5px] font-mono text-ink-2">
                          {subject.completed_assignments} / {subject.total_assignments}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-[13.5px] font-mono text-ink-2">
                          {subject.points_earned != null && subject.points_possible != null
                            ? `${Math.round(subject.points_earned)} / ${Math.round(subject.points_possible)}`
                            : `${subject.average_percentage.toFixed(1)}%`}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold text-[15px] ${gradeColor(subject.average_percentage)}`}>
                              {subject.average_percentage.toFixed(1)}%
                            </span>
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-pill ${gradeBg(subject.average_percentage)}`}>
                              {subject.letter_grade}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-end gap-0.5 h-7">
                            {subject.trend_data && subject.trend_data.length > 0 ? (
                              subject.trend_data.map((pt: any, i: number) => (
                                <div key={i} className="w-2 rounded-sm" style={{
                                  height: `${Math.max(8, (pt.average_grade / 100) * 28)}px`,
                                  background: trendDir > 5 ? 'var(--pos-fg)' : trendDir < -5 ? 'var(--neg-fg)' : 'var(--accent)',
                                  opacity: 0.7,
                                }} />
                              ))
                            ) : (
                              <div className="w-2 rounded-sm" style={{
                                height: `${Math.max(8, (subject.average_percentage / 100) * 28)}px`,
                                background: 'var(--accent)', opacity: 0.7,
                              }} />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="py-16 text-center bg-panel border border-line rounded-card">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">Select a student</p>
          <p className="text-[13px] text-muted">Choose a student above to view their detailed progress.</p>
        </div>
      )}
    </div>
  )
}

export default StudentsReport

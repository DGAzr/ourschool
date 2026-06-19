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

import React from 'react'
import { TermGrade } from '../../../types'
import ReportHeader from '../shared/ReportHeader'

interface TermReportProps {
  termGrades: TermGrade[]
  loading: boolean
}

const gradeLetter = (p: number) => p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F'
const gradeColor = (p: number) =>
  p >= 90 ? 'text-pos-fg' : p >= 80 ? 'text-info-fg' : p >= 70 ? 'text-sub-fg' : 'text-neg-fg'
const gradeBg = (p: number) =>
  p >= 90 ? 'bg-pos-bg text-pos-fg' : p >= 80 ? 'bg-info-bg text-info-fg' : p >= 70 ? 'bg-sub-bg text-sub-fg' : 'bg-neg-bg text-neg-fg'

const TermReport: React.FC<TermReportProps> = ({ termGrades, loading }) => {
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

  if (termGrades.length === 0) {
    return (
      <>
        <ReportHeader title="Term Grades" subtitle="Your academic performance organized by term and subject area." />
        <div className="py-16 text-center bg-panel border border-line rounded-card">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">No term grades yet</p>
          <p className="text-[13px] text-muted">Grades will appear here once assignments are completed and graded.</p>
        </div>
      </>
    )
  }

  const gradesByTerm = termGrades.reduce((acc, grade) => {
    const key = `${grade.academic_year} — ${grade.term}`
    if (!acc[key]) acc[key] = []
    acc[key].push(grade)
    return acc
  }, {} as Record<string, TermGrade[]>)

  return (
    <div className="space-y-6">
      <ReportHeader title="Term Grades" subtitle="Your academic performance organized by term and subject area." />

      {Object.entries(gradesByTerm).map(([termKey, grades]) => (
        <div key={termKey} className="bg-panel border border-line rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-line bg-panel-2">
            <p className="text-[13px] font-semibold text-ink">{termKey}</p>
          </div>
          <div className="divide-y divide-line-2">
            {grades.map((grade, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <span
                  className="flex-none w-1 self-stretch rounded-full"
                  style={{ background: grade.subject_color || 'var(--accent)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink mb-1" style={{ color: grade.subject_color || undefined }}>
                    {grade.subject_name}
                  </p>
                  <div className="flex items-center gap-4 text-[12px] text-muted font-mono">
                    <span>{grade.earned_points} / {grade.total_points} pts</span>
                    <span>{grade.total_assignments} assignments</span>
                    <span>{grade.completion_rate.toFixed(0)}% complete</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <span className={`font-mono font-bold text-[18px] ${gradeColor(grade.percentage)}`}>
                    {grade.percentage.toFixed(1)}%
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-pill ${gradeBg(grade.percentage)}`}>
                    {gradeLetter(grade.percentage)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default TermReport

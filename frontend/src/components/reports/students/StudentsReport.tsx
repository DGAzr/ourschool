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
import TrendChart from '../shared/TrendChart'
import { trendInfo, gradeColor, barColor, letter } from '../shared/gradeColors'

interface StudentsReportProps {
  studentProgress: StudentProgress[]
  terms: Term[]
  loading: boolean
  selectedTermId?: number
  onTermChange?: (termId: number) => void
}

const StudentsReport: React.FC<StudentsReportProps> = ({
  studentProgress,
  loading,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    studentProgress.length > 0 ? studentProgress[0].student_id : null,
  )

  const sel = selectedStudentId
    ? studentProgress.find((s) => s.student_id === selectedStudentId)
    : studentProgress[0] ?? null

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
      <div className="py-16 text-center bg-panel border border-line rounded-card">
        <p className="text-[15px] font-semibold text-ink-2 mb-1">No student data yet</p>
        <p className="text-[13px] text-muted">
          Progress reports will appear once students are enrolled and assignments are completed.
        </p>
      </div>
    )
  }

  const displayName = (s: StudentProgress) =>
    s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.student_name
  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')

  const grade = sel
    ? Math.round(sel.overall_grade ?? sel.average_grade ?? 0)
    : 0
  const subjects = sel ? (sel.subject_grades ?? sel.subjects ?? []) : []
  const ti = trendInfo(sel?.trend ?? 0)

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      {/* Roster picker */}
      <div style={{ flexShrink: 0, width: 212, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {studentProgress.map((p) => {
          const isSelected = p.student_id === (sel?.student_id ?? -1)
          const name = displayName(p)
          const ptGrade = Math.round(p.overall_grade ?? p.average_grade ?? 0)
          const pTi = trendInfo(p.trend ?? 0)
          return (
            <button
              key={p.student_id}
              onClick={() => setSelectedStudentId(p.student_id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line)'}`,
                background: isSelected ? 'var(--accent-soft)' : 'var(--panel)',
                borderRadius: 11,
                padding: '10px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'var(--ink)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '9999px',
                    flexShrink: 0,
                    background: 'var(--track)',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {initials(name)}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 13.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--ink)',
                  }}
                >
                  {name}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: 'var(--ink-2)',
                  }}
                >
                  {ptGrade}%
                </span>
                <span style={{ color: pTi.color, fontSize: 12 }}>{pTi.arrow}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Detail panel */}
      {sel ? (
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Student header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span
              style={{
                width: 48,
                height: 48,
                borderRadius: '9999px',
                background: 'var(--track)',
                color: 'var(--muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {initials(displayName(sel))}
            </span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 21,
                  fontWeight: 700,
                  letterSpacing: '-.01em',
                  color: 'var(--ink)',
                }}
              >
                {displayName(sel)}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {sel.grade_level ? `Grade ${sel.grade_level}` : 'Grade not set'}
                {sel.email ? ` · ${sel.email}` : ''}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 30,
                  fontWeight: 600,
                  color: gradeColor(grade),
                  lineHeight: 1,
                }}
              >
                {grade}%
              </div>
              <div style={{ fontSize: 12, color: ti.color, fontWeight: 600, marginTop: 3 }}>
                {ti.arrow} {ti.text === 'steady' ? 'steady' : `${ti.text} pts`}
              </div>
            </div>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { value: `${Math.round(sel.completion_rate ?? 0)}%`, label: 'Completion', color: 'var(--ink)' },
              {
                value: sel.attendance_rate != null ? `${Math.round(sel.attendance_rate)}%` : '—',
                label: 'Attendance',
                color: 'var(--ink)',
              },
              { value: letter(grade), label: 'Letter grade', color: gradeColor(grade) },
              {
                value: (sel.trend ?? 0) > 0 ? `+${sel.trend}` : String(sel.trend ?? 0),
                label: 'Trend (pts)',
                color: ti.color,
              },
            ].map((t, i) => (
              <div
                key={i}
                className="bg-panel border border-line rounded-card"
                style={{ padding: '13px 15px' }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 19,
                    fontWeight: 600,
                    color: t.color,
                  }}
                >
                  {t.value}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{t.label}</div>
              </div>
            ))}
          </div>

          {/* Trend chart + subject bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="bg-panel border border-line rounded-card" style={{ padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                Grade trend
              </h3>
              <TrendChart series={sel.grade_series ?? []} height={150} />
            </div>

            <div className="bg-panel border border-line rounded-card" style={{ padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                By subject
              </h3>
              {subjects.map((b) => (
                <div key={b.subject_id} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '9999px',
                          background: b.subject_color || 'var(--accent)',
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                        {b.subject_name}
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'var(--ink)',
                        fontWeight: 600,
                      }}
                    >
                      {Math.round(b.average_percentage)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: '9999px',
                      background: 'var(--track)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: '9999px',
                        width: `${b.average_percentage}%`,
                        background: barColor(b.average_percentage),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Effort signals */}
          <div
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              borderRadius: 12,
              padding: '13px 17px',
              marginBottom: 16,
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  color: 'var(--accent)',
                  fontWeight: 700,
                }}
              >
                Effort signals
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              📓 {sel.journal_summary || 'No journal entries yet'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              🗓{' '}
              {sel.attendance_rate != null
                ? `${Math.round(sel.attendance_rate)}% attendance this term`
                : 'No attendance data'}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 py-16 text-center bg-panel border border-line rounded-card">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">Select a student</p>
          <p className="text-[13px] text-muted">
            Choose a student from the list to view their progress.
          </p>
        </div>
      )}
    </div>
  )
}

export default StudentsReport

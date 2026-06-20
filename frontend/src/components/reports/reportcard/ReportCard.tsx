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
import { ReportCard as ReportCardType, ReportCardSubjectGrade } from '../../../types/reports'

interface ReportCardProps {
  reportCard: ReportCardType | null
  reportCardStudentId: string
  setReportCardStudentId: (id: string) => void
  reportCardTermId: string
  setReportCardTermId: (id: string) => void
  reportCardLoading: boolean
  availableStudentsForReportCard: Array<{ id: number; name: string }>
  availableTermsForReportCard: Array<{ id: number; name: string; academic_year: string }>
  generateReportCard: () => Promise<void>
  isAdmin: boolean
}

function autoComment(studentName: string, overall: number): string {
  const first = studentName.split(' ')[0]
  if (overall >= 90) {
    return `${first} has had an outstanding term — consistent effort, strong reflection in the journal, and excellent follow-through across every subject.`
  }
  if (overall >= 78) {
    return `${first} is making steady progress. Continued focus on completion and a few weaker subjects will lift the overall grade further.`
  }
  return `${first} has had a challenging term. We recommend extra support in areas of weakness and re-establishing a daily study routine to rebuild momentum.`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const LABEL: React.CSSProperties = {
  color: '#6b6b6b',
  fontFamily: "'Hanken Grotesk', sans-serif",
}

const ReportCard: React.FC<ReportCardProps> = ({
  reportCard,
  reportCardStudentId,
  setReportCardStudentId,
  reportCardTermId,
  setReportCardTermId,
  reportCardLoading,
  availableStudentsForReportCard,
  availableTermsForReportCard,
  generateReportCard,
  isAdmin,
}) => {
  const rc = reportCard

  return (
    <div>
      {/* Print-scoped styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body > * { display: none !important; }
          .rc-print-root { display: block !important; }
          .rc-sheet { box-shadow: none !important; }
        }
      `}</style>

      {/* Controls bar — hidden when printing */}
      <div
        className="no-print bg-panel border border-line rounded-card mb-5"
        style={{
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        {isAdmin && (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                color: 'var(--faint)',
                marginBottom: 6,
              }}
            >
              Student
            </label>
            <select
              value={reportCardStudentId}
              onChange={(e) => setReportCardStudentId(e.target.value)}
              style={{
                height: 38,
                padding: '0 30px 0 12px',
                border: '1px solid var(--field-border)',
                background: 'var(--field-bg)',
                borderRadius: 9,
                fontSize: 13.5,
                fontFamily: 'inherit',
                color: 'var(--ink)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">Select Student</option>
              {availableStudentsForReportCard.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: 'var(--faint)',
              marginBottom: 6,
            }}
          >
            Term
          </label>
          <select
            value={reportCardTermId}
            onChange={(e) => setReportCardTermId(e.target.value)}
            style={{
              height: 38,
              padding: '0 30px 0 12px',
              border: '1px solid var(--field-border)',
              background: 'var(--field-bg)',
              borderRadius: 9,
              fontSize: 13.5,
              fontFamily: 'inherit',
              color: 'var(--ink)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">Select Term</option>
            {availableTermsForReportCard.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.academic_year})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={generateReportCard}
          disabled={
            reportCardLoading ||
            !reportCardTermId ||
            (!reportCardStudentId && isAdmin)
          }
          style={{
            height: 38,
            padding: '0 18px',
            border: 'none',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-fg)',
            borderRadius: 9,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: reportCardLoading || !reportCardTermId || (!reportCardStudentId && isAdmin) ? 0.5 : 1,
          }}
        >
          {reportCardLoading ? 'Generating…' : 'Generate Report Card'}
        </button>

        {rc && (
          <button
            onClick={() => window.print()}
            style={{
              height: 38,
              padding: '0 18px',
              border: '1px solid var(--btn-border)',
              background: 'var(--panel)',
              color: 'var(--ink-2)',
              borderRadius: 9,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Print / PDF
          </button>
        )}
      </div>

      {/* Loading state */}
      {reportCardLoading && !rc && (
        <div className="bg-panel border border-line rounded-card p-12 text-center">
          <div className="animate-pulse">
            <p className="text-[15px] font-semibold text-ink-2 mb-1">Generating report card…</p>
            <p className="text-[13px] text-muted">Compiling grades and attendance data.</p>
          </div>
        </div>
      )}

      {/* The printed document */}
      {rc && (
        <div
          className="rc-print-root"
          style={{ display: 'flex', justifyContent: 'center', background: 'var(--desk)', borderRadius: 14, padding: 30 }}
        >
          <div
            className="rc-sheet"
            style={{
              width: 660,
              maxWidth: '100%',
              background: '#fff',
              color: '#1c1c1c',
              boxShadow: '0 4px 24px rgba(0,0,0,.16)',
              padding: '48px 52px',
              fontFamily: "'Newsreader', Georgia, serif",
            }}
          >
            {/* Letterhead */}
            <div
              style={{
                textAlign: 'center',
                borderBottom: '2px solid #1c1c1c',
                paddingBottom: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '.22em',
                  textTransform: 'uppercase',
                  color: '#6b6b6b',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                }}
              >
                OurSchool Academy
              </div>
              <div
                style={{ fontSize: 27, fontWeight: 700, marginTop: 6, letterSpacing: '.01em' }}
              >
                Report Card
              </div>
              <div style={{ fontSize: 13, color: '#6b6b6b', marginTop: 4 }}>
                {rc.academic_year} · {rc.term_name}
              </div>
            </div>

            {/* Student info grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 24px',
                fontSize: 13.5,
                marginBottom: 22,
              }}
            >
              {[
                { label: 'Student', value: rc.student_name },
                {
                  label: 'Grade level',
                  value: rc.student_grade_level ? `Grade ${rc.student_grade_level}` : 'N/A',
                },
                {
                  label: 'Term dates',
                  value: `${formatDate(String(rc.term_start_date))} – ${formatDate(String(rc.term_end_date))}`,
                },
                { label: 'Issued', value: formatDate(String(rc.generated_date)) },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px dotted #c9c9c9',
                    paddingBottom: 4,
                  }}
                >
                  <span style={LABEL}>{row.label}</span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Grade table */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1.5px solid #1c1c1c' }}>
                  {['Subject', 'Completed', 'Points', '%', 'Grade'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 0 ? 'left' : 'center',
                        padding: '7px 6px',
                        fontFamily: "'Hanken Grotesk', sans-serif",
                        fontSize: 10.5,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        color: '#6b6b6b',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rc.subject_grades?.map((s: ReportCardSubjectGrade, i: number) => (
                  <tr key={`${s.subject_id}-${i}`} style={{ borderBottom: '1px solid #e4e4e4' }}>
                    <td style={{ padding: '9px 6px', fontWeight: 600 }}>{s.subject_name}</td>
                    <td
                      style={{
                        padding: '9px 6px',
                        textAlign: 'center',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                      }}
                    >
                      {s.assignments_completed}/{s.assignments_total}
                    </td>
                    <td
                      style={{
                        padding: '9px 6px',
                        textAlign: 'center',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                      }}
                    >
                      {Math.round(s.points_earned)}/{Math.round(s.points_possible)}
                    </td>
                    <td
                      style={{
                        padding: '9px 6px',
                        textAlign: 'center',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                      }}
                    >
                      {s.percentage_grade.toFixed(1)}%
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 700 }}>
                      {s.letter_grade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary boxes */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
              {/* Overall grade */}
              <div
                style={{
                  flex: 1,
                  border: '1.5px solid #1c1c1c',
                  borderRadius: 6,
                  padding: '13px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      color: '#6b6b6b',
                      fontFamily: "'Hanken Grotesk', sans-serif",
                    }}
                  >
                    Overall grade
                  </div>
                  <div style={{ fontSize: 13, color: '#6b6b6b', marginTop: 2 }}>
                    {rc.summary.overall_percentage.toFixed(1)}% overall
                  </div>
                </div>
                <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1 }}>
                  {rc.summary.overall_letter_grade}
                </div>
              </div>

              {/* Attendance */}
              <div
                style={{
                  flex: 1,
                  border: '1px solid #c9c9c9',
                  borderRadius: 6,
                  padding: '13px 16px',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                    color: '#6b6b6b',
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    marginBottom: 7,
                  }}
                >
                  Attendance
                </div>
                {[
                  { label: 'Present', value: rc.summary.days_present ?? '—' },
                  { label: 'Late', value: rc.summary.days_late ?? '—' },
                  { label: 'Absent', value: rc.summary.days_absent ?? '—' },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                      marginBottom: 3,
                    }}
                  >
                    <span>{row.label}</span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontWeight: 600,
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Teacher comments */}
            <div style={{ marginBottom: 26 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  color: '#6b6b6b',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  marginBottom: 6,
                }}
              >
                Teacher comments
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                  color: '#333',
                }}
              >
                {rc.teacher_comments ||
                  autoComment(rc.student_name, rc.summary.overall_percentage)}
              </p>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', gap: 40, marginTop: 34 }}>
              <div
                style={{
                  flex: 1,
                  borderTop: '1px solid #1c1c1c',
                  paddingTop: 5,
                  fontSize: 11.5,
                  color: '#6b6b6b',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                }}
              >
                Teacher signature
              </div>
              <div
                style={{
                  flex: 1,
                  borderTop: '1px solid #1c1c1c',
                  paddingTop: 5,
                  fontSize: 11.5,
                  color: '#6b6b6b',
                  fontFamily: "'Hanken Grotesk', sans-serif",
                }}
              >
                Parent / guardian signature
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportCard

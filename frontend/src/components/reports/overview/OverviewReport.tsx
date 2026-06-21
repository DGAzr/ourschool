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

import { AdminReport, StudentReport, MetricTrend } from '../../../types'
import Sparkline from '../shared/Sparkline'
import TrendChart from '../shared/TrendChart'
import { trendInfo, gradeColor, barColor, statusStyle } from '../shared/gradeColors'

interface OverviewReportProps {
  data: StudentReport | AdminReport | null
  isAdmin: boolean
  loading?: boolean
  onSelectStudent?: (studentId: number) => void
}

const OverviewReport: React.FC<OverviewReportProps> = ({
  data,
  isAdmin,
  loading = false,
  onSelectStudent,
}) => {
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-panel border border-line rounded-card p-4 animate-pulse h-24" />
          ))}
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          <div className="bg-panel border border-line rounded-card h-52 animate-pulse" />
          <div className="bg-panel border border-line rounded-card h-52 animate-pulse" />
        </div>
      </div>
    )
  }

  // Admin view: rich KPI grid + charts + glance table
  if (isAdmin) {
    const admin = data as AdminReport
    const kpis: MetricTrend[] = admin.kpis ?? []

    return (
      <div className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {kpis.length > 0
            ? kpis.map((k, i) => (
                <div
                  key={i}
                  className="bg-panel border border-line rounded-card"
                  style={{ padding: '16px 17px' }}
                >
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                    {k.label}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 26,
                        fontWeight: 600,
                        letterSpacing: '-.02em',
                        color: 'var(--ink)',
                        lineHeight: 1,
                      }}
                    >
                      {k.value}
                    </span>
                    <Sparkline
                      series={k.series}
                      color={k.delta_positive ? 'var(--pos-fg)' : 'var(--neg-fg)'}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: k.delta_positive ? 'var(--pos-fg)' : 'var(--neg-fg)',
                    }}
                  >
                    {k.delta}
                  </div>
                </div>
              ))
            : /* Fallback flat tiles when kpis array is empty */
              [
                { label: 'Students', value: String(admin.total_students) },
                { label: 'Active', value: String(admin.active_assignments) },
                { label: 'Pending grades', value: String(admin.pending_grades) },
                { label: 'Avg grade', value: `${Math.round(admin.average_grade)}%` },
              ].map((m, i) => (
                <div key={i} className="bg-panel border border-line rounded-card" style={{ padding: '16px 17px' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, marginTop: 8, color: 'var(--ink)' }}>{m.value}</div>
                </div>
              ))}
        </div>

        {/* Trend chart + subject bars */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <div className="bg-panel border border-line rounded-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                Class grade trend
              </h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>last 8 weeks</span>
            </div>
            <TrendChart series={admin.class_average_series ?? []} height={168} />
          </div>

          <div className="bg-panel border border-line rounded-card" style={{ padding: '18px 20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
              Subjects
            </h3>
            {(admin.subject_averages ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No graded work yet.</p>
            ) : (
              (admin.subject_averages ?? []).map((b) => (
                <div key={b.subject_id} style={{ marginBottom: 11 }}>
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
                          background: b.subject_color,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{b.subject_name}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          color: 'var(--ink)',
                          fontWeight: 600,
                        }}
                      >
                        {Math.round(b.percentage)}%
                      </span>
                      {b.flagged && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--accent)',
                            background: 'var(--accent-soft)',
                            borderRadius: 5,
                            padding: '1px 6px',
                          }}
                        >
                          behind
                        </span>
                      )}
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
                        width: `${b.percentage}%`,
                        background: barColor(b.percentage),
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Students at a glance */}
        {(admin.students_glance ?? []).length > 0 && (
          <div
            className="bg-panel border border-line rounded-card overflow-hidden"
          >
            <div
              style={{
                padding: '15px 20px 12px',
                borderBottom: '1px solid var(--line-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                Students at a glance
              </h3>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Grades · effort · who needs you</span>
            </div>
            <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: 'var(--panel-2)' }}>
                  {['Student', 'Grade', 'Trend', 'Completion', 'Attendance', 'Effort', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i >= 3 && i <= 4 ? 'right' : i === 6 ? 'right' : 'left',
                        padding: i === 0 ? '9px 20px' : i === 6 ? '9px 20px' : '9px 12px',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        color: 'var(--faint)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(admin.students_glance ?? []).map((r) => {
                  const ti = trendInfo(r.trend)
                  const initials = r.name.split(' ').map((n) => n[0]).slice(0, 2).join('')
                  return (
                    <tr
                      key={r.student_id}
                      onClick={() => onSelectStudent?.(r.student_id)}
                      style={{
                        cursor: 'pointer',
                        borderTop: '1px solid var(--line-2)',
                      }}
                      className="hover:bg-panel-2 transition-colors"
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '9999px',
                              background: 'var(--track)',
                              color: 'var(--muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 600,
                            color: gradeColor(r.grade),
                          }}
                        >
                          {Math.round(r.grade)}%
                        </span>{' '}
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.letter}</span>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: ti.color,
                          }}
                        >
                          {ti.arrow} {ti.text}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '12px 12px',
                          textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12.5,
                          color: 'var(--ink-2)',
                        }}
                      >
                        {Math.round(r.completion)}%
                      </td>
                      <td
                        style={{
                          padding: '12px 12px',
                          textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12.5,
                          color: 'var(--ink-2)',
                        }}
                      >
                        {r.attendance_rate != null ? `${Math.round(r.attendance_rate)}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.effort}</span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                        <span style={statusStyle(r.status)}>{r.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Student view: their own KPIs + trend chart
  const student = data as StudentReport
  const ti = trendInfo(student.trend ?? 0)
  const grade = student.current_term_grade ?? student.average_grade ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Assignments', value: String(student.total_assignments) },
          { label: 'Completed', value: String(student.completed_assignments) },
          { label: 'Pending Grades', value: String(student.pending_grades) },
          { label: 'Term Grade', value: `${Math.round(grade)}%` },
        ].map((m, i) => (
          <div key={i} className="bg-panel border border-line rounded-card" style={{ padding: '16px 17px' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{m.label}</div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 26,
                fontWeight: 600,
                marginTop: 8,
                color: i === 3 ? gradeColor(grade) : 'var(--ink)',
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        <div className="bg-panel border border-line rounded-card" style={{ padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            Grade trend
          </h3>
          <TrendChart series={student.grade_series ?? []} height={150} />
        </div>

        <div className="bg-panel border border-line rounded-card" style={{ padding: '18px 20px' }}>
          <div
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              borderRadius: 12,
              padding: '13px 17px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                color: 'var(--accent)',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Effort signals
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
              📓 {student.journal_summary || 'No journal entries yet'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: ti.color, fontWeight: 600 }}>{ti.arrow}</span>
              <span>
                Grade {ti.text === 'steady' ? 'is steady' : `${ti.text} pts this term`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OverviewReport

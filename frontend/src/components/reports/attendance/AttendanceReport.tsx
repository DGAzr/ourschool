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
import { Download, TrendingUp } from 'lucide-react'
import { AcademicYear, StudentAttendanceReport, BulkAttendanceReport, AttendanceReportSummary } from '../../../types'
import { Button } from '../../ui'

interface AttendanceReportProps {
  academicYears: AcademicYear[]
  selectedAcademicYear: string
  setSelectedAcademicYear: (year: string) => void
  customStartDate: string
  setCustomStartDate: (date: string) => void
  customEndDate: string
  setCustomEndDate: (date: string) => void
  useCustomDates: boolean
  setUseCustomDates: (use: boolean) => void
  attendanceReport: StudentAttendanceReport | null
  bulkAttendanceReport: BulkAttendanceReport | null
  attendanceLoading: boolean
  generateAttendanceReport: () => Promise<void>
  isAdmin: boolean
  // Per-student day-level data for admin calendar picker
  selectedStudentCalendarReport: StudentAttendanceReport | null
  calendarStudentLoading: boolean
  fetchStudentCalendar: (studentId: number) => Promise<void>
}

// ── calendar helpers ──────────────────────────────────────────────────────

/** Returns every {year, month} in the range [startIso, endIso] inclusive. */
function monthsInRange(startIso: string, endIso: string): { year: number; month: number }[] {
  if (!startIso || !endIso) return []
  const [sy, sm] = startIso.split('-').map(Number)
  const [ey, em] = endIso.split('-').map(Number)
  const months: { year: number; month: number }[] = []
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function monthDays(year: number, month: number): { iso: string; day: number }[] {
  const days: { iso: string; day: number }[] = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ iso, day: d })
  }
  return days
}

function firstDowOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

// status → CSS vars colour; null / missing → muted track
function cellStyle(status: string | null | undefined, weekend: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    fontWeight: 500,
  }
  if (weekend) return { ...base, background: 'var(--track)', color: 'var(--faint)' }
  if (status === 'absent')  return { ...base, background: 'var(--neg-fg)',   color: '#fff' }
  if (status === 'late')    return { ...base, background: 'var(--neutral)',   color: '#fff' }
  if (status === 'present') return { ...base, background: 'var(--pos-fg)',   color: '#fff' }
  if (status === 'excused') return { ...base, background: 'var(--exc-bg)',   color: 'var(--exc-fg)' }
  return { ...base, background: 'var(--track)', color: 'var(--faint)' }
}

// ── FullYearCalendar ──────────────────────────────────────────────────────
interface FullYearCalendarProps {
  startIso: string
  endIso: string
  dailyAttendance: StudentAttendanceReport['daily_attendance']
  loading?: boolean
}

const FullYearCalendar: React.FC<FullYearCalendarProps> = ({ startIso, endIso, dailyAttendance, loading }) => {
  const statusByDate: Record<string, string> = {}
  for (const rec of dailyAttendance) {
    statusByDate[rec.date] = rec.status
  }

  const months = monthsInRange(startIso, endIso)

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted text-[13px]">
        <div className="w-3.5 h-3.5 border-2 border-line border-t-accent rounded-full animate-spin" />
        Loading calendar…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {months.map(({ year, month }) => {
        const days = monthDays(year, month)
        const firstDow = firstDowOfMonth(year, month)
        const label = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        return (
          <div key={`${year}-${month}`}>
            <p className="text-[12px] font-semibold text-ink mb-2">{label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--faint)', fontWeight: 600, paddingBottom: 2 }}>{d}</div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
              {days.map(({ iso, day }) => {
                const dow = new Date(iso + 'T00:00:00').getDay()
                const weekend = dow === 0 || dow === 6
                const status = statusByDate[iso] ?? null
                return (
                  <div key={iso} title={status ? `${iso}: ${status}` : iso} style={cellStyle(status, weekend)}>
                    {day}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── InstructionDaysRows ──────────────────────────────────────────────────
// Renders per-student compliance rows sorted most-at-risk first.
interface InstructionDaysRowsProps {
  students: AttendanceReportSummary[]
}

const InstructionDaysRows: React.FC<InstructionDaysRowsProps> = ({ students }) => {
  const sorted = [...students].sort((a, b) => {
    const doneA = a.present_days + a.late_days + a.excused_days
    const doneB = b.present_days + b.late_days + b.excused_days
    return doneA - doneB
  })

  return (
    <div className="space-y-3">
      {sorted.map(s => {
        const done = s.present_days + s.late_days + s.excused_days
        const required = s.required_days_of_instruction
        const pct = required > 0 ? Math.min(100, Math.round((done / required) * 100)) : 0
        const remaining = Math.max(0, required - done)
        const met = done >= required

        return (
          <div key={s.student_id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{s.student_name}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{done}</span>
                <span style={{ color: 'var(--faint)' }}>/{required}</span>
                {met
                  ? <span style={{ marginLeft: 8, color: 'var(--pos-fg)', fontWeight: 600 }}> ✓ met</span>
                  : <span style={{ marginLeft: 8, color: 'var(--neg-fg)' }}> ({remaining} to go)</span>
                }
              </span>
            </div>
            {/* Secondary: attendance rate */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                Rate: {s.attendance_percentage.toFixed(1)}%
                <span style={{ color: 'var(--faint)', marginLeft: 6 }}>
                  ({s.present_days}P · {s.absent_days}A · {s.late_days}L · {s.excused_days}E)
                </span>
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 9999, background: 'var(--track)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 9999,
                  width: `${pct}%`,
                  background: met ? 'var(--pos-fg)' : pct >= 80 ? 'var(--accent)' : 'var(--neg-fg)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
const AttendanceReport: React.FC<AttendanceReportProps> = ({
  academicYears,
  selectedAcademicYear,
  setSelectedAcademicYear,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  useCustomDates,
  setUseCustomDates,
  attendanceReport,
  bulkAttendanceReport,
  attendanceLoading,
  generateAttendanceReport,
  isAdmin,
  selectedStudentCalendarReport,
  calendarStudentLoading,
  fetchStudentCalendar,
}) => {
  // Admin: which student's calendar to show
  const [calendarStudentId, setCalendarStudentId] = useState<number | null>(null)

  // When bulk report changes, auto-select first student for calendar
  useEffect(() => {
    if (bulkAttendanceReport && bulkAttendanceReport.students.length > 0) {
      const firstId = bulkAttendanceReport.students[0].student_id
      setCalendarStudentId(firstId)
      fetchStudentCalendar(firstId)
    }
    // fetchStudentCalendar is memoized on bulkAttendanceReport in useReportsData
  }, [bulkAttendanceReport, fetchStudentCalendar])

  const handleCalendarStudentChange = (id: number) => {
    setCalendarStudentId(id)
    fetchStudentCalendar(id)
  }

  // Listen for the global export event wired from ReportsContainer's "Export" button
  useEffect(() => {
    const handler = () => handleDownload()
    document.addEventListener('reports:export', handler)
    return () => document.removeEventListener('reports:export', handler)
  })

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownload = () => {
    if (isAdmin && bulkAttendanceReport) {
      const rows = [
        ['Student Name', 'Instruction Days', 'Required Days', 'Present', 'Late', 'Excused', 'Absent', 'Attendance Rate'],
        ...bulkAttendanceReport.students.map(s => {
          const done = s.present_days + s.late_days + s.excused_days
          return [
            s.student_name,
            String(done),
            String(s.required_days_of_instruction),
            String(s.present_days),
            String(s.late_days),
            String(s.excused_days),
            String(s.absent_days),
            `${s.attendance_percentage.toFixed(1)}%`,
          ]
        }),
      ]
      downloadCSV(
        rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n'),
        'attendance_compliance.csv',
      )
    } else if (attendanceReport) {
      const rows = [
        ['Date', 'Status', 'Notes'],
        ...attendanceReport.daily_attendance.map(d => [d.date, d.status, d.notes || '']),
      ]
      downloadCSV(
        rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n'),
        'attendance.csv',
      )
    }
  }

  const hasResults = attendanceReport || bulkAttendanceReport

  // Determine date range for calendar
  const calendarStart = isAdmin
    ? bulkAttendanceReport ? String(bulkAttendanceReport.start_date) : ''
    : attendanceReport   ? String(attendanceReport.summary.start_date) : ''
  const calendarEnd = isAdmin
    ? bulkAttendanceReport ? String(bulkAttendanceReport.end_date) : ''
    : attendanceReport   ? String(attendanceReport.summary.end_date) : ''

  return (
    <div className="space-y-5">
      {/* Generation controls */}
      <div className="bg-panel border border-line rounded-card p-5">
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>
          Date Range
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="date-selection" checked={!useCustomDates} onChange={() => setUseCustomDates(false)} className="accent-accent" />
              <span className="text-[13.5px] font-medium text-ink">By Academic Year</span>
            </label>
            {!useCustomDates && (
              <div className="ml-6">
                <select
                  value={selectedAcademicYear}
                  onChange={e => setSelectedAcademicYear(e.target.value)}
                  className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map(y => (
                    <option key={y.academic_year} value={y.academic_year}>
                      {y.academic_year} ({y.start_date} to {y.end_date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="date-selection" checked={useCustomDates} onChange={() => setUseCustomDates(true)} className="accent-accent" />
              <span className="text-[13.5px] font-medium text-ink">Custom Date Range</span>
            </label>
            {useCustomDates && (
              <div className="ml-6 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-faint uppercase tracking-wide mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-faint uppercase tracking-wide mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center">
            <Button
              fullWidth
              loading={attendanceLoading}
              disabled={attendanceLoading}
              icon={<TrendingUp size={15} />}
              onClick={generateAttendanceReport}
            >
              Generate Attendance Report
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasResults && (
        <>
          {/* ── ADMIN / PARENT VIEW ─────────────────────────────────────────── */}
          {isAdmin && bulkAttendanceReport ? (
            <div className="space-y-4">
              {/* Per-student instruction-day compliance */}
              <div className="bg-panel border border-line rounded-card p-5">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                      Instruction days by student
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                      {calendarStart} → {calendarEnd} · {bulkAttendanceReport.total_school_days} school days in range · sorted by most at risk
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>
                    Download CSV
                  </Button>
                </div>
                <InstructionDaysRows students={bulkAttendanceReport.students} />
              </div>

              {/* Per-student day calendar with student picker */}
              <div className="bg-panel border border-line rounded-card p-5">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Daily calendar</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Student</label>
                    <select
                      value={calendarStudentId ?? ''}
                      onChange={e => handleCalendarStudentChange(Number(e.target.value))}
                      className="bg-field-bg border border-field-border rounded-field px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      {bulkAttendanceReport.students.map(s => (
                        <option key={s.student_id} value={s.student_id}>{s.student_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--muted)', marginBottom: 14, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Present', bg: 'var(--pos-fg)' },
                    { label: 'Excused', bg: 'var(--exc-bg)', fg: 'var(--exc-fg)' },
                    { label: 'Late',    bg: 'var(--neutral)' },
                    { label: 'Absent',  bg: 'var(--neg-fg)' },
                  ].map(l => (
                    <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: l.bg, display: 'inline-block' }} />
                      {l.label}
                    </span>
                  ))}
                  <span style={{ color: 'var(--faint)' }}>· muted = no record</span>
                </div>
                <FullYearCalendar
                  startIso={calendarStart}
                  endIso={calendarEnd}
                  dailyAttendance={selectedStudentCalendarReport?.daily_attendance ?? []}
                  loading={calendarStudentLoading}
                />
              </div>
            </div>
          ) : attendanceReport ? (
            /* ── STUDENT VIEW ─────────────────────────────────────────────── */
            <div className="space-y-4">
              {/* Per-student KPI: instruction days vs required */}
              <div className="bg-panel border border-line rounded-card p-5">
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                  {attendanceReport.student_name}
                </h3>
                <InstructionDaysRows students={[attendanceReport.summary]} />
              </div>

              {/* Breakdown tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[
                  { value: String(attendanceReport.summary.present_days),  label: 'Days present',  color: 'var(--pos-fg)' },
                  { value: String(attendanceReport.summary.absent_days),   label: 'Days absent',   color: 'var(--neg-fg)' },
                  { value: String(attendanceReport.summary.late_days),     label: 'Days late',     color: 'var(--neutral)' },
                  { value: String(attendanceReport.summary.excused_days),  label: 'Days excused',  color: 'var(--ink)' },
                ].map((t, i) => (
                  <div key={i} className="bg-panel border border-line rounded-card" style={{ padding: '16px 17px' }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: t.color, lineHeight: 1 }}>{t.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 7 }}>{t.label}</div>
                  </div>
                ))}
              </div>

              {/* Full-year calendar + daily log */}
              <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
                <div className="bg-panel border border-line rounded-card p-5">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                      {attendanceReport.academic_year ?? 'Attendance calendar'}
                    </h3>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Present', bg: 'var(--pos-fg)' },
                        { label: 'Excused', bg: 'var(--exc-bg)' },
                        { label: 'Late',    bg: 'var(--neutral)' },
                        { label: 'Absent',  bg: 'var(--neg-fg)' },
                      ].map(l => (
                        <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: l.bg, display: 'inline-block' }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <FullYearCalendar
                    startIso={calendarStart}
                    endIso={calendarEnd}
                    dailyAttendance={attendanceReport.daily_attendance}
                  />
                </div>

                {/* Daily log */}
                <div className="bg-panel border border-line rounded-card overflow-hidden">
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Daily log</h3>
                    <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>CSV</Button>
                  </div>
                  <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                    {attendanceReport.daily_attendance.map(day => {
                      const statusColor =
                        day.status === 'present' ? 'var(--pos-fg)' :
                        day.status === 'absent'  ? 'var(--neg-fg)' :
                        day.status === 'excused' ? 'var(--exc-fg)' :
                        'var(--neutral)'
                      return (
                        <div key={day.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: '1px solid var(--line-2)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '9999px', background: statusColor, flexShrink: 0 }} />
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>
                            {new Date(day.date + 'T00:00:00').toLocaleDateString()}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
                            {day.status}
                          </span>
                          {day.notes && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{day.notes}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default AttendanceReport

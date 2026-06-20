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

import React, { useEffect } from 'react'
import { Download, TrendingUp } from 'lucide-react'
import { AcademicYear, StudentAttendanceReport, BulkAttendanceReport } from '../../../types'
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
}

function buildCalendarCells(
  dailyRecords: StudentAttendanceReport['daily_attendance'],
): Array<{ day: string; status: string | null; weekend: boolean }> {
  if (!dailyRecords || dailyRecords.length === 0) return []

  // Determine the month to show from the range of records
  const dates = dailyRecords.map((d) => new Date(d.date + 'T00:00:00'))
  const refDate = dates[0]
  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()

  const statusByDay: Record<number, string> = {}
  for (const rec of dailyRecords) {
    const d = new Date(rec.date + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      statusByDay[d.getDate()] = rec.status
    }
  }

  const cells: Array<{ day: string; status: string | null; weekend: boolean }> = []
  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: '', status: null, weekend: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (firstDow + d - 1) % 7
    const weekend = dow === 0 || dow === 6
    cells.push({ day: String(d), status: statusByDay[d] ?? null, weekend })
  }
  return cells
}

function cellStyle(
  cell: { day: string; status: string | null; weekend: boolean },
): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
  }
  if (!cell.day) return { ...base, background: 'transparent' }
  if (cell.weekend) return { ...base, background: 'var(--track)', color: 'var(--faint)' }
  if (cell.status === 'absent') return { ...base, background: 'var(--neg-fg)', color: '#fff' }
  if (cell.status === 'late') return { ...base, background: 'var(--neutral)', color: '#fff' }
  if (cell.status === 'present') return { ...base, background: 'var(--pos-fg)', color: '#fff' }
  return { ...base, background: 'var(--track)', color: 'var(--faint)' }
}

function monthLabel(dailyRecords: StudentAttendanceReport['daily_attendance']): string {
  if (!dailyRecords || dailyRecords.length === 0) return 'Month view'
  const d = new Date(dailyRecords[0].date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

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
}) => {
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
        ['Student Name', 'Total Days', 'Present', 'Absent', 'Attendance Rate'],
        ...bulkAttendanceReport.students.map((s) => [
          s.student_name,
          String(s.total_school_days),
          String(s.present_days),
          String(s.absent_days),
          `${s.attendance_rate.toFixed(1)}%`,
        ]),
      ]
      downloadCSV(
        rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n'),
        'bulk_attendance.csv',
      )
    } else if (attendanceReport) {
      const rows = [
        ['Date', 'Status', 'Notes'],
        ...attendanceReport.daily_attendance.map((d) => [d.date, d.status, d.notes || '']),
      ]
      downloadCSV(
        rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n'),
        'attendance.csv',
      )
    }
  }

  const hasResults = attendanceReport || bulkAttendanceReport

  return (
    <div className="space-y-5">
      {/* Generation controls */}
      <div className="bg-panel border border-line rounded-card p-5">
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--faint)',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            marginBottom: 16,
          }}
        >
          Date Range
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="date-selection"
                checked={!useCustomDates}
                onChange={() => setUseCustomDates(false)}
                className="accent-accent"
              />
              <span className="text-[13.5px] font-medium text-ink">By Academic Year</span>
            </label>
            {!useCustomDates && (
              <div className="ml-6">
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((y) => (
                    <option key={y.academic_year} value={y.academic_year}>
                      {y.academic_year} ({y.start_date} to {y.end_date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="date-selection"
                checked={useCustomDates}
                onChange={() => setUseCustomDates(true)}
                className="accent-accent"
              />
              <span className="text-[13.5px] font-medium text-ink">Custom Date Range</span>
            </label>
            {useCustomDates && (
              <div className="ml-6 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-faint uppercase tracking-wide mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-faint uppercase tracking-wide mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
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
          {/* Admin bulk view */}
          {isAdmin && bulkAttendanceReport ? (
            <div>
              {/* KPI tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
                {[
                  { value: String(bulkAttendanceReport.students.length), label: 'Students', color: 'var(--ink)' },
                  { value: String(bulkAttendanceReport.total_school_days), label: 'School days', color: 'var(--ink)' },
                  {
                    value: `${bulkAttendanceReport.overall_stats.average_attendance_rate.toFixed(1)}%`,
                    label: 'Avg attendance',
                    color: 'var(--pos-fg)',
                  },
                  {
                    value: String(bulkAttendanceReport.overall_stats.total_absent),
                    label: 'Total absences',
                    color: 'var(--neg-fg)',
                  },
                ].map((t, i) => (
                  <div
                    key={i}
                    className="bg-panel border border-line rounded-card"
                    style={{ padding: '16px 17px' }}
                  >
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 26,
                        fontWeight: 600,
                        color: t.color,
                        lineHeight: 1,
                      }}
                    >
                      {t.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 7 }}>{t.label}</div>
                  </div>
                ))}
              </div>

              {/* By-student rate bars + download */}
              <div
                className="bg-panel border border-line rounded-card"
                style={{ padding: '18px 20px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                    By student
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download size={13} />}
                    onClick={handleDownload}
                  >
                    Download CSV
                  </Button>
                </div>
                {bulkAttendanceReport.students.map((s) => (
                  <div key={s.student_id} style={{ marginBottom: 13 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        fontSize: 12.5,
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--ink-2)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.student_name}
                      </span>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                          color: 'var(--ink)',
                        }}
                      >
                        {s.attendance_rate.toFixed(1)}%
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
                          width: `${s.attendance_rate}%`,
                          background: 'var(--pos-fg)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : attendanceReport ? (
            /* Student view: KPI tiles + calendar heatmap */
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
                {[
                  {
                    value: String(attendanceReport.summary.present_days),
                    label: 'Days present',
                    color: 'var(--pos-fg)',
                  },
                  {
                    value: String(attendanceReport.summary.absent_days),
                    label: 'Days absent',
                    color: 'var(--neg-fg)',
                  },
                  {
                    value: String(attendanceReport.summary.late_days),
                    label: 'Days late',
                    color: 'var(--neutral)',
                  },
                  {
                    value: `${attendanceReport.summary.attendance_percentage.toFixed(1)}%`,
                    label: 'Attendance rate',
                    color: 'var(--ink)',
                  },
                ].map((t, i) => (
                  <div
                    key={i}
                    className="bg-panel border border-line rounded-card"
                    style={{ padding: '16px 17px' }}
                  >
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 26,
                        fontWeight: 600,
                        color: t.color,
                        lineHeight: 1,
                      }}
                    >
                      {t.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 7 }}>{t.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
                {/* Calendar heatmap */}
                <div
                  className="bg-panel border border-line rounded-card"
                  style={{ padding: '18px 20px' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                      {monthLabel(attendanceReport.daily_attendance)}
                    </h3>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
                      {[
                        { label: 'Present', color: 'var(--pos-fg)' },
                        { label: 'Late', color: 'var(--neutral)' },
                        { label: 'Absent', color: 'var(--neg-fg)' },
                      ].map((l) => (
                        <span
                          key={l.label}
                          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 3,
                              background: l.color,
                              display: 'inline-block',
                            }}
                          />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7,1fr)',
                      gap: 6,
                    }}
                  >
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div
                        key={i}
                        style={{
                          textAlign: 'center',
                          fontSize: 10,
                          color: 'var(--faint)',
                          fontWeight: 600,
                        }}
                      >
                        {d}
                      </div>
                    ))}
                    {buildCalendarCells(attendanceReport.daily_attendance).map((cell, i) => (
                      <div key={i} style={cellStyle(cell)}>
                        {cell.day}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily log */}
                <div
                  className="bg-panel border border-line rounded-card overflow-hidden"
                >
                  <div
                    style={{
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--line-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                      Daily log
                    </h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Download size={13} />}
                      onClick={handleDownload}
                    >
                      CSV
                    </Button>
                  </div>
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    {attendanceReport.daily_attendance.map((day) => {
                      const statusColor =
                        day.status === 'present'
                          ? 'var(--pos-fg)'
                          : day.status === 'absent'
                          ? 'var(--neg-fg)'
                          : 'var(--neutral)'
                      return (
                        <div
                          key={day.date}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 18px',
                            borderTop: '1px solid var(--line-2)',
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '9999px',
                              background: statusColor,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12,
                              color: 'var(--ink-2)',
                              flex: 1,
                            }}
                          >
                            {new Date(day.date + 'T00:00:00').toLocaleDateString()}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: statusColor,
                              textTransform: 'capitalize',
                            }}
                          >
                            {day.status}
                          </span>
                          {day.notes && (
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{day.notes}</span>
                          )}
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

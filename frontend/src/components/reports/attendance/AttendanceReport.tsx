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
import { Download, TrendingUp } from 'lucide-react'
import { AcademicYear, StudentAttendanceReport, BulkAttendanceReport } from '../../../types'
import ReportHeader from '../shared/ReportHeader'
import { Button, StatTile, Pill } from '../../ui'

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

const rateVariant = (rate: number): 'pos' | 'sub' | 'neg' =>
  rate >= 95 ? 'pos' : rate >= 90 ? 'sub' : 'neg'

const statusVariant = (status: string): 'pos' | 'neg' | 'sub' =>
  status === 'present' ? 'pos' : status === 'absent' ? 'neg' : 'sub'

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
        ...bulkAttendanceReport.students.map(s => [
          s.student_name, String(s.total_school_days), String(s.present_days),
          String(s.absent_days), `${s.attendance_rate.toFixed(1)}%`,
        ]),
      ]
      downloadCSV(rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n'), 'bulk_attendance.csv')
    } else if (attendanceReport) {
      const rows = [
        ['Date', 'Status', 'Notes'],
        ...attendanceReport.daily_attendance.map(d => [d.date, d.status, d.notes || '']),
      ]
      downloadCSV(rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n'), 'attendance.csv')
    }
  }

  return (
    <div className="space-y-6">
      <ReportHeader title="Attendance Report" subtitle="Generate compliance-ready attendance reports by academic year or custom date range." />

      {/* Controls */}
      <div className="bg-panel border border-line rounded-card p-5">
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-4">Date Range</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {/* Academic year option */}
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

            {/* Custom dates option */}
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
      {(attendanceReport || bulkAttendanceReport) && (
        <div className="bg-panel border border-line rounded-card overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <p className="text-[13.5px] font-semibold text-ink">
              {isAdmin ? 'Bulk Attendance Report' : 'Student Attendance Report'}
            </p>
            <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleDownload}>
              Download CSV
            </Button>
          </div>

          {isAdmin && bulkAttendanceReport ? (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Students" value={String(bulkAttendanceReport.students.length)} />
                <StatTile label="Total Days" value={String(bulkAttendanceReport.total_school_days)} />
                <StatTile
                  label="Avg Attendance"
                  value={`${bulkAttendanceReport.students.length > 0
                    ? (bulkAttendanceReport.students.reduce((s, st) => s + st.attendance_rate, 0) / bulkAttendanceReport.students.length).toFixed(1)
                    : '0.0'}%`}
                  accent={true}
                />
                <StatTile
                  label="Total Absences"
                  value={String(bulkAttendanceReport.students.reduce((s, st) => s + st.absent_days, 0))}
                />
              </div>

              <div className="overflow-x-auto rounded-card border border-line">
                <table className="min-w-full divide-y divide-line">
                  <thead className="bg-panel-2">
                    <tr>
                      {['Student', 'Total Days', 'Present', 'Absent', 'Attendance Rate'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-panel divide-y divide-line">
                    {bulkAttendanceReport.students.map(s => (
                      <tr key={s.student_id} className="hover:bg-panel-2 transition-colors">
                        <td className="px-5 py-3.5 text-[13.5px] font-semibold text-ink whitespace-nowrap">{s.student_name}</td>
                        <td className="px-5 py-3.5 text-[13.5px] text-ink-2 font-mono whitespace-nowrap">{s.total_school_days}</td>
                        <td className="px-5 py-3.5 text-[13.5px] text-pos-fg font-mono whitespace-nowrap">{s.present_days}</td>
                        <td className="px-5 py-3.5 text-[13.5px] text-neg-fg font-mono whitespace-nowrap">{s.absent_days}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Pill variant={rateVariant(s.attendance_rate)}>{s.attendance_rate.toFixed(1)}%</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : attendanceReport && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Total Days" value={String(attendanceReport.summary.total_possible_days)} />
                <StatTile label="Present Days" value={String(attendanceReport.summary.present_days)} accent={true} />
                <StatTile label="Attendance Rate" value={`${attendanceReport.summary.attendance_percentage.toFixed(1)}%`} />
              </div>

              <div className="overflow-x-auto rounded-card border border-line">
                <table className="min-w-full divide-y divide-line">
                  <thead className="bg-panel-2">
                    <tr>
                      {['Date', 'Status', 'Notes'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-panel divide-y divide-line">
                    {attendanceReport.daily_attendance.map(day => (
                      <tr key={day.date} className="hover:bg-panel-2 transition-colors">
                        <td className="px-5 py-3.5 text-[13.5px] text-ink font-mono whitespace-nowrap">
                          {new Date(day.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <Pill variant={statusVariant(day.status)}>{day.status.charAt(0).toUpperCase() + day.status.slice(1)}</Pill>
                        </td>
                        <td className="px-5 py-3.5 text-[13.5px] text-ink-2">{day.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AttendanceReport

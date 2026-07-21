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

/**
 * A student's read-only view of their own attendance: summary tiles, a
 * present-day streak, and a month-by-month calendar for the selected academic
 * year. The attendance list endpoint self-scopes student sessions, so no
 * student_id is sent.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { attendanceApi } from '../../services/attendance'
import { reportsApi } from '../../services/reports'
import { termsApi } from '../../services/terms'
import { StatTile } from '../ui'
import { AttendanceRecord } from '../../types'
import { AcademicYear } from '../../types/reports'
import {
  AttendanceDisplayStatus,
  cellStyle,
  firstDowOfMonth,
  formatDateShort,
  monthDays,
  monthsInRange,
} from '../../utils/attendance'
import { todayISO } from '../../utils/dates'

const StudentAttendanceView: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedYearObj = academicYears.find(y => y.academic_year === selectedYear) ?? null

  // Bootstrap: academic years + active term for the default year.
  useEffect(() => {
    Promise.allSettled([reportsApi.getAcademicYears(), termsApi.getActive()])
      .then(([years, activeTerm]) => {
        if (years.status === 'fulfilled') {
          const yearsList: AcademicYear[] = years.value
          setAcademicYears(yearsList)
          const activeYear =
            activeTerm.status === 'fulfilled' && activeTerm.value
              ? activeTerm.value.academic_year
              : null
          const defaultYear =
            activeYear && yearsList.some(y => y.academic_year === activeYear)
              ? activeYear
              : (yearsList[0]?.academic_year ?? '')
          setSelectedYear(prev => prev || defaultYear)
          if (defaultYear) setRecordsLoading(true)
        } else {
          setError('Failed to load attendance data')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Year-scoped records; the backend scopes the list to the logged-in student.
  useEffect(() => {
    if (!selectedYear) return
    const yearObj = academicYears.find(y => y.academic_year === selectedYear)
    if (!yearObj) return
    attendanceApi
      .getAll({ start_date: yearObj.start_date, end_date: yearObj.end_date })
      .then((recs: AttendanceRecord[]) => {
        setRecords(recs)
        setError(null)
      })
      .catch(() => setError('Failed to load attendance records'))
      .finally(() => setRecordsLoading(false))
  }, [selectedYear, academicYears])

  // 'late' counts as present everywhere in this view.
  const statusFor = useMemo(() => {
    const m = new Map<string, AttendanceDisplayStatus>()
    for (const r of records) {
      m.set(r.date, (r.status === 'late' ? 'present' : r.status) as AttendanceDisplayStatus)
    }
    return m
  }, [records])

  const summary = useMemo(() => {
    let present = 0, absent = 0, excused = 0
    for (const status of statusFor.values()) {
      if (status === 'present') present++
      else if (status === 'absent') absent++
      else if (status === 'excused') excused++
    }
    return { present, absent, excused }
  }, [statusFor])

  // Streak: consecutive most-recent recorded school days marked present.
  // Calendar gaps (weekends, breaks) don't break it; an absence does.
  const streak = useMemo(() => {
    const dates = Array.from(statusFor.keys())
      .filter(d => d <= todayISO())
      .sort()
      .reverse()
    let count = 0
    for (const date of dates) {
      if (statusFor.get(date) === 'present') count++
      else break
    }
    return count
  }, [statusFor])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-[13px] py-12">
        <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">My record</p>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.02em]">My Attendance</h1>
      </div>

      {/* Academic year selector */}
      {academicYears.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <label htmlFor="student-attendance-year" className="text-[12px] font-semibold text-faint uppercase tracking-[.06em] whitespace-nowrap">
            Academic year
          </label>
          <select
            id="student-attendance-year"
            value={selectedYear}
            onChange={e => {
              setRecordsLoading(true)
              setSelectedYear(e.target.value)
            }}
            className="text-[13px] font-medium text-ink bg-panel border border-line rounded-field px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {academicYears.map(y => (
              <option key={y.academic_year} value={y.academic_year}>
                {y.academic_year} ({y.start_date} → {y.end_date})
              </option>
            ))}
          </select>
          {recordsLoading && (
            <div className="w-3.5 h-3.5 border-2 border-line border-t-accent rounded-full animate-spin" />
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">{error}</div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Days present" value={String(summary.present)} accent={summary.present > 0} />
        <StatTile label="Days absent" value={String(summary.absent)} />
        <StatTile label="Days excused" value={String(summary.excused)} />
        <StatTile label="Current streak" value={streak > 0 ? `${streak} 🔥` : '0'} accent={streak >= 5} />
      </div>

      {/* Month-by-month calendar */}
      {selectedYearObj ? (
        <div className="space-y-4">
          {monthsInRange(selectedYearObj.start_date, selectedYearObj.end_date).map(({ year, month }) => {
            const days = monthDays(year, month)
            const firstDow = firstDowOfMonth(year, month)
            const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            return (
              <div key={`${year}-${month}`} className="bg-panel border border-line rounded-card p-5 overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[15px] font-semibold text-ink">{monthLabel}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--pos-bg)' }} />Present</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--exc-bg)' }} />Excused</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--neg-bg)' }} />Absent</span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1 min-w-[280px]">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className="text-center text-[10.5px] font-semibold text-faint py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 min-w-[280px]">
                  {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
                  {days.map(({ iso, day }) => {
                    const status = statusFor.get(iso)
                    return (
                      <div
                        key={iso}
                        title={`${formatDateShort(iso)}${status ? ` — ${status}` : ''}`}
                        className="relative aspect-square flex items-center justify-center rounded-[6px] text-[11.5px] font-mono font-medium"
                        style={{
                          ...cellStyle(status, iso),
                          outline: iso === todayISO() ? '2px solid var(--accent)' : undefined,
                          outlineOffset: '-1px',
                        }}
                      >
                        {day}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-card p-8 text-center text-muted text-[13px]">
          No attendance records yet. Your teacher records attendance here.
        </div>
      )}
    </div>
  )
}

export default StudentAttendanceView

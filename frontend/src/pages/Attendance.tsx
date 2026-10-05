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

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/useToast'
import SegmentedControl from '../components/ui/SegmentedControl'
import { attendanceApi } from '../services/attendance'
import { reportsApi } from '../services/reports'
import { termsApi } from '../services/terms'
import { settingsApi } from '../services/settings'
import StudentAttendanceView from '../components/attendance/StudentAttendanceView'
import { AttendanceRecord, User } from '../types'
import { AcademicYear } from '../types/reports'
import {
  AttendanceDisplayStatus as Status,
  attendanceStatuses,
  cellStyle,
  firstDowOfMonth,
  formatDateShort,
  isFuture,
  monthDays,
  monthsInRange,
} from '../utils/attendance'
import { useCalendarDateParam } from '../hooks/useCalendarDateParam'
import { addDays, todayISO } from '../utils/dates'

// ── helpers ──────────────────────────────────────────────────────────────
function formatDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// ── component ─────────────────────────────────────────────────────────────
const Attendance: React.FC = () => {
  const { user } = useAuth()
  if (user && user.role !== 'admin') return <StudentAttendanceView />
  return <AdminAttendance />
}

const AdminAttendance: React.FC = () => {
  const { toast } = useToast()

  const [tab, setTab] = useState<'take' | 'history'>('take')
  const [activeDate, setActiveDate] = useCalendarDateParam()
  const [showLateOption, setShowLateOption] = useState(false)
  const [historyStudent, setHistoryStudent] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [dailyRecords, setDailyRecords] = useState<{ date: string; data: AttendanceRecord[]; error?: string }>({ date: '', data: [] })
  const savingStudents = useRef(new Set<number>())
  const [students, setStudents] = useState<User[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [requiredDays, setRequiredDays] = useState(180)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<Record<number, boolean>>({})

  // ── derived: selected AcademicYear object ─────────────────────────────
  const selectedYearObj = academicYears.find(y => y.academic_year === selectedYear) ?? null

  const dayReady = dailyRecords.date === activeDate && !dailyRecords.error
  const combinedRecords = React.useMemo(() => {
    if (dailyRecords.date !== activeDate) return records
    return [...records.filter(r => r.date !== activeDate), ...dailyRecords.data]
  }, [records, dailyRecords, activeDate])
  const historyStart = historyFrom || selectedYearObj?.start_date || ''
  const historyEnd = historyTo || selectedYearObj?.end_date || todayISO()
  const historyRangeValid = !!historyStart && historyStart <= historyEnd
  const historyStudents = students.filter(s => !historyStudent || String(s.id) === historyStudent)
  const historyRecords = combinedRecords.filter(r =>
    (!historyStudent || String(r.student_id) === historyStudent) &&
    r.date >= historyStart && r.date <= historyEnd &&
    (!selectedYearObj || (r.date >= selectedYearObj.start_date && r.date <= selectedYearObj.end_date))
  ).sort((a, b) => b.date.localeCompare(a.date) || a.student_id - b.student_id)
  const calendarStart = selectedYearObj && selectedYearObj.start_date > historyStart ? selectedYearObj.start_date : historyStart
  const calendarEnd = selectedYearObj && selectedYearObj.end_date < historyEnd ? selectedYearObj.end_date : historyEnd

  // ── derived attendance map ────────────────────────────────────────────
  // { "studentId-iso": status } — 'late' is kept as-is so per-student compliance can count it
  const attendanceMap = React.useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of combinedRecords) {
      m[`${r.student_id}-${r.date}`] = r.status
    }
    return m
  }, [combinedRecords])

  // Deadline/calendar scope does not change recorded attendance status.
  const statusForStudent = useCallback((studentId: number, iso: string): Status | undefined => {
    const raw = attendanceMap[`${studentId}-${iso}`]
    if (!raw) return undefined
    return raw as Status
  }, [attendanceMap])

  // ── per-student compliance ────────────────────────────────────────────
  // Counts days a student received instruction (present | late | excused),
  // within the selected year's date range and not in the future.
  // This is the legally relevant metric: each student needs `requiredDays` of instruction.
  const perStudentDays = React.useMemo(() => {
    const today = todayISO()
    const yearStart = selectedYearObj?.start_date ?? ''
    const yearEnd   = selectedYearObj?.end_date   ?? ''
    const map: Record<number, number> = {}
    for (const s of students) {
      const count = combinedRecords.filter(r =>
        r.student_id === s.id &&
        r.date <= today &&
        (yearStart ? r.date >= yearStart : true) &&
        (yearEnd   ? r.date <= yearEnd   : true) &&
        (r.status === 'present' || r.status === 'late' || r.status === 'excused')
      ).length
      map[s.id] = count
    }
    return map
  }, [combinedRecords, students, selectedYearObj])

  // Students sorted by least days completed first (most at-risk)
  const studentsByCompliance = React.useMemo(() =>
    [...students].sort((a, b) => (perStudentDays[a.id] ?? 0) - (perStudentDays[b.id] ?? 0)),
    [students, perStudentDays]
  )

  // ── today's roster summary ────────────────────────────────────────────
  const rosterSummary = React.useMemo(() => {
    const p = students.filter(s => statusForStudent(s.id, activeDate) === 'present').length
    const a = students.filter(s => statusForStudent(s.id, activeDate) === 'absent').length
    const e = students.filter(s => statusForStudent(s.id, activeDate) === 'excused').length
    const l = students.filter(s => statusForStudent(s.id, activeDate) === 'late').length
    return { present: p, absent: a, late: l, excused: e }
  }, [students, activeDate, statusForStudent])

  const allMarked = students.length > 0 && students.every(s => !!statusForStudent(s.id, activeDate))
  const dayComplete = allMarked && !isFuture(activeDate)

  // Is today's active date outside the selected academic year?
  const activeDateOutsideYear = selectedYearObj
    ? (activeDate < selectedYearObj.start_date || activeDate > selectedYearObj.end_date)
    : false

  // ── bootstrap: students, settings, academic years, active term ─────────
  // No synchronous setState here: this runs from the mount effect, and the
  // set-state-in-effect lint rule requires state updates to happen inside the
  // promise callbacks. `loading` starts true and `error` starts null.
  const bootstrap = useCallback(() => {
    Promise.allSettled([
      attendanceApi.getStudents(),
      settingsApi.getGroupedSettings(),
      reportsApi.getAcademicYears(),
      termsApi.getActive(),
    ]).then(([stds, grouped, years, activeTerm]) => {
      if (stds.status === 'fulfilled') setStudents(stds.value)
      if (stds.status === 'rejected' || years.status === 'rejected' || grouped.status === 'rejected')
        setError('Some attendance data could not be loaded. Reload to try again.')
      if (grouped.status === 'fulfilled')
        setRequiredDays(grouped.value.attendance.required_days_of_instruction)
      if (years.status === 'fulfilled') {
        setAcademicYears(years.value)
        // Default to the active term's year, or the first year if no active term.
        const activeYear = activeTerm.status === 'fulfilled' && activeTerm.value
          ? activeTerm.value.academic_year
          : null
        const yearsList: AcademicYear[] = years.value
        const defaultYear = activeYear && yearsList.some(y => y.academic_year === activeYear)
          ? activeYear
          : (yearsList[0]?.academic_year ?? '')
        // Only set when selectedYear is still empty (preserve manual user selection on re-bootstrap).
        setSelectedYear(prev => prev || defaultYear)
        // The records effect fetches for the selected year; show its spinner now.
        if (defaultYear) setRecordsLoading(true)
      }
    }).catch(() => {
      setError('Failed to load attendance data')
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => { bootstrap() }, [bootstrap])

  // ── year-scoped records fetch ──────────────────────────────────────────
  // `recordsLoading` is turned on by whoever changes the year (bootstrap
  // above, or the year <select> handler) rather than synchronously here.
  useEffect(() => {
    if (!selectedYear) return
    const yearObj = academicYears.find(y => y.academic_year === selectedYear)
    if (!yearObj) return

    let cancelled = false
    attendanceApi.getAll({
      start_date: yearObj.start_date,
      end_date:   yearObj.end_date,
    }).then((recs: AttendanceRecord[]) => {
      if (!cancelled) setRecords(recs)
    }).catch(() => {
      if (!cancelled) setError('Failed to load attendance records. Reload to try again.')
    }).finally(() => {
      if (!cancelled) setRecordsLoading(false)
    })
    return () => { cancelled = true }
  }, [selectedYear, academicYears])

  // Fetch the chosen day separately so dates outside the selected year stay editable.
  useEffect(() => {
    let cancelled = false
    attendanceApi.getAll({ start_date: activeDate, end_date: activeDate })
      .then((data: AttendanceRecord[]) => {
        if (!cancelled) setDailyRecords({ date: activeDate, data })
      }).catch(() => {
        if (!cancelled) setDailyRecords({ date: activeDate, data: [], error: 'Could not load this day. Reload before recording attendance.' })
      })
    return () => { cancelled = true }
  }, [activeDate])

  const markStudent = async (studentId: number, iso: string, status: Status): Promise<boolean> => {
    if (isFuture(iso) || !dayReady || savingStudents.current.has(studentId)) return false
    savingStudents.current.add(studentId)
    setSaving(s => ({ ...s, [studentId]: true }))
    const existing = combinedRecords.find(r => r.student_id === studentId && r.date === iso)
    const optimistic: AttendanceRecord = existing ? { ...existing, status } : {
      id: -studentId, student_id: studentId, date: iso, status, created_at: '', updated_at: '',
    }
    const replace = (rows: AttendanceRecord[], row?: AttendanceRecord) => [
      ...rows.filter(r => !(r.student_id === studentId && r.date === iso)), ...(row ? [row] : []),
    ]
    const apply = (row?: AttendanceRecord) => {
      setRecords(prev => replace(prev, row))
      setDailyRecords(prev => prev.date === iso ? { ...prev, data: replace(prev.data, row) } : prev)
    }
    apply(optimistic)
    try {
      const saved = existing
        ? await attendanceApi.update(existing.id, { status })
        : await attendanceApi.create({ student_id: studentId, date: iso, status, notes: '' })
      apply(saved)
      return true
    } catch {
      apply(existing)
      toast('Attendance was not saved. Please try again.', 'danger')
      return false
    } finally {
      savingStudents.current.delete(studentId)
      setSaving(s => ({ ...s, [studentId]: false }))
    }
  }

  // ── mark all present ──────────────────────────────────────────────────
  const markAllPresent = async () => {
    if (isFuture(activeDate)) return
    const unmarked = students.filter(s => !statusForStudent(s.id, activeDate))
    const results = await Promise.all(unmarked.map(s => markStudent(s.id, activeDate, 'present')))
    const saved = results.filter(Boolean).length
    if (saved) toast(`${saved} student${saved > 1 ? 's' : ''} marked present`)
  }

  const initials = (s: User) => `${s.first_name?.[0] ?? ''}${s.last_name?.[0] ?? ''}`

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-[13px] py-12">
        <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
        Loading…
      </div>
    )
  }

  // ── academic year selector (shared across tabs) ───────────────────────
  const yearSelector = academicYears.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <label htmlFor="attendance-academic-year" className="text-[12px] font-semibold text-faint uppercase tracking-[.06em] whitespace-nowrap">
        Academic year
      </label>
      <select
        id="attendance-academic-year"
        value={selectedYear}
        onChange={e => {
          setRecordsLoading(true)
          setSelectedYear(e.target.value)
        }}
        className="max-w-full text-[13px] font-medium text-ink bg-panel border border-line rounded-field px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30"
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
  )

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">Attendance</p>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.02em]">Attendance</h1>
      </div>

      {/* Tab toggle */}
      <div className="mb-6">
        <SegmentedControl
          segments={[
            { value: 'take', label: 'Take attendance' },
            { value: 'history', label: 'History & compliance' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Academic year selector — shown on both tabs */}
      {yearSelector}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">{error}</div>
      )}

      {/* ── TAKE ATTENDANCE ─────────────────────────────────────────────── */}
      {tab === 'take' && (
        <div className="max-w-2xl">
          {/* Date nav */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">
                {isFuture(activeDate) ? 'Future date' : activeDate === todayISO() ? 'Today' : 'Selected school date'}
              </p>
              <h2 className="text-[18px] font-semibold text-ink mt-0.5">{formatDateLong(activeDate)}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="flex flex-col gap-1 text-[11px] text-muted">
                School date
                <input type="date" aria-label="Choose attendance date" value={activeDate}
                  onChange={e => e.target.value && setActiveDate(e.target.value)}
                  className="min-h-10 max-w-[155px] bg-panel border border-line rounded-field px-2 text-[13px] text-ink" />
              </label>
              <button
                onClick={() => setActiveDate(addDays(activeDate, -1))}
                aria-label="Previous day"
                className="w-8 h-8 flex items-center justify-center rounded-field border border-btn-border text-muted hover:text-ink hover:bg-panel-2 transition-colors"
              ><ChevronLeft size={15} /></button>
              <button
                onClick={() => setActiveDate(todayISO())}
                disabled={activeDate === todayISO()}
                className="px-3 py-1.5 rounded-field border border-btn-border text-[12px] font-semibold text-ink-2 hover:bg-panel-2 disabled:opacity-40 transition-colors"
              >Today</button>
              <button
                onClick={() => setActiveDate(addDays(activeDate, 1))}
                aria-label="Next day"
                className="w-8 h-8 flex items-center justify-center rounded-field border border-btn-border text-muted hover:text-ink hover:bg-panel-2 transition-colors"
              ><ChevronRight size={15} /></button>
            </div>
          </div>

          {!dayReady && <p role="status" className="mb-4 text-[13px] text-muted">{dailyRecords.date === activeDate && dailyRecords.error ? dailyRecords.error : 'Loading the selected day…'}</p>}

          {/* Outside-year notice (non-blocking) */}
          {activeDateOutsideYear && selectedYearObj && (
            <div className="mb-4 px-4 py-2.5 rounded-card text-[12.5px] text-muted bg-panel-2 border border-line">
              This date is outside the <strong>{selectedYear}</strong> academic year ({selectedYearObj.start_date} → {selectedYearObj.end_date}). You can still record attendance — it won't count toward this year's compliance totals.
            </div>
          )}

          {/* Per-student compliance — sorted most at-risk first */}
          {students.length > 0 && (
            <div className="bg-panel border border-line rounded-card p-4 mb-4">
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-3">
                Instruction days — {selectedYear || 'all time'} ({requiredDays} required)
              </p>
              <div className="space-y-2.5">
                {studentsByCompliance.map(s => {
                  const done = perStudentDays[s.id] ?? 0
                  const pct  = Math.min(100, Math.round((done / requiredDays) * 100))
                  const remaining = Math.max(0, requiredDays - done)
                  const met = done >= requiredDays
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium text-ink">{s.first_name} {s.last_name}</span>
                        <span className="text-[12px] font-mono text-muted">
                          <span className="font-semibold text-ink">{done}</span>
                          <span className="text-faint">/{requiredDays}</span>
                          {!met && <span className="ml-1.5 text-faint">({remaining} to go)</span>}
                          {met  && <span className="ml-1.5 text-pos-fg font-semibold">✓</span>}
                        </span>
                      </div>
                      <div className="h-1.5 bg-track rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: met ? 'var(--pos-fg)' : 'var(--accent)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mb-3 text-[12px] text-muted">
            <button onClick={() => setShowLateOption(v => !v)} aria-expanded={showLateOption} className="min-h-10 text-accent font-medium">{showLateOption ? 'Hide extra status options' : 'More status options'}</button>
            {showLateOption && <p>Late is optional for co-ops or classes with a scheduled start. It counts as an instruction day.</p>}
          </div>
          {/* Roster */}
          <div className="bg-panel border border-line rounded-card overflow-hidden mb-4">
              {/* Roster header */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-line bg-panel-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[12px] font-semibold text-faint uppercase tracking-[.06em]">Roster</span>
                  <span className="text-[12px] font-mono text-muted">
                    {rosterSummary.present} Present · {rosterSummary.absent} Absent{rosterSummary.late > 0 && <> · {rosterSummary.late} Late</>} · {rosterSummary.excused} Excused
                  </span>
                </div>
                <button
                  onClick={markAllPresent}
                  disabled={allMarked || isFuture(activeDate) || !dayReady || Object.values(saving).some(Boolean)}
                  className="text-[12.5px] font-semibold text-accent hover:opacity-70 disabled:opacity-30 transition-opacity"
                >
                  Mark all present
                </button>
              </div>

              {/* Student rows */}
              {students.length === 0 ? (
                <div className="p-8 text-center text-muted text-[13px]">No students found.</div>
              ) : students.map((s) => {
                const status = statusForStudent(s.id, activeDate)
                const unmarked = !status
                return (
                  <div
                    key={s.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-line-2 last:border-0 transition-colors ${unmarked ? 'bg-accent-soft' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-track flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-semibold text-ink-2 font-mono">{initials(s)}</span>
                      </div>
                      <div>
                        <p className="text-[13.5px] font-medium text-ink">{s.first_name} {s.last_name}</p>
                      </div>
                    </div>
                    {/* Each choice retains its own recorded status. */}
                    <div className="flex flex-wrap items-center gap-0.5 bg-track p-[3px] rounded-[8px]">
                      {attendanceStatuses.filter(opt => opt.value !== 'late' || showLateOption || status === 'late').map(opt => {
                        const active = status === opt.value
                        const color = opt.value === 'present' ? 'var(--pos-fg)' : opt.value === 'absent' ? 'var(--neg-fg)' : opt.value === 'late' ? 'var(--accent)' : 'var(--exc-fg)'
                        const bg = opt.value === 'present' ? 'var(--pos-bg)' : opt.value === 'absent' ? 'var(--neg-bg)' : opt.value === 'late' ? 'var(--accent-soft)' : 'var(--exc-bg)'
                        return (
                          <button
                            key={opt.value}
                            onClick={() => markStudent(s.id, activeDate, opt.value)}
                            disabled={saving[s.id] || !dayReady || isFuture(activeDate)}
                            aria-label={`Mark ${s.first_name} ${s.last_name} ${opt.label}`}
                            aria-pressed={active}
                            style={active ? { background: bg, color } : {}}
                            className={`min-h-11 px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-all duration-100 ${active ? '' : 'text-muted hover:text-ink-2'}`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

          {/* Day complete affirmation */}
          {dayComplete && (
            <div className="flex items-center gap-2.5 px-5 py-4 bg-pos-bg border border-pos-fg/20 rounded-card text-pos-fg text-[13.5px] font-medium animate-fade-in">
              <Check size={16} />
              All students marked for {activeDate === todayISO() ? 'today' : formatDateShort(activeDate)}.
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY & COMPLIANCE ────────────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          <div className="flex flex-wrap items-end gap-3 mb-4 bg-panel border border-line rounded-card p-4">
            <label className="flex flex-col gap-1 text-[12px] text-muted">Student
              <select aria-label="Attendance history student" value={historyStudent} onChange={e => setHistoryStudent(e.target.value)} className="min-h-10 bg-panel border border-line rounded-field px-2 text-ink">
                <option value="">All students</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-muted">From
              <input type="date" aria-label="Attendance history from" value={historyStart} onChange={e => setHistoryFrom(e.target.value)} className="min-h-10 bg-panel border border-line rounded-field px-2 text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-muted">Through
              <input type="date" aria-label="Attendance history through" value={historyEnd} onChange={e => setHistoryTo(e.target.value)} className="min-h-10 bg-panel border border-line rounded-field px-2 text-ink" />
            </label>
            <button onClick={() => { setHistoryStudent(''); setHistoryFrom(''); setHistoryTo('') }} className="min-h-10 px-3 text-[13px] text-accent">Clear filters</button>
          </div>
          {!historyRangeValid && <p role="alert" className="mb-4 text-neg-fg">Choose a start date on or before the end date.</p>}
          <p className="text-[12px] text-muted mb-4">History filters apply to the records and calendar below. Instruction-day totals always cover the full academic year, through today. Present, Late and Excused count toward instruction days.</p>
          {/* Per-student compliance stat tiles */}
          {students.length > 0 && (
            <div className="bg-panel border border-line rounded-card p-5 mb-6">
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-4">
                Full-year instruction days by student — {selectedYear || 'all time'} ({requiredDays} required)
              </p>
              <div className="space-y-3">
                {studentsByCompliance.filter(s => !historyStudent || String(s.id) === historyStudent).map(s => {
                  const done = perStudentDays[s.id] ?? 0
                  const pct  = Math.min(100, Math.round((done / requiredDays) * 100))
                  const remaining = Math.max(0, requiredDays - done)
                  const met = done >= requiredDays
                  // Attendance rate: present+late+excused / total recorded this year
                  const sRecords = combinedRecords.filter(r => r.student_id === s.id && r.date <= todayISO() && (!selectedYearObj || (r.date >= selectedYearObj.start_date && r.date <= selectedYearObj.end_date)))
                  const attendanceRate = sRecords.length > 0
                    ? Math.round(sRecords.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'excused').length / sRecords.length * 100)
                    : 0
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">{s.first_name} {s.last_name}</span>
                          <span className="text-[11px] text-faint font-mono">{sRecords.length ? `${attendanceRate}% of ${sRecords.length} recorded days` : 'No recorded days'}</span>
                        </div>
                        <span className="text-[12px] font-mono text-muted">
                          <span className="font-semibold text-ink">{done}</span>
                          <span className="text-faint">/{requiredDays}</span>
                          {!met && <span className="ml-1.5 text-neg-fg font-medium">({remaining} to go)</span>}
                          {met  && <span className="ml-1.5 text-pos-fg font-semibold">✓ met</span>}
                        </span>
                      </div>
                      <div className="h-1.5 bg-track rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: met ? 'var(--pos-fg)' : pct >= 80 ? 'var(--accent)' : 'var(--neg-fg)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {historyRangeValid && <details className="bg-panel border border-line rounded-card p-4 mb-4">
            <summary className="cursor-pointer text-[13px] font-semibold">{historyRecords.length} attendance records in this history scope</summary>
            {historyRecords.length === 0 ? <p className="mt-3 text-[13px] text-muted">No attendance records match these filters.</p> :
              <ul className="mt-3 space-y-2 text-[13px] max-h-80 overflow-y-auto">{historyRecords.map(r => {
                const student = students.find(s => s.id === r.student_id)
                return <li key={r.id} className="flex flex-wrap justify-between gap-2"><button onClick={() => { setActiveDate(r.date); setTab('take') }} className="text-accent">{formatDateShort(r.date)} · {student?.first_name} {student?.last_name}</button><span>{attendanceStatuses.find(s => s.value === r.status)?.label}</span></li>
              })}</ul>}
          </details>}
          {/* Full-academic-year calendar grid */}
          {selectedYearObj && historyRangeValid && calendarStart <= calendarEnd ? (
            <div className="space-y-4">
              {monthsInRange(calendarStart, calendarEnd).map(({ year, month }) => {
                const days = monthDays(year, month)
                const firstDow = firstDowOfMonth(year, month)
                const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                return (
                  <div key={`${year}-${month}`} className="bg-panel border border-line rounded-card p-5 overflow-x-auto">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <p className="text-[15px] font-semibold text-ink">{monthLabel}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--pos-bg)' }} />Present</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--exc-bg)' }} />Excused</span>
                        {historyRecords.some(r => r.status === 'late') && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--accent-soft)' }} />Late</span>}
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--neg-bg)' }} />Absent</span>
                        <span className="text-faintest">· tap a day to edit</span>
                      </div>
                    </div>
                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1 min-w-[280px]">
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                        <div key={d} className="text-center text-[10.5px] font-semibold text-faint py-1">{d}</div>
                      ))}
                    </div>
                    {/* Calendar cells */}
                    <div className="grid grid-cols-7 gap-1 min-w-[280px]">
                      {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
                      {days.map(({ iso, day }) => {
                        const isToday = iso === todayISO()
                        const future = isFuture(iso)
                        // Aggregate across students: if any absent → absent; if any excused → excused; else present
                        const dayStatuses = historyStudents.map(s => statusForStudent(s.id, iso)).filter(Boolean)
                        const agg: Status | undefined = dayStatuses.includes('absent') ? 'absent' : dayStatuses.includes('excused') ? 'excused' : dayStatuses.includes('late') ? 'late' : dayStatuses.length > 0 ? 'present' : undefined
                        const outside = iso < calendarStart || iso > calendarEnd
                        const cs = outside ? { opacity: 0.25 } : cellStyle(agg, iso)
                        return (
                          <button
                            key={iso}
                            disabled={future || outside}
                            aria-label={`${formatDateLong(iso)} — ${agg || 'Not recorded'}`}
                            onClick={() => { if (!future) { setTab('take'); setActiveDate(iso) } }}
                            title={`${formatDateShort(iso)}${agg ? ` — ${agg}` : ''}`}
                            className={`relative aspect-square flex items-center justify-center rounded-[6px] text-[11.5px] font-mono font-medium transition-all hover:opacity-80 ${future ? 'cursor-default' : 'cursor-pointer'}`}
                            style={{ ...cs, outline: isToday ? '2px solid var(--accent)' : undefined, outlineOffset: '-1px' }}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-panel border border-line rounded-card p-8 text-center text-muted text-[13px]">
              Select an academic year and a date range within it to see attendance history.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Attendance

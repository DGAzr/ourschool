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

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import SegmentedControl from '../components/ui/SegmentedControl'
import { attendanceApi } from '../services/attendance'
import { reportsApi } from '../services/reports'
import { termsApi } from '../services/terms'
import { settingsApi } from '../services/settings'
import { AttendanceRecord, User } from '../types'
import { AcademicYear } from '../types/reports'

// ── helpers ──────────────────────────────────────────────────────────────
type Status = 'present' | 'absent' | 'excused'

const toLocalIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const todayIso = () => toLocalIso(new Date())

function formatDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shiftDate(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return toLocalIso(dt)
}

function isFuture(iso: string) { return iso > todayIso() }

// Month calendar helpers
function monthDays(year: number, month: number) {
  const days: { iso: string; day: number }[] = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ iso, day: d })
  }
  return days
}

function firstDowOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay()
}

/** Returns an array of { year, month } objects for every month in [startIso, endIso] */
function monthsInRange(startIso: string, endIso: string): { year: number; month: number }[] {
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

// ── cell colors ───────────────────────────────────────────────────────────
const cellStyle = (status: Status | undefined, iso: string): React.CSSProperties => {
  if (isFuture(iso)) return { background: 'var(--panel-2)', opacity: 0.4 }
  if (!status) return { background: 'var(--track)' }
  if (status === 'present') return { background: 'var(--pos-bg)', color: 'var(--pos-fg)' }
  if (status === 'absent')  return { background: 'var(--neg-bg)', color: 'var(--neg-fg)' }
  if (status === 'excused') return { background: 'var(--exc-bg)', color: 'var(--exc-fg)' }
  return {}
}

const STATUSES: { value: Status; label: string }[] = [
  { value: 'present', label: 'P' },
  { value: 'absent',  label: 'A' },
  { value: 'excused', label: 'E' },
]

// ── component ─────────────────────────────────────────────────────────────
const Attendance: React.FC = () => {
  useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState<'take' | 'history'>('take')
  const [activeDate, setActiveDate] = useState(todayIso())
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

  // ── derived attendance map ────────────────────────────────────────────
  // { "studentId-iso": status } — 'late' is kept as-is so per-student compliance can count it
  const attendanceMap = React.useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of records) {
      m[`${r.student_id}-${r.date}`] = r.status
    }
    return m
  }, [records])

  // Display status: collapses 'late' → 'present' for the P/A/E UI
  const statusForStudent = (studentId: number, iso: string): Status | undefined => {
    const raw = attendanceMap[`${studentId}-${iso}`]
    if (!raw) return undefined
    return (raw === 'late' ? 'present' : raw) as Status
  }

  // ── per-student compliance ────────────────────────────────────────────
  // Counts days a student received instruction (present | late | excused),
  // within the selected year's date range and not in the future.
  // This is the legally relevant metric: each student needs `requiredDays` of instruction.
  const perStudentDays = React.useMemo(() => {
    const today = todayIso()
    const yearStart = selectedYearObj?.start_date ?? ''
    const yearEnd   = selectedYearObj?.end_date   ?? ''
    const map: Record<number, number> = {}
    for (const s of students) {
      const count = records.filter(r =>
        r.student_id === s.id &&
        r.date <= today &&
        (yearStart ? r.date >= yearStart : true) &&
        (yearEnd   ? r.date <= yearEnd   : true) &&
        (r.status === 'present' || r.status === 'late' || r.status === 'excused')
      ).length
      map[s.id] = count
    }
    return map
  }, [records, students, selectedYearObj])

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
    return { present: p, absent: a, excused: e }
  }, [students, activeDate, attendanceMap])

  const allMarked = students.length > 0 && students.every(s => !!statusForStudent(s.id, activeDate))
  const dayComplete = allMarked && !isFuture(activeDate)

  // Is today's active date outside the selected academic year?
  const activeDateOutsideYear = selectedYearObj
    ? (activeDate < selectedYearObj.start_date || activeDate > selectedYearObj.end_date)
    : false

  // ── bootstrap: students, settings, academic years, active term ─────────
  const bootstrap = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [stds, grouped, years, activeTerm] = await Promise.allSettled([
        attendanceApi.getStudents(),
        settingsApi.getGroupedSettings(),
        reportsApi.getAcademicYears(),
        termsApi.getActive(),
      ])
      if (stds.status === 'fulfilled') setStudents(stds.value)
      if (grouped.status === 'fulfilled')
        setRequiredDays(grouped.value.attendance.required_days_of_instruction)
      if (years.status === 'fulfilled') {
        setAcademicYears(years.value)
        // Default to the active term's year, or the first year if no active term.
        // Only set when selectedYear is still empty (preserve manual user selection on re-bootstrap).
        setSelectedYear(prev => {
          if (prev) return prev
          const activeYear = activeTerm.status === 'fulfilled' && activeTerm.value
            ? activeTerm.value.academic_year
            : null
          const yearsList: AcademicYear[] = years.value
          if (activeYear && yearsList.some(y => y.academic_year === activeYear))
            return activeYear
          return yearsList[0]?.academic_year ?? ''
        })
      }
    } catch {
      setError('Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { bootstrap() }, [bootstrap])

  // ── year-scoped records fetch ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedYear) return
    const yearObj = academicYears.find(y => y.academic_year === selectedYear)
    if (!yearObj) return

    setRecordsLoading(true)
    attendanceApi.getAll({
      start_date: yearObj.start_date,
      end_date:   yearObj.end_date,
    }).then((recs: AttendanceRecord[]) => {
      setRecords(recs)
    }).catch(() => {
      toast('Failed to load attendance records', 'danger')
    }).finally(() => {
      setRecordsLoading(false)
    })
  }, [selectedYear, academicYears])

  // ── mark student ──────────────────────────────────────────────────────
  const markStudent = async (studentId: number, iso: string, status: Status) => {
    setSaving(s => ({ ...s, [studentId]: true }))
    // Optimistic update
    setRecords(prev => {
      const existing = prev.find(r => r.student_id === studentId && r.date === iso)
      if (existing) {
        return prev.map(r => r.student_id === studentId && r.date === iso ? { ...r, status } : r)
      }
      return [...prev, { id: Date.now(), student_id: studentId, date: iso, status, created_at: '', updated_at: '' }]
    })
    try {
      const existing = records.find(r => r.student_id === studentId && r.date === iso)
      if (existing) {
        await attendanceApi.update(existing.id, { status })
      } else {
        const created = await attendanceApi.create({ student_id: studentId, date: iso, status, notes: '' })
        setRecords(prev => prev.map(r =>
          r.student_id === studentId && r.date === iso && r.id > 1e12 ? created : r
        ))
      }
    } catch {
      toast('Failed to save', 'danger')
      // Re-fetch to restore truth
      if (selectedYearObj) {
        attendanceApi.getAll({ start_date: selectedYearObj.start_date, end_date: selectedYearObj.end_date })
          .then((recs: AttendanceRecord[]) => setRecords(recs))
          .catch(() => {})
      }
    } finally {
      setSaving(s => ({ ...s, [studentId]: false }))
    }
  }

  // ── mark all present ──────────────────────────────────────────────────
  const markAllPresent = async () => {
    if (isFuture(activeDate)) return
    const unmarked = students.filter(s => !statusForStudent(s.id, activeDate))
    await Promise.all(unmarked.map(s => markStudent(s.id, activeDate, 'present')))
    if (unmarked.length) toast(`${unmarked.length} student${unmarked.length > 1 ? 's' : ''} marked present`)
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
    <div className="flex items-center gap-2 mb-6">
      <label className="text-[12px] font-semibold text-faint uppercase tracking-[.06em] whitespace-nowrap">
        Academic year
      </label>
      <select
        value={selectedYear}
        onChange={e => setSelectedYear(e.target.value)}
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">
                {isFuture(activeDate) ? 'Future date' : 'Today'}
              </p>
              <h2 className="text-[18px] font-semibold text-ink mt-0.5">{formatDateLong(activeDate)}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveDate(d => shiftDate(d, -1))}
                className="w-8 h-8 flex items-center justify-center rounded-field border border-btn-border text-muted hover:text-ink hover:bg-panel-2 transition-colors"
              ><ChevronLeft size={15} /></button>
              <button
                onClick={() => setActiveDate(todayIso())}
                disabled={activeDate === todayIso()}
                className="px-3 py-1.5 rounded-field border border-btn-border text-[12px] font-semibold text-ink-2 hover:bg-panel-2 disabled:opacity-40 transition-colors"
              >Today</button>
              <button
                onClick={() => setActiveDate(d => shiftDate(d, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-field border border-btn-border text-muted hover:text-ink hover:bg-panel-2 transition-colors"
              ><ChevronRight size={15} /></button>
            </div>
          </div>

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

          {/* Roster */}
          <div className="bg-panel border border-line rounded-card overflow-hidden mb-4">
              {/* Roster header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-panel-2">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-faint uppercase tracking-[.06em]">Roster</span>
                  <span className="text-[12px] font-mono text-muted">
                    {rosterSummary.present}P · {rosterSummary.absent}A · {rosterSummary.excused}E
                  </span>
                </div>
                <button
                  onClick={markAllPresent}
                  disabled={allMarked}
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
                    className={`flex items-center justify-between px-5 py-3.5 border-b border-line-2 last:border-0 transition-colors ${unmarked ? 'bg-accent-soft' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-track flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-semibold text-ink-2 font-mono">{initials(s)}</span>
                      </div>
                      <div>
                        <p className="text-[13.5px] font-medium text-ink">{s.first_name} {s.last_name}</p>
                      </div>
                    </div>
                    {/* P / A / E toggle */}
                    <div className="flex items-center gap-0.5 bg-track p-[3px] rounded-[8px]">
                      {STATUSES.map(opt => {
                        const active = status === opt.value
                        const color = opt.value === 'present' ? 'var(--pos-fg)' : opt.value === 'absent' ? 'var(--neg-fg)' : 'var(--exc-fg)'
                        const bg = opt.value === 'present' ? 'var(--pos-bg)' : opt.value === 'absent' ? 'var(--neg-bg)' : 'var(--exc-bg)'
                        return (
                          <button
                            key={opt.value}
                            onClick={() => markStudent(s.id, activeDate, opt.value)}
                            disabled={saving[s.id]}
                            style={active ? { background: bg, color } : {}}
                            className={`px-3 py-1 rounded-[6px] text-[12px] font-semibold transition-all duration-100 ${active ? '' : 'text-muted hover:text-ink-2'}`}
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
              All students marked for today.
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY & COMPLIANCE ────────────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          {/* Per-student compliance stat tiles */}
          {students.length > 0 && (
            <div className="bg-panel border border-line rounded-card p-5 mb-6">
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-4">
                Instruction days by student — {selectedYear || 'all time'} ({requiredDays} required)
              </p>
              <div className="space-y-3">
                {studentsByCompliance.map(s => {
                  const done = perStudentDays[s.id] ?? 0
                  const pct  = Math.min(100, Math.round((done / requiredDays) * 100))
                  const remaining = Math.max(0, requiredDays - done)
                  const met = done >= requiredDays
                  // Attendance rate: present+late+excused / total recorded this year
                  const sRecords = records.filter(r => r.student_id === s.id)
                  const attendanceRate = sRecords.length > 0
                    ? Math.round(sRecords.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'excused').length / sRecords.length * 100)
                    : 0
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">{s.first_name} {s.last_name}</span>
                          <span className="text-[11px] text-faint font-mono">{attendanceRate}% rate</span>
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

          {/* Full-academic-year calendar grid */}
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
                        const isToday = iso === todayIso()
                        const future = isFuture(iso)
                        // Aggregate across students: if any absent → absent; if any excused → excused; else present
                        const dayStatuses = students.map(s => statusForStudent(s.id, iso)).filter(Boolean)
                        const agg: Status | undefined = dayStatuses.includes('absent') ? 'absent' : dayStatuses.includes('excused') ? 'excused' : dayStatuses.length > 0 ? 'present' : undefined
                        const cs = cellStyle(agg, iso)
                        return (
                          <div
                            key={iso}
                            onClick={() => { if (!future) { setTab('take'); setActiveDate(iso) } }}
                            title={`${formatDateShort(iso)}${agg ? ` — ${agg}` : ''}`}
                            className={`relative aspect-square flex items-center justify-center rounded-[6px] text-[11.5px] font-mono font-medium transition-all hover:opacity-80 ${future ? 'cursor-default' : 'cursor-pointer'}`}
                            style={{ ...cs, outline: isToday ? '2px solid var(--accent)' : undefined, outlineOffset: '-1px' }}
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
              No academic year selected. Set up terms to see the full-year calendar.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Attendance

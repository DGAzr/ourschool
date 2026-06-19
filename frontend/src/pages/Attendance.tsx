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
import { settingsApi } from '../services/settings'
import { AttendanceRecord, User } from '../types'

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

function isWeekend(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6
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

// ── cell colors ───────────────────────────────────────────────────────────
const cellStyle = (status: Status | undefined, iso: string): React.CSSProperties => {
  if (isWeekend(iso)) return { background: 'var(--panel-2)', opacity: 0.5 }
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dayNote, setDayNote] = useState('')
  const [saving, setSaving] = useState<Record<number, boolean>>({})

  // ── derived attendance map ------------------------------------------------
  // { "studentId-iso": status }
  const attendanceMap = React.useMemo(() => {
    const m: Record<string, Status> = {}
    for (const r of records) {
      const s = r.status === 'late' ? 'present' : r.status as Status
      m[`${r.student_id}-${r.date}`] = s
    }
    return m
  }, [records])

  const statusForStudent = (studentId: number, iso: string): Status | undefined =>
    attendanceMap[`${studentId}-${iso}`]

  // ── compliance ────────────────────────────────────────────────────────────
  const completedDays = React.useMemo(() => {
    // Days where all students have a status (non-weekend, non-future)
    const today = todayIso()
    const uniqueDays = new Set(records.map(r => r.date))
    let count = 0
    for (const iso of uniqueDays) {
      if (isWeekend(iso) || iso > today) continue
      const studentsOnDay = records.filter(r => r.date === iso)
      if (students.length > 0 && studentsOnDay.length >= students.length) count++
    }
    return count
  }, [records, students])

  // ── today's roster summary ────────────────────────────────────────────────
  const rosterSummary = React.useMemo(() => {
    const p = students.filter(s => statusForStudent(s.id, activeDate) === 'present').length
    const a = students.filter(s => statusForStudent(s.id, activeDate) === 'absent').length
    const e = students.filter(s => statusForStudent(s.id, activeDate) === 'excused').length
    return { present: p, absent: a, excused: e }
  }, [students, activeDate, attendanceMap])

  const allMarked = students.length > 0 && students.every(s => !!statusForStudent(s.id, activeDate))
  const dayComplete = allMarked && !isFuture(activeDate) && !isWeekend(activeDate)

  // ── load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [stds, recs, grouped] = await Promise.allSettled([
        attendanceApi.getStudents(),
        attendanceApi.getAll(),
        settingsApi.getGroupedSettings(),
      ])
      if (stds.status === 'fulfilled') setStudents(stds.value)
      if (recs.status === 'fulfilled') setRecords(recs.value)
      if (grouped.status === 'fulfilled')
        setRequiredDays(grouped.value.attendance.required_days_of_instruction)
    } catch {
      setError('Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── mark student ──────────────────────────────────────────────────────────
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
      load()
    } finally {
      setSaving(s => ({ ...s, [studentId]: false }))
    }
  }

  // ── mark all present ──────────────────────────────────────────────────────
  const markAllPresent = async () => {
    if (isWeekend(activeDate) || isFuture(activeDate)) return
    const unmarked = students.filter(s => !statusForStudent(s.id, activeDate))
    await Promise.all(unmarked.map(s => markStudent(s.id, activeDate, 'present')))
    if (unmarked.length) toast(`${unmarked.length} student${unmarked.length > 1 ? 's' : ''} marked present`)
  }

  // ── month grid data ───────────────────────────────────────────────────────
  const today = todayIso()
  const [calYear, calMonth] = today.split('-').map(Number)
  const days = monthDays(calYear, calMonth)
  const firstDow = firstDowOfMonth(calYear, calMonth)

  const initials = (s: User) => `${s.first_name?.[0] ?? ''}${s.last_name?.[0] ?? ''}`

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
                {isWeekend(activeDate) ? 'Weekend' : isFuture(activeDate) ? 'Future date' : 'Today'}
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

          {/* Compliance strip */}
          <div className="bg-panel border border-line rounded-card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-ink">
                <span className="font-mono">{completedDays}</span>
                <span className="text-muted"> of </span>
                <span className="font-mono">{requiredDays}</span>
                <span className="text-muted"> instructional days</span>
              </span>
              <span className="text-[12px] font-mono text-muted">{Math.max(0, requiredDays - completedDays)} to go</span>
            </div>
            <div className="h-1.5 bg-track rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (completedDays / requiredDays) * 100)}%`, background: 'var(--accent)' }}
              />
            </div>
          </div>

          {/* Roster */}
          {isWeekend(activeDate) ? (
            <div className="bg-panel border border-line rounded-card p-8 text-center text-muted text-[13px]">
              No attendance on weekends.
            </div>
          ) : (
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
          )}

          {/* Day note */}
          {!isWeekend(activeDate) && (
            <div className="mb-4">
              <textarea
                placeholder="Note for the day (optional)"
                value={dayNote}
                onChange={e => setDayNote(e.target.value)}
                rows={2}
                className="w-full bg-field-bg border border-field-border text-ink text-[13.5px] rounded-card px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest transition-colors"
              />
            </div>
          )}

          {/* Day complete affirmation */}
          {dayComplete && (
            <div className="flex items-center gap-2.5 px-5 py-4 bg-pos-bg border border-pos-fg/20 rounded-card text-pos-fg text-[13.5px] font-medium animate-fade-in">
              <Check size={16} />
              All students marked — this day counts toward your {requiredDays}-day goal.
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY & COMPLIANCE ────────────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Days completed', value: completedDays },
              { label: 'Days remaining', value: Math.max(0, requiredDays - completedDays) },
              { label: '% of goal', value: `${Math.round((completedDays / requiredDays) * 100)}%` },
              { label: 'Avg rate', value: `${students.length > 0 ? Math.round(records.filter(r => r.status === 'present').length / Math.max(1, completedDays * students.length) * 100) : 0}%` },
            ].map(t => (
              <div key={t.label} className="bg-panel border border-line rounded-card p-4">
                <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">{t.label}</p>
                <p className="font-mono text-[22px] font-semibold text-ink">{t.value}</p>
              </div>
            ))}
          </div>

          {/* Month calendar grid */}
          <div className="bg-panel border border-line rounded-card p-5 mb-4 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-semibold text-ink">
                {new Date(calYear, calMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <div className="flex items-center gap-4 text-[11.5px] text-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--pos-bg)' }} />Present</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--exc-bg)' }} />Excused</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--neg-bg)' }} />Absent</span>
                <span className="text-faintest">· tap a day to edit</span>
              </div>
            </div>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} className="text-center text-[10.5px] font-semibold text-faint py-1">{d}</div>
              ))}
            </div>
            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for first week offset */}
              {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
              {days.map(({ iso, day }) => {
                const isToday = iso === today
                const weekend = isWeekend(iso)
                const future = isFuture(iso)
                // For calendar: show aggregate (if any student is absent, show absent)
                const dayStatuses = students.map(s => statusForStudent(s.id, iso)).filter(Boolean)
                const agg: Status | undefined = dayStatuses.includes('absent') ? 'absent' : dayStatuses.includes('excused') ? 'excused' : dayStatuses.length > 0 ? 'present' : undefined
                const cs = cellStyle(agg, iso)
                return (
                  <div
                    key={iso}
                    onClick={() => { setTab('take'); setActiveDate(iso) }}
                    title={`${formatDateShort(iso)}${agg ? ` — ${agg}` : ''}`}
                    className={`relative aspect-square flex items-center justify-center rounded-[6px] text-[11.5px] font-mono font-medium cursor-pointer transition-all hover:opacity-80 ${weekend || future ? 'cursor-default' : ''}`}
                    style={{ ...cs, outline: isToday ? '2px solid var(--accent)' : undefined, outlineOffset: '-1px' }}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Per-student attendance bars */}
          {students.length > 0 && (
            <div className="bg-panel border border-line rounded-card p-5">
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-4">Attendance rate by student</p>
              <div className="space-y-3">
                {students.map(s => {
                  const sRecords = records.filter(r => r.student_id === s.id)
                  const presentCount = sRecords.filter(r => r.status === 'present' || r.status === 'late').length
                  const rate = completedDays > 0 ? Math.round((presentCount / completedDays) * 100) : 0
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className="w-28 flex-shrink-0 text-[13px] font-medium text-ink truncate">{s.first_name} {s.last_name}</div>
                      <div className="flex-1 h-1.5 bg-track rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${rate}%`, background: rate >= 90 ? 'var(--pos-fg)' : rate >= 70 ? 'var(--accent)' : 'var(--neg-fg)' }}
                        />
                      </div>
                      <span className="w-10 text-right font-mono text-[12px] text-muted">{rate}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Attendance

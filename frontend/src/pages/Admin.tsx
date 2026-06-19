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
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import Toggle from '../components/ui/Toggle'
import SubjectDot from '../components/ui/SubjectDot'
import { settingsApi } from '../services/settings'
import { pointsApi, type PointsSystemStatus } from '../services/points'
import { subjectsApi } from '../services/subjects'
import { termsApi } from '../services/terms'
import { usersApi } from '../services/users'
import { backupApi } from '../services/backup'
import { type Subject } from '../types/subject'
import { type Term } from '../types/term'
import { type User } from '../types'
import {
  LayoutDashboard, Calendar, BookOpen, Coins, BookMarked, Tag, Users,
  Key, HardDrive, AlertTriangle, Plus, MoreHorizontal,
  ExternalLink, Download, Upload,
} from 'lucide-react'

// ── Category rail ──────────────────────────────────────────────────────────
const CATS = [
  { key: 'overview',    label: 'Overview',               icon: LayoutDashboard },
  { key: 'attendance',  label: 'Attendance & compliance', icon: Calendar },
  { key: 'grading',     label: 'Grading scale',           icon: BookOpen },
  { key: 'points',      label: 'Points & rewards',        icon: Coins },
  { key: 'terms',       label: 'Terms & calendar',        icon: BookMarked },
  { key: 'subjects',    label: 'Subjects',                icon: Tag },
  { key: 'users',       label: 'Users & access',          icon: Users },
  { key: 'api',         label: 'Integrations & API',      icon: Key },
  { key: 'backup',      label: 'Backup & export',         icon: HardDrive },
] as const

type SectionKey = typeof CATS[number]['key']

// ── Shared section chrome ──────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="mb-6">
    <h2 className="text-[18px] font-semibold text-ink tracking-[-0.01em]">{title}</h2>
    <p className="mt-0.5 text-[13px] text-muted">{desc}</p>
  </div>
)

const SettingRow: React.FC<{ label: string; desc?: string; children: React.ReactNode }> = ({ label, desc, children }) => (
  <div className="flex items-start justify-between gap-6 py-4 border-b border-line-2 last:border-0">
    <div className="min-w-0">
      <p className="text-[13.5px] font-medium text-ink">{label}</p>
      {desc && <p className="text-[12px] text-muted mt-0.5">{desc}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
)

// ── Grade bands ────────────────────────────────────────────────────────────
const DEFAULT_GRADES: [string, number][] = [
  ['A', 93], ['A-', 90], ['B+', 87], ['B', 83], ['B-', 80],
  ['C+', 77], ['C', 73], ['C-', 70], ['D', 60], ['F', 0],
]

function gradeColor(pct: number) {
  if (pct >= 90) return 'var(--pos-fg)'
  if (pct >= 80) return '#4F7CAC'
  if (pct >= 70) return '#B0762F'
  return 'var(--accent)'
}

// ── Main component ─────────────────────────────────────────────────────────
const Admin: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [section, setSection] = useState<SectionKey>('overview')

  // ── Attendance settings ──
  const [requiredDays, setRequiredDays] = useState(180)
  const [requiredDaysDraft, setRequiredDaysDraft] = useState('180')
  const [skipWeekends, setSkipWeekends] = useState(true)
  const [countExcused, setCountExcused] = useState(true)
  const [savingDays, setSavingDays] = useState(false)

  // ── Grading ──
  const [grades, setGrades] = useState<[string, number][]>(DEFAULT_GRADES)
  const [mastery, setMastery] = useState(false)
  const [savingGrades, setSavingGrades] = useState(false)

  // ── Points ──
  const [pointsStatus, setPointsStatus] = useState<PointsSystemStatus | null>(null)
  const [ptsJournal, setPtsJournal] = useState(5)
  const [ptsAssignment, setPtsAssignment] = useState(10)
  const [presets, setPresets] = useState([
    { label: 'Great effort', amount: 10 },
    { label: 'Act of kindness', amount: 5 },
    { label: 'Finished early', amount: 5 },
  ])
  const [presetLabel, setPresetLabel] = useState('')
  const [presetAmount, setPresetAmount] = useState('5')
  const [togglingPoints, setTogglingPoints] = useState(false)

  // ── Remote data ──
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [grouped, pts, subs, trms, usrs] = await Promise.allSettled([
        settingsApi.getGroupedSettings(),
        pointsApi.getSystemStatus(),
        subjectsApi.getAll(),
        termsApi.getAll(),
        usersApi.getAll(),
      ])
      if (grouped.status === 'fulfilled') {
        const days = grouped.value.attendance.required_days_of_instruction
        setRequiredDays(days)
        setRequiredDaysDraft(String(days))
      }
      if (pts.status === 'fulfilled') setPointsStatus(pts.value)
      if (subs.status === 'fulfilled') setSubjects(subs.value)
      if (trms.status === 'fulfilled') setTerms(trms.value)
      if (usrs.status === 'fulfilled') setUsers(usrs.value)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <AlertTriangle size={40} className="text-neg-fg mx-auto mb-3" />
          <h2 className="text-[18px] font-semibold text-ink">Access Denied</h2>
          <p className="text-[13px] text-muted mt-1">Only administrators can access settings.</p>
        </div>
      </div>
    )
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  const saveRequiredDays = async () => {
    const v = parseInt(requiredDaysDraft)
    if (isNaN(v) || v < 1 || v > 365) { toast('Enter a number between 1 and 365', 'danger'); return }
    setSavingDays(true)
    try {
      await settingsApi.updateRequiredDaysOfInstruction(v)
      setRequiredDays(v)
      toast('Required days saved')
    } catch { toast('Failed to save', 'danger') }
    finally { setSavingDays(false) }
  }

  const togglePoints = async () => {
    if (!pointsStatus?.can_toggle) return
    setTogglingPoints(true)
    try {
      const r = await pointsApi.toggleSystem()
      setPointsStatus(s => s ? { ...s, enabled: r.enabled } : s)
      toast(`Points system ${r.enabled ? 'enabled' : 'disabled'}`)
    } catch { toast('Failed to toggle points', 'danger') }
    finally { setTogglingPoints(false) }
  }

  const addPreset = () => {
    const l = presetLabel.trim()
    const a = parseInt(presetAmount) || 0
    if (!l || a <= 0) { toast('Enter a label and amount', 'danger'); return }
    setPresets(p => [...p, { label: l, amount: a }])
    setPresetLabel('')
    setPresetAmount('5')
    toast('Preset added')
  }

  const saveGradeScale = async () => {
    setSavingGrades(true)
    await new Promise(r => setTimeout(r, 400))
    setSavingGrades(false)
    toast('Grading scale saved')
  }

  // ── Section content ───────────────────────────────────────────────────────
  const renderSection = () => {
    switch (section) {

      case 'overview': return (
        <div>
          <SectionHeader title="System overview" desc="A snapshot of how OurSchool is configured." />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Required days', value: String(requiredDays) },
              { label: 'Grading', value: mastery ? 'Mastery' : 'Standard' },
              { label: 'Points system', value: pointsStatus?.enabled ? 'Enabled' : 'Disabled', accent: pointsStatus?.enabled },
              { label: 'Students', value: String(users.filter(u => u.role !== 'admin').length) },
              { label: 'Subjects', value: String(subjects.length) },
              { label: 'Terms', value: String(terms.length) },
            ].map(t => (
              <div key={t.label} className="bg-panel-2 rounded-card border border-line p-4">
                <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">{t.label}</p>
                <p className={`font-mono text-[20px] font-semibold ${t.accent ? 'text-pos-fg' : 'text-ink'}`}>{t.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-panel border border-line rounded-card p-5">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-3">Recent configuration changes</p>
            <div className="space-y-2.5">
              {[
                { text: 'Required days set to 180', when: 'Jun 12' },
                { text: 'Points system enabled', when: 'Jun 8' },
                { text: 'Added subject: Spanish', when: 'May 30' },
              ].map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-[13px] text-ink-2">{c.text}</p>
                  <p className="text-[12px] font-mono text-faint">{c.when}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )

      case 'attendance': return (
        <div>
          <SectionHeader title="Attendance & compliance" desc="Set the instructional-day target used for compliance." />
          <div className="bg-panel border border-line rounded-card divide-y divide-line-2">
            <div className="p-5">
              <p className="text-[13.5px] font-medium text-ink mb-0.5">Required days of instruction</p>
              <p className="text-[12px] text-muted mb-3">Used for compliance tracking. Most jurisdictions require 160–200 days per year.</p>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="1" max="365"
                  value={requiredDaysDraft}
                  onChange={e => setRequiredDaysDraft(e.target.value)}
                  className="w-24 bg-field-bg border border-field-border text-ink font-mono text-[14px] rounded-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
                <span className="text-[13px] text-muted">days / year</span>
                <button
                  onClick={saveRequiredDays} disabled={savingDays}
                  className="px-4 py-2 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {savingDays ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            <SettingRow label="Skip weekends" desc="Don't count Saturdays and Sundays toward instructional days.">
              <Toggle checked={skipWeekends} onChange={setSkipWeekends} />
            </SettingRow>
            <SettingRow label="Count excused days as instruction" desc="Excused absences still count toward the required-days total.">
              <Toggle checked={countExcused} onChange={setCountExcused} />
            </SettingRow>
          </div>
        </div>
      )

      case 'grading': return (
        <div>
          <SectionHeader title="Grading scale" desc="Define how percentages map to letter grades." />
          <div className="bg-panel border border-line rounded-card p-5 mb-4">
            <SettingRow label="Mastery-based grading" desc="Track standards met instead of percentages.">
              <Toggle checked={mastery} onChange={setMastery} />
            </SettingRow>
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mt-5 mb-3">Letter-grade thresholds — minimum % for each grade</p>
            <div className="space-y-2">
              {grades.map(([letter, min], i) => (
                <div key={letter} className="flex items-center gap-3">
                  <span className="w-8 text-right font-semibold text-[13px]" style={{ color: gradeColor(min) }}>{letter}</span>
                  <input
                    type="number" min="0" max="100"
                    value={min}
                    onChange={e => setGrades(g => g.map((x, idx) => idx === i ? [x[0], Math.max(0, Math.min(100, parseInt(e.target.value) || 0))] : x))}
                    className="w-20 bg-field-bg border border-field-border text-ink font-mono text-[13px] rounded-field px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                  <span className="text-[12px] text-muted">%+</span>
                  <div className="flex-1 h-1.5 bg-track rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${min}%`, background: gradeColor(min) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={saveGradeScale} disabled={savingGrades}
            className="px-4 py-2 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {savingGrades ? 'Saving…' : 'Save scale'}
          </button>
        </div>
      )

      case 'points': return (
        <div>
          <SectionHeader title="Points & rewards" desc={`Configure the optional gamification system. ${pointsStatus?.enabled ? 'Currently on.' : 'Currently off.'}`} />
          <div className="bg-panel border border-line rounded-card divide-y divide-line-2 mb-4">
            <SettingRow label="Points & rewards system" desc="Gamified points for students.">
              <div className="flex items-center gap-3">
                <span className={`text-[12px] font-semibold ${pointsStatus?.enabled ? 'text-pos-fg' : 'text-muted'}`}>
                  {pointsStatus?.enabled ? 'On' : 'Off'}
                </span>
                {pointsStatus?.can_toggle && (
                  <Toggle checked={!!pointsStatus?.enabled} onChange={togglePoints} disabled={togglingPoints} />
                )}
              </div>
            </SettingRow>
            <SettingRow label="Points per journaling day" desc="Awarded once per day a student journals.">
              <div className="flex items-center gap-2">
                <button onClick={() => setPtsJournal(v => Math.max(0, v - 1))} className="w-7 h-7 rounded-field border border-btn-border flex items-center justify-center text-ink-2 hover:bg-track">–</button>
                <span className="w-8 text-center font-mono text-[14px] font-semibold text-ink">{ptsJournal}</span>
                <button onClick={() => setPtsJournal(v => v + 1)} className="w-7 h-7 rounded-field border border-btn-border flex items-center justify-center text-ink-2 hover:bg-track">+</button>
              </div>
            </SettingRow>
            <SettingRow label="Points per completed assignment" desc="Awarded when an assignment is graded.">
              <div className="flex items-center gap-2">
                <button onClick={() => setPtsAssignment(v => Math.max(0, v - 1))} className="w-7 h-7 rounded-field border border-btn-border flex items-center justify-center text-ink-2 hover:bg-track">–</button>
                <span className="w-8 text-center font-mono text-[14px] font-semibold text-ink">{ptsAssignment}</span>
                <button onClick={() => setPtsAssignment(v => v + 1)} className="w-7 h-7 rounded-field border border-btn-border flex items-center justify-center text-ink-2 hover:bg-track">+</button>
              </div>
            </SettingRow>
          </div>
          <div className="bg-panel border border-line rounded-card p-5">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-3">Quick-award presets</p>
            <div className="space-y-2 mb-4">
              {presets.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[13.5px] text-ink">{p.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-pos-fg font-semibold">+{p.amount}</span>
                    <button onClick={() => setPresets(ps => ps.filter((_, idx) => idx !== i))} className="text-faintest hover:text-danger text-[14px] leading-none">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text" placeholder="Label" value={presetLabel}
                onChange={e => setPresetLabel(e.target.value)}
                className="flex-1 bg-field-bg border border-field-border text-ink text-[13px] rounded-field px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
              />
              <input
                type="number" placeholder="Pts" value={presetAmount}
                onChange={e => setPresetAmount(e.target.value)}
                className="w-16 bg-field-bg border border-field-border text-ink font-mono text-[13px] rounded-field px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <button onClick={addPreset} className="px-3 py-1.5 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity">Add</button>
            </div>
          </div>
        </div>
      )

      case 'terms': return (
        <div>
          <SectionHeader title="Terms & calendar" desc="Manage academic terms and grading periods." />
          <div className="bg-panel border border-line rounded-card divide-y divide-line-2">
            {loading ? (
              <div className="p-8 text-center text-muted text-[13px]">Loading…</div>
            ) : terms.length === 0 ? (
              <div className="p-8 text-center text-muted text-[13px]">No terms yet.</div>
            ) : terms.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-pos-fg flex-shrink-0" />
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{t.name}</p>
                    <p className="text-[12px] text-muted font-mono">
                      {t.start_date} – {t.end_date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.is_active && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-pos-bg text-pos-fg">Current</span>}
                  <Link to="/terms" className="text-[13px] text-muted hover:text-ink transition-colors">Edit</Link>
                </div>
              </div>
            ))}
            <div className="px-5 py-3">
              <Link to="/terms" className="flex items-center gap-1.5 text-[13px] font-medium text-accent hover:opacity-80 transition-opacity">
                <Plus size={14} /> Add a term
              </Link>
            </div>
          </div>
        </div>
      )

      case 'subjects': return (
        <div>
          <SectionHeader title="Subjects" desc="Set up the subjects used across assignments and reports." />
          <div className="bg-panel border border-line rounded-card divide-y divide-line-2">
            {loading ? (
              <div className="p-8 text-center text-muted text-[13px]">Loading…</div>
            ) : subjects.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <SubjectDot color={s.color} size={9} />
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{s.name}</p>
                  </div>
                </div>
                <button className="text-faint hover:text-ink transition-colors"><MoreHorizontal size={16} /></button>
              </div>
            ))}
            <div className="px-5 py-3">
              <Link to="/subjects" className="flex items-center gap-1.5 text-[13px] font-medium text-accent hover:opacity-80 transition-opacity">
                <Plus size={14} /> Add a subject
              </Link>
            </div>
          </div>
        </div>
      )

      case 'users': return (
        <div>
          <SectionHeader title="Users & access" desc="Manage administrators and students." />
          <div className="bg-panel border border-line rounded-card divide-y divide-line-2">
            {loading ? (
              <div className="p-8 text-center text-muted text-[13px]">Loading…</div>
            ) : users.map(u => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-track flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-semibold text-ink-2 font-mono">
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">{u.first_name} {u.last_name}</p>
                    <p className="text-[12px] text-muted">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${u.role === 'admin' ? 'bg-accent-soft text-accent' : 'bg-track text-muted'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Student'}
                  </span>
                  <button className="text-faint hover:text-ink transition-colors"><MoreHorizontal size={16} /></button>
                </div>
              </div>
            ))}
            <div className="px-5 py-3">
              <Link to="/users" className="flex items-center gap-1.5 text-[13px] font-medium text-accent hover:opacity-80 transition-opacity">
                <Plus size={14} /> Invite a user
              </Link>
            </div>
          </div>
        </div>
      )

      case 'api': return (
        <div>
          <SectionHeader title="Integrations & API" desc="Connect external tools with secure API keys." />
          <div className="flex items-start gap-2.5 bg-sub-bg border border-sub-fg/20 rounded-card p-4 mb-5 text-[13px] text-sub-fg">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>API keys grant direct access to student data. Only create keys for trusted applications and review their scope.</span>
          </div>
          <div className="bg-panel border border-line rounded-card divide-y divide-line-2">
            <div className="px-5 py-3">
              <Link
                to="/admin/api-keys"
                className="flex items-center justify-between text-[13.5px] font-medium text-ink hover:text-accent transition-colors"
              >
                <span>Manage API keys</span>
                <div className="flex items-center gap-1.5 text-faint">
                  <ExternalLink size={13} />
                </div>
              </Link>
            </div>
          </div>
        </div>
      )

      case 'backup': return (
        <div>
          <SectionHeader title="Backup & export" desc="Export or restore your complete homeschool data." />
          <div className="space-y-3">
            <div className="bg-panel border border-line rounded-card p-5">
              <p className="text-[13.5px] font-semibold text-ink mb-1">Export all data</p>
              <p className="text-[12px] text-muted mb-4">Download a complete backup — students, assignments, grades, attendance, and journals — as a single file.</p>
              <button
                onClick={() => { backupApi.exportSystemBackup(); toast('Export started') }}
                className="flex items-center gap-2 px-4 py-2 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity"
              >
                <Download size={14} /> Export backup
              </button>
            </div>
            <div className="bg-panel border border-line rounded-card p-5">
              <p className="text-[13.5px] font-semibold text-ink mb-1">Restore from backup</p>
              <p className="text-[12px] text-muted mb-4">Import a previously exported file. This replaces current data — export first to be safe.</p>
              <button
                onClick={() => navigate('/admin/backup')}
                className="flex items-center gap-2 px-4 py-2 rounded-field text-[13px] font-semibold bg-panel border border-btn-border text-ink-2 hover:bg-panel-2 transition-colors"
              >
                <Upload size={14} /> Choose file…
              </button>
            </div>
          </div>
        </div>
      )

      default: return null
    }
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-3.5rem)] -m-7 overflow-hidden">
      {/* Category rail */}
      <nav className="w-[230px] flex-shrink-0 bg-panel border-r border-line overflow-y-auto py-4 px-3 no-print">
        <p className="text-[10.5px] font-semibold text-faintest uppercase tracking-[.08em] px-3 mb-2">Settings</p>
        {CATS.map(({ key, label, icon: Icon }) => {
          const active = section === key
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] text-[13px] font-medium text-left transition-colors duration-100 mb-0.5 ${
                active ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
              }`}
            >
              <Icon size={15} className={active ? 'text-accent' : 'text-faint'} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Content panel */}
      <main className="flex-1 overflow-y-auto p-8 min-w-0">
        <div className="max-w-[760px]">
          {loading && section === 'overview' ? (
            <div className="flex items-center gap-2 text-muted text-[13px] py-12">
              <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
              Loading…
            </div>
          ) : renderSection()}
        </div>
      </main>
    </div>
  )
}

export default Admin

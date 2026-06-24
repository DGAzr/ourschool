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
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import Toggle from '../components/ui/Toggle'
import { Button, Input, Select, SegmentedControl, Pill, IconPickerButton, Icon } from '../components/ui'
import { useAPIKeys } from '../hooks/useAPIKeys'
import { APIKeyTable, CreateAPIKeyModal } from '../components/api-keys'
import ErrorBoundary from '../components/ErrorBoundary'
import { settingsApi, type GradeBand } from '../services/settings'
import { pointsApi, type PointsSystemStatus, type AwardPreset, type AdminPointsOverview, type StudentPoints, type PointsLedger } from '../services/points'
import { subjectsApi } from '../services/subjects'
import { assignmentTypesApi } from '../services/assignmentTypes'
import { useAssignmentTypes } from '../contexts/AssignmentTypesContext'
import { type AssignmentTypeConfig } from '../types/assignment'
import { termsApi } from '../services/terms'
import { usersApi } from '../services/users'
import { backupApi } from '../services/backup'
import { SystemBackupModal } from '../components/backup/SystemBackupModal'
import { type Subject } from '../types/subject'
import { type Term } from '../types/term'
import { type User } from '../types'
import { format, parseISO } from 'date-fns'
import { type TermCreate } from '../types'
import {
  LayoutDashboard, Calendar, BookOpen, Coins, BookMarked, Tag, Users,
  Key, HardDrive, AlertTriangle, Plus,
  Download, Upload, Edit2, Trash2, CheckCircle2, FileText, X,
} from 'lucide-react'

// ── Category rail ──────────────────────────────────────────────────────────
const CATS = [
  { key: 'overview',    label: 'Overview',               icon: LayoutDashboard },
  { key: 'attendance',  label: 'Attendance & compliance', icon: Calendar },
  { key: 'grading',     label: 'Grading',                  icon: BookOpen },
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
  ['A+', 97], ['A', 93], ['A-', 90],
  ['B+', 87], ['B', 83], ['B-', 80],
  ['C+', 77], ['C', 73], ['C-', 70],
  ['D+', 67], ['D', 63], ['D-', 60],
  ['F', 0],
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
  const { refresh: refreshAssignmentTypes } = useAssignmentTypes()
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

  // ── Assignment types & weighting ──
  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentTypeConfig[]>([])
  const [typesBaseline, setTypesBaseline] = useState<Record<number, AssignmentTypeConfig>>({})
  const [savingTypes, setSavingTypes] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeWeight, setNewTypeWeight] = useState('0')
  const [newTypeColor, setNewTypeColor] = useState('#3B82F6')
  const [newTypeIcon, setNewTypeIcon] = useState<string | undefined>(undefined)
  const [addingType, setAddingType] = useState(false)

  // ── Points ──
  const [pointsStatus, setPointsStatus] = useState<PointsSystemStatus | null>(null)
  const [ptsJournal, setPtsJournal] = useState(5)
  const [presets, setPresets] = useState<AwardPreset[]>([])
  const [presetLabel, setPresetLabel] = useState('')
  const [presetAmount, setPresetAmount] = useState('5')
  const [togglingPoints, setTogglingPoints] = useState(false)

  // ── Remote data ──
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // ── Term management ──
  const [showTermForm, setShowTermForm] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [termFormData, setTermFormData] = useState<TermCreate>({
    name: '', description: '', start_date: '', end_date: '',
    academic_year: '', term_type: 'semester',
  })
  const [termFilter, setTermFilter] = useState('')
  const [termValidationErrors, setTermValidationErrors] = useState<Record<string, string>>({})
  const [termError, setTermError] = useState<string | null>(null)

  // ── Subject management ──
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', color: '#3B82F6', icon: undefined as string | undefined })
  const [subjectError, setSubjectError] = useState<string | null>(null)

  // ── User management ──
  const EMPTY_NEW_USER = { first_name: '', last_name: '', email: '', username: '', password: '', role: 'student' as 'admin' | 'student', date_of_birth: '', grade_level: 1 }
  const EMPTY_EDIT_USER = { first_name: '', last_name: '', email: '', username: '', is_active: true, date_of_birth: '', grade_level: 1 }
  const [showAddUser, setShowAddUser] = useState(false)
  const [showEditUser, setShowEditUser] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER)
  const [editUser, setEditUser] = useState(EMPTY_EDIT_USER)
  const [newUserErrors, setNewUserErrors] = useState<Record<string, string>>({})
  const [editUserErrors, setEditUserErrors] = useState<Record<string, string>>({})
  const [userFilter, setUserFilter] = useState<'all' | 'students' | 'admins'>('all')
  const [userError, setUserError] = useState<string | null>(null)

  // ── API key management ──
  const apiKeysHook = useAPIKeys()
  const [showCreateKey, setShowCreateKey] = useState(false)

  // ── Points management ──
  const [pointsOverview, setPointsOverview] = useState<AdminPointsOverview | null>(null)
  const [pointsOverviewLoading, setPointsOverviewLoading] = useState(false)
  const [selectedStudentPoints, setSelectedStudentPoints] = useState<StudentPoints | null>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [ledger, setLedger] = useState<PointsLedger | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  // ── Backup management ──
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [importStep, setImportStep] = useState<'idle' | 'configure' | 'loading' | 'result'>('idle')
  const [importData, setImportData] = useState<any>(null)
  const [importOptions, setImportOptions] = useState({ skip_existing_users: true, update_existing_data: false, preserve_ids: false, dry_run: true })
  const [importResult, setImportResult] = useState<any>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const backupFileInputRef = useRef<HTMLInputElement>(null)

  const handleBackupFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!data.format_version || !data.backup_timestamp) throw new Error('Invalid backup format')
        setImportData(data)
        setImportError(null)
        setImportStep('configure')
      } catch {
        setImportError("Failed to parse backup file. Please ensure it's a valid system backup.")
      }
    }
    reader.readAsText(file)
  }

  const performImport = async () => {
    if (!importData) return
    setImportStep('loading')
    setImportError(null)
    try {
      const result = await backupApi.importSystemBackup({ backup_data: importData, import_options: importOptions })
      setImportResult(result)
      setImportStep('result')
    } catch (err: any) {
      setImportError(err.message || 'Import failed')
      setImportStep('result')
    }
  }

  const resetImport = () => {
    setImportStep('idle')
    setImportData(null)
    setImportResult(null)
    setImportError(null)
    if (backupFileInputRef.current) backupFileInputRef.current.value = ''
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [grouped, pts, presetData, journalPts, subs, trms, usrs, atypes] = await Promise.allSettled([
        settingsApi.getGroupedSettings(),
        pointsApi.getSystemStatus(),
        pointsApi.getPresets(),
        pointsApi.getJournalPoints(),
        subjectsApi.getAll(),
        termsApi.getAll(),
        usersApi.getAll(),
        assignmentTypesApi.getAll(),
      ])
      if (grouped.status === 'fulfilled') {
        const days = grouped.value.attendance.required_days_of_instruction
        setRequiredDays(days)
        setRequiredDaysDraft(String(days))
        const scale = grouped.value.grading?.scale
        if (scale && scale.length > 0) {
          setGrades(scale.map((b: GradeBand) => [b.letter, b.min_percent] as [string, number]))
        }
      }
      if (pts.status === 'fulfilled') setPointsStatus(pts.value)
      if (presetData.status === 'fulfilled') setPresets(presetData.value)
      if (journalPts.status === 'fulfilled') setPtsJournal(journalPts.value)
      if (subs.status === 'fulfilled') setSubjects(subs.value)
      if (trms.status === 'fulfilled') setTerms(trms.value)
      if (usrs.status === 'fulfilled') setUsers(usrs.value)
      if (atypes.status === 'fulfilled') {
        setAssignmentTypes(atypes.value)
        setTypesBaseline(Object.fromEntries(atypes.value.map(t => [t.id, t])))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (section === 'points' && pointsStatus?.enabled && !pointsOverview) loadPointsOverview() }, [section, pointsStatus?.enabled])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && showTermForm) resetTermForm() }
    if (showTermForm) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [showTermForm])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') resetSubjectForm() }
    if (showSubjectForm) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [showSubjectForm])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowAddUser(false); setShowEditUser(false); setEditingUser(null); setNewUserErrors({}); setEditUserErrors({}) }
    }
    if (showAddUser || showEditUser) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [showAddUser, showEditUser])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAdjustModal(false) }
    if (showAdjustModal) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [showAdjustModal])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLedgerModal(false) }
    if (showLedgerModal) { document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape) }
  }, [showLedgerModal])

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

  const addPreset = async () => {
    const l = presetLabel.trim()
    const a = parseInt(presetAmount) || 0
    if (!l || a <= 0) { toast('Enter a label and amount', 'danger'); return }
    const updated = [...presets, { label: l, amount: a }]
    setPresets(updated)
    setPresetLabel('')
    setPresetAmount('5')
    try {
      await pointsApi.setPresets(updated)
      toast('Preset added')
    } catch { toast('Preset added locally but failed to save', 'danger') }
  }

  const removePreset = async (idx: number) => {
    const updated = presets.filter((_, i) => i !== idx)
    setPresets(updated)
    try {
      await pointsApi.setPresets(updated)
    } catch { toast('Failed to remove preset', 'danger') }
  }

  const saveGradeScale = async () => {
    setSavingGrades(true)
    try {
      await settingsApi.updateGradeScale(grades.map(([letter, min_percent]) => ({ letter, min_percent })))
      toast('Grading scale saved')
    } catch {
      toast('Failed to save grading scale', 'danger')
    } finally {
      setSavingGrades(false)
    }
  }

  // ── Assignment-type handlers ────────────────────────────────────────────────
  const updateTypeField = (id: number, patch: Partial<AssignmentTypeConfig>) => {
    setAssignmentTypes(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  }

  const typesDirty = assignmentTypes.some(t => {
    const base = typesBaseline[t.id]
    return !base || base.name !== t.name || base.color !== t.color ||
      base.icon !== t.icon ||
      base.weight !== t.weight || base.is_active !== t.is_active
  })

  const saveTypes = async () => {
    const dirty = assignmentTypes.filter(t => {
      const base = typesBaseline[t.id]
      return !base || base.name !== t.name || base.color !== t.color ||
        base.icon !== t.icon ||
        base.weight !== t.weight || base.is_active !== t.is_active
    })
    if (dirty.length === 0) return
    setSavingTypes(true)
    try {
      const updated = await Promise.all(dirty.map(t =>
        assignmentTypesApi.update(t.id, {
          name: t.name, color: t.color, icon: t.icon, weight: t.weight, is_active: t.is_active,
        })
      ))
      setAssignmentTypes(prev => prev.map(t => updated.find(u => u.id === t.id) || t))
      setTypesBaseline(prev => {
        const next = { ...prev }
        updated.forEach(u => { next[u.id] = u })
        return next
      })
      refreshAssignmentTypes()
      toast('Assignment types saved')
    } catch (err: any) {
      toast(err.message || 'Failed to save assignment types', 'danger')
    } finally {
      setSavingTypes(false)
    }
  }

  const addType = async () => {
    const name = newTypeName.trim()
    if (!name) { toast('Enter a type name', 'danger'); return }
    setAddingType(true)
    try {
      const created = await assignmentTypesApi.create({
        name,
        color: newTypeColor,
        icon: newTypeIcon,
        weight: parseFloat(newTypeWeight) || 0,
        display_order: assignmentTypes.length,
      })
      setAssignmentTypes(prev => [...prev, created])
      setTypesBaseline(prev => ({ ...prev, [created.id]: created }))
      setNewTypeName('')
      setNewTypeWeight('0')
      setNewTypeColor('#3B82F6')
      setNewTypeIcon(undefined)
      refreshAssignmentTypes()
      toast('Assignment type added')
    } catch (err: any) {
      toast(err.message || 'Failed to add type', 'danger')
    } finally {
      setAddingType(false)
    }
  }

  const deleteType = async (t: AssignmentTypeConfig) => {
    if (t.usage_count > 0) {
      toast(`"${t.name}" is used by ${t.usage_count} template(s). Deactivate it instead.`, 'danger')
      return
    }
    if (!confirm(`Delete assignment type "${t.name}"?`)) return
    try {
      await assignmentTypesApi.delete(t.id)
      setAssignmentTypes(prev => prev.filter(x => x.id !== t.id))
      setTypesBaseline(prev => { const n = { ...prev }; delete n[t.id]; return n })
      refreshAssignmentTypes()
      toast('Assignment type deleted')
    } catch (err: any) {
      toast(err.message || 'Failed to delete type', 'danger')
    }
  }

  // ── Term helpers ──────────────────────────────────────────────────────────
  const formatTermDate = (s: string) => { try { return format(parseISO(s), 'MMM d, yyyy') } catch { return s } }

  const calcTermProgress = (start: string, end: string) => {
    try {
      const s = parseISO(start), e = parseISO(end), now = new Date()
      if (now < s) return { progress: 0, daysRemaining: Math.ceil((e.getTime() - s.getTime()) / 86400000) }
      if (now > e) return { progress: 100, daysRemaining: 0 }
      const total = Math.ceil((e.getTime() - s.getTime()) / 86400000)
      const elapsed = Math.ceil((now.getTime() - s.getTime()) / 86400000)
      return { progress: Math.round(Math.min(Math.max((elapsed / total) * 100, 0), 100)), daysRemaining: Math.max(Math.ceil((e.getTime() - now.getTime()) / 86400000), 0) }
    } catch { return { progress: 0, daysRemaining: 0 } }
  }

  const termTypeLabel = (t: string) => ({ semester: 'Semester', quarter: 'Quarter', trimester: 'Trimester', custom: 'Custom' }[t] || t)

  const validateTermAcademicYear = (v: string): string | null => {
    if (!v.trim()) return 'Academic year is required'
    if (/^\d{4}$/.test(v)) { const y = parseInt(v); return (y < 1900 || y > 2100) ? 'Year must be between 1900 and 2100' : null }
    if (/^\d{4}-\d{4}$/.test(v)) {
      const [a, b] = v.split('-').map(Number)
      if (a < 1900 || b > 2100) return 'Years must be between 1900 and 2100'
      if (b <= a) return 'End year must be after start year'
      if (b - a > 5) return 'Range cannot exceed 5 years'
      return null
    }
    return 'Enter a year (e.g., "2025") or range (e.g., "2025-2026")'
  }

  const resetTermForm = () => {
    const yr = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    setTermFormData({ name: '', description: '', start_date: '', end_date: '', academic_year: yr, term_type: 'semester' })
    setEditingTerm(null)
    setShowTermForm(false)
    setTermError(null)
    setTermValidationErrors({})
  }

  const openTermEdit = (term: Term) => {
    setEditingTerm(term)
    setTermFormData({ name: term.name, description: term.description || '', start_date: term.start_date, end_date: term.end_date, academic_year: term.academic_year, term_type: term.term_type })
    setShowTermForm(true)
  }

  const handleTermSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTermValidationErrors({})
    const err = validateTermAcademicYear(termFormData.academic_year)
    if (err) { setTermValidationErrors({ academic_year: err }); return }
    try {
      if (editingTerm) {
        const updated = await termsApi.update(editingTerm.id, termFormData)
        setTerms(prev => prev.map(t => t.id === editingTerm.id ? updated : t).sort((a, b) => b.start_date.localeCompare(a.start_date)))
      } else {
        const created = await termsApi.create(termFormData)
        setTerms(prev => [...prev, created].sort((a, b) => b.start_date.localeCompare(a.start_date)))
      }
      resetTermForm()
      toast(editingTerm ? 'Term updated' : 'Term created')
    } catch (err: any) {
      const detail = err.message || ''
      if (detail.toLowerCase().includes('academic year')) setTermValidationErrors({ academic_year: detail })
      else setTermError(detail || 'Failed to save term')
    }
  }

  const handleTermDelete = async (id: number) => {
    if (!confirm('Delete this term?')) return
    try {
      await termsApi.delete(id)
      setTerms(prev => prev.filter(t => t.id !== id))
      toast('Term deleted')
    } catch (err: any) { setTermError(err.message || 'Failed to delete term') }
  }

  const handleTermActivate = async (id: number) => {
    try {
      await termsApi.activate(id)
      setTerms(prev => prev.map(t => ({ ...t, is_active: t.id === id })))
      toast('Term activated')
    } catch (err: any) { setTermError(err.message || 'Failed to activate term') }
  }

  // ── Subject handlers ──────────────────────────────────────────────────────
  const resetSubjectForm = () => { setSubjectForm({ name: '', description: '', color: '#3B82F6', icon: undefined }); setEditingSubject(null); setShowSubjectForm(false); setSubjectError(null) }
  const openSubjectEdit = (s: Subject) => { setEditingSubject(s); setSubjectForm({ name: s.name, description: s.description || '', color: s.color, icon: s.icon ?? undefined }); setShowSubjectForm(true) }

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingSubject) {
        const updated = await subjectsApi.update(editingSubject.id, subjectForm)
        setSubjects(prev => prev.map(s => s.id === editingSubject.id ? updated : s))
        toast('Subject updated')
      } else {
        const created = await subjectsApi.create(subjectForm)
        setSubjects(prev => [...prev, created])
        toast('Subject created')
      }
      resetSubjectForm()
    } catch (err: any) { setSubjectError(err.message || 'Failed to save subject') }
  }

  const handleSubjectDelete = async (id: number) => {
    if (!confirm('Delete this subject? This cannot be undone.')) return
    try {
      await subjectsApi.delete(id)
      setSubjects(prev => prev.filter(s => s.id !== id))
      toast('Subject deleted')
    } catch (err: any) { setSubjectError(err.message || 'Failed to delete subject') }
  }

  // ── User handlers ─────────────────────────────────────────────────────────
  const validateNewUser = () => {
    const e: Record<string, string> = {}
    if (!newUser.first_name.trim()) e.first_name = 'Required'
    if (!newUser.last_name.trim()) e.last_name = 'Required'
    if (!newUser.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) e.email = 'Invalid email'
    if (!newUser.username.trim()) e.username = 'Required'
    if (!newUser.password) e.password = 'Required'
    else if (newUser.password.length < 6) e.password = 'At least 6 characters'
    return e
  }

  const validateEditUser = () => {
    const e: Record<string, string> = {}
    if (!editUser.first_name.trim()) e.first_name = 'Required'
    if (!editUser.last_name.trim()) e.last_name = 'Required'
    if (!editUser.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUser.email)) e.email = 'Invalid email'
    if (!editUser.username.trim()) e.username = 'Required'
    return e
  }

  const handleAddUser = async () => {
    const errors = validateNewUser()
    if (Object.keys(errors).length > 0) { setNewUserErrors(errors); return }
    try {
      await usersApi.create({
        first_name: newUser.first_name, last_name: newUser.last_name,
        email: newUser.email, username: newUser.username, password: newUser.password,
        role: newUser.role,
        ...(newUser.role === 'student' && { grade_level: newUser.grade_level, ...(newUser.date_of_birth ? { date_of_birth: newUser.date_of_birth } : {}) }),
      })
      const data = await usersApi.getAll()
      setUsers(data)
      setNewUser(EMPTY_NEW_USER)
      setNewUserErrors({})
      setShowAddUser(false)
      toast('User created')
    } catch (err: any) { setUserError(err.message || 'Failed to create user') }
  }

  const handleEditUser = async () => {
    if (!editingUser) return
    const errors = validateEditUser()
    if (Object.keys(errors).length > 0) { setEditUserErrors(errors); return }
    try {
      await usersApi.update(editingUser.id, editUser)
      const data = await usersApi.getAll()
      setUsers(data)
      setShowEditUser(false)
      setEditingUser(null)
      setEditUserErrors({})
      toast('User updated')
    } catch (err: any) { setUserError(err.message || 'Failed to update user') }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Delete this user?')) return
    try {
      await usersApi.delete(id)
      setUsers(prev => prev.filter(u => u.id !== id))
      toast('User deleted')
    } catch (err: any) { setUserError(err.message || 'Failed to delete user') }
  }

  const handleResetPassword = async (id: number, username: string) => {
    if (!confirm(`Reset password for ${username}? This will generate a temporary password.`)) return
    try {
      const r = await usersApi.resetPassword(id)
      alert(`Temporary password for ${username}: ${r.temporary_password}\n\nShare this securely and ask them to change it on next login.`)
    } catch (err: any) { setUserError(`Failed to reset password: ${err.message}`) }
  }

  const openEditUser = (u: User) => {
    setEditingUser(u)
    setEditUserErrors({})
    setEditUser({ first_name: u.first_name, last_name: u.last_name, email: u.email, username: u.username, is_active: u.is_active, date_of_birth: u.date_of_birth || '', grade_level: u.grade_level || 1 })
    setShowEditUser(true)
  }

  // ── Points management handlers ────────────────────────────────────────────
  const loadPointsOverview = async () => {
    if (!pointsStatus?.enabled) return
    try {
      setPointsOverviewLoading(true)
      const data = await pointsApi.getAdminOverview()
      setPointsOverview(data)
    } catch { /* silent */ } finally { setPointsOverviewLoading(false) }
  }

  const openAdjustModal = (s: StudentPoints) => {
    setSelectedStudentPoints(s)
    setAdjustAmount('')
    setAdjustNotes('')
    setAdjustError(null)
    setShowAdjustModal(true)
  }

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentPoints) return
    const amt = parseInt(adjustAmount)
    if (isNaN(amt) || amt === 0) { setAdjustError('Enter a non-zero point amount'); return }
    if (!adjustNotes.trim()) { setAdjustError('Reason is required'); return }
    try {
      setAdjustLoading(true)
      setAdjustError(null)
      await pointsApi.adjustPoints({ student_id: selectedStudentPoints.student_id, amount: amt, notes: adjustNotes.trim() })
      setShowAdjustModal(false)
      toast(`Points adjusted for ${selectedStudentPoints.student_name}`)
      loadPointsOverview()
    } catch (err: any) { setAdjustError(err.message || 'Failed to adjust points') }
    finally { setAdjustLoading(false) }
  }

  const openLedgerModal = async (s: StudentPoints) => {
    setSelectedStudentPoints(s)
    setLedger(null)
    setLedgerPage(1)
    setLedgerError(null)
    setShowLedgerModal(true)
    try {
      setLedgerLoading(true)
      const data = await pointsApi.getStudentLedger(s.student_id, 1, 10)
      setLedger(data)
    } catch (err: any) { setLedgerError(err.message || 'Failed to load ledger') }
    finally { setLedgerLoading(false) }
  }

  const loadLedgerPage = async (page: number) => {
    if (!selectedStudentPoints) return
    try {
      setLedgerLoading(true)
      setLedgerError(null)
      const data = await pointsApi.getStudentLedger(selectedStudentPoints.student_id, page, 10)
      setLedger(data)
      setLedgerPage(page)
    } catch (err: any) { setLedgerError(err.message || 'Failed to load ledger') }
    finally { setLedgerLoading(false) }
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
          <SectionHeader title="Grading" desc="Define letter-grade thresholds and assignment-type weighting." />
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

          {/* Assignment types & weighting */}
          {(() => {
            const activeTotal = assignmentTypes
              .filter(t => t.is_active)
              .reduce((sum, t) => sum + (Number(t.weight) || 0), 0)
            return (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-[18px] font-semibold text-ink tracking-[-0.01em]">Assignment types & weighting</h2>
                  <button
                    onClick={saveTypes}
                    disabled={!typesDirty || savingTypes}
                    className="px-4 py-2 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {savingTypes ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
                <p className="mb-4 text-[13px] text-muted">
                  Define the assignment categories used across the app and how much each counts toward grades.
                  Weights are relative — a category's share is its weight ÷ the total of all weights.
                  Leave every weight at 0 to grade purely by points earned.
                </p>

                <div className="bg-panel border border-line rounded-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">Categories</p>
                    <span className={`text-[12px] font-mono font-semibold ${activeTotal > 0 ? 'text-ink' : 'text-faint'}`}>
                      Total weight: {activeTotal % 1 === 0 ? activeTotal : activeTotal.toFixed(1)}{activeTotal > 0 ? ' · weighted' : ' · points-only'}
                    </span>
                  </div>

                  {assignmentTypes.length === 0 ? (
                    <p className="text-[13px] text-muted py-4">No assignment types yet. Add one below.</p>
                  ) : (
                    <div className="space-y-2">
                      {assignmentTypes.map(t => {
                        const share = t.is_active && activeTotal > 0 ? (Number(t.weight) || 0) / activeTotal * 100 : 0
                        return (
                          <div key={t.id} className={`flex items-center gap-3 py-1.5 ${t.is_active ? '' : 'opacity-50'}`}>
                            <input
                              type="color"
                              value={t.color}
                              onChange={e => updateTypeField(t.id, { color: e.target.value })}
                              className="w-7 h-7 rounded-field border border-field-border bg-field-bg cursor-pointer flex-shrink-0"
                              title="Category color"
                            />
                            <IconPickerButton
                              value={t.icon}
                              color={t.color}
                              onSelect={name => updateTypeField(t.id, { icon: name ?? undefined })}
                            />
                            <input
                              type="text"
                              value={t.name}
                              onChange={e => updateTypeField(t.id, { name: e.target.value })}
                              className="flex-1 min-w-0 bg-field-bg border border-field-border text-ink text-[13.5px] rounded-field px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                            />
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number" min="0" max="100" step="1"
                                value={t.weight}
                                onChange={e => updateTypeField(t.id, { weight: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                                className="w-16 bg-field-bg border border-field-border text-ink font-mono text-[13px] rounded-field px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                              />
                              <span className="w-12 text-[11px] text-faint font-mono">{share > 0 ? `${share.toFixed(0)}%` : '—'}</span>
                            </div>
                            <span className="w-20 text-[11px] text-faint text-right hidden sm:block">
                              {t.usage_count > 0 ? `${t.usage_count} in use` : 'unused'}
                            </span>
                            <Toggle checked={t.is_active} onChange={v => updateTypeField(t.id, { is_active: v })} />
                            <button
                              onClick={() => deleteType(t)}
                              className="w-7 h-7 flex items-center justify-center rounded-field text-faint hover:text-danger hover:bg-track transition-colors flex-shrink-0"
                              title={t.usage_count > 0 ? 'In use — deactivate instead' : 'Delete type'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add new type */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-line-2">
                    <input
                      type="color"
                      value={newTypeColor}
                      onChange={e => setNewTypeColor(e.target.value)}
                      className="w-7 h-7 rounded-field border border-field-border bg-field-bg cursor-pointer flex-shrink-0"
                      title="Category color"
                    />
                    <IconPickerButton
                      value={newTypeIcon}
                      color={newTypeColor}
                      onSelect={name => setNewTypeIcon(name ?? undefined)}
                    />
                    <input
                      type="text"
                      placeholder="New category name"
                      value={newTypeName}
                      onChange={e => setNewTypeName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addType() }}
                      className="flex-1 min-w-0 bg-field-bg border border-field-border text-ink text-[13.5px] rounded-field px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
                    />
                    <input
                      type="number" min="0" max="100" placeholder="Wt"
                      value={newTypeWeight}
                      onChange={e => setNewTypeWeight(e.target.value)}
                      className="w-16 bg-field-bg border border-field-border text-ink font-mono text-[13px] rounded-field px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    />
                    <button
                      onClick={addType}
                      disabled={addingType}
                      className="px-3 py-1.5 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )

      case 'points': return (
        <div className="space-y-5">
          <SectionHeader title="Points & rewards" desc={`Configure the optional gamification system. ${pointsStatus?.enabled ? 'Currently on.' : 'Currently off.'}`} />

          {/* Configuration */}
          <div className="bg-panel border border-line rounded-card divide-y divide-line-2 px-5">
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
                <button onClick={() => { const v = Math.max(0, ptsJournal - 1); setPtsJournal(v); pointsApi.setJournalPoints(v) }} className="w-7 h-7 rounded-field border border-btn-border flex items-center justify-center text-ink-2 hover:bg-track">–</button>
                <span className="w-8 text-center font-mono text-[14px] font-semibold text-ink">{ptsJournal}</span>
                <button onClick={() => { const v = ptsJournal + 1; setPtsJournal(v); pointsApi.setJournalPoints(v) }} className="w-7 h-7 rounded-field border border-btn-border flex items-center justify-center text-ink-2 hover:bg-track">+</button>
              </div>
            </SettingRow>
          </div>

          {/* Quick-award presets */}
          <div className="bg-panel border border-line rounded-card p-5">
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-3">Quick-award presets</p>
            <div className="space-y-2 mb-4">
              {presets.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[13.5px] text-ink">{p.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-pos-fg font-semibold">+{p.amount}</span>
                    <button onClick={() => removePreset(i)} className="text-faintest hover:text-danger text-[14px] leading-none">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Label" value={presetLabel} onChange={e => setPresetLabel(e.target.value)}
                className="flex-1 bg-field-bg border border-field-border text-ink text-[13px] rounded-field px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest" />
              <input type="number" placeholder="Pts" value={presetAmount} onChange={e => setPresetAmount(e.target.value)}
                className="w-16 bg-field-bg border border-field-border text-ink font-mono text-[13px] rounded-field px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
              <button onClick={addPreset} className="px-3 py-1.5 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity">Add</button>
            </div>
          </div>

          {/* Student balances */}
          {pointsStatus?.enabled && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">Student balances</p>
                <button onClick={loadPointsOverview} className="text-[12px] text-accent hover:opacity-80 transition-opacity">Refresh</button>
              </div>

              {pointsOverviewLoading ? (
                <div className="flex items-center justify-center py-10"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
              ) : !pointsOverview ? (
                <div className="bg-panel border border-line rounded-card p-8 text-center">
                  <p className="text-[13px] text-muted mb-3">Load student balances to view and adjust points.</p>
                  <button onClick={loadPointsOverview} className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13px] font-semibold hover:opacity-90 transition-opacity">Load balances</button>
                </div>
              ) : (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Students', value: String(pointsOverview.total_students), sub: `${pointsOverview.total_students_with_points} with points` },
                      { label: 'Total Awarded', value: pointsOverview.total_points_awarded.toLocaleString() },
                      { label: 'Total Spent', value: pointsOverview.total_points_spent.toLocaleString() },
                    ].map(t => (
                      <div key={t.label} className="bg-panel-2 border border-line rounded-card p-4">
                        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">{t.label}</p>
                        <p className="font-mono text-[18px] font-semibold text-ink">{t.value}</p>
                        {t.sub && <p className="text-[11px] text-faint mt-0.5">{t.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-card border border-line">
                    <table className="min-w-full divide-y divide-line">
                      <thead className="bg-panel-2">
                        <tr>
                          {['Student', 'Balance', 'Earned', 'Spent', ''].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-panel divide-y divide-line">
                        {pointsOverview.student_points.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] text-muted">No students with points yet.</td></tr>
                        ) : pointsOverview.student_points.map(sp => (
                          <tr key={sp.id} className="hover:bg-panel-2 transition-colors">
                            <td className="px-5 py-3.5 text-[13.5px] font-semibold text-ink whitespace-nowrap">{sp.student_name}</td>
                            <td className="px-5 py-3.5 font-mono text-[13.5px] font-semibold text-ink whitespace-nowrap">{sp.current_balance.toLocaleString()}</td>
                            <td className="px-5 py-3.5 font-mono text-[13px] text-pos-fg whitespace-nowrap">+{sp.total_earned.toLocaleString()}</td>
                            <td className="px-5 py-3.5 font-mono text-[13px] text-neg-fg whitespace-nowrap">−{sp.total_spent.toLocaleString()}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button onClick={() => openAdjustModal(sp)} className="h-7 px-2.5 rounded-field text-[12px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity flex items-center gap-1">
                                  <Plus className="w-3 h-3" /> Adjust
                                </button>
                                <button onClick={() => openLedgerModal(sp)} className="h-7 px-2.5 rounded-field text-[12px] font-medium text-muted hover:text-ink hover:bg-track transition-colors">
                                  Ledger
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Adjust points modal */}
          {showAdjustModal && selectedStudentPoints && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
              <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">Adjust Points</h3>
                    <p className="text-[12px] text-muted mt-0.5">{selectedStudentPoints.student_name} · {selectedStudentPoints.current_balance.toLocaleString()} current balance</p>
                  </div>
                  <button onClick={() => setShowAdjustModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={handleAdjustSubmit} className="flex flex-col">
                  <div className="px-6 py-5 space-y-4">
                    {adjustError && <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{adjustError}</div>}
                    <div>
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Point Adjustment <span className="text-neg-fg normal-case">*</span></label>
                      <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="Positive to add, negative to deduct"
                        className="bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full" autoFocus />
                      <p className="mt-1.5 text-[12px] text-faint">Use positive to award, negative to deduct</p>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Reason <span className="text-neg-fg normal-case">*</span></label>
                      <textarea value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} rows={3} placeholder="Explain the reason for this adjustment…"
                        className="bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-panel-2">
                    <button type="button" onClick={() => setShowAdjustModal(false)} disabled={adjustLoading} className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={adjustLoading} className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
                      {adjustLoading ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Saving…</> : 'Save Adjustment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Ledger modal */}
          {showLedgerModal && selectedStudentPoints && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">Points Ledger</h3>
                    <p className="text-[12px] text-muted mt-0.5">{selectedStudentPoints.student_name} · {selectedStudentPoints.current_balance.toLocaleString()} balance</p>
                  </div>
                  <button onClick={() => setShowLedgerModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {ledgerLoading && !ledger ? (
                    <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                  ) : ledgerError ? (
                    <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{ledgerError}</div>
                  ) : ledger ? (
                    <>
                      {/* Summary tiles */}
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        {[
                          { label: 'Balance', value: ledger.student_points.current_balance.toLocaleString(), color: 'text-ink' },
                          { label: 'Total Earned', value: `+${ledger.student_points.total_earned.toLocaleString()}`, color: 'text-pos-fg' },
                          { label: 'Total Spent', value: `−${ledger.student_points.total_spent.toLocaleString()}`, color: 'text-neg-fg' },
                        ].map(t => (
                          <div key={t.label} className="bg-panel-2 border border-line rounded-field p-3 text-center">
                            <p className={`font-mono text-[16px] font-semibold ${t.color}`}>{t.value}</p>
                            <p className="text-[11px] text-faint mt-0.5">{t.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Transactions */}
                      {ledger.transactions.length === 0 ? (
                        <p className="text-center text-[13px] text-muted py-8">No transactions yet.</p>
                      ) : (
                        <div className="divide-y divide-line border border-line rounded-card overflow-hidden">
                          {ledger.transactions.map(tx => {
                            const isPos = tx.amount >= 0
                            return (
                              <div key={tx.id} className="flex items-center justify-between px-4 py-3 bg-panel hover:bg-panel-2 transition-colors">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium text-ink">{tx.source_description || 'Points Transaction'}</p>
                                  {tx.notes && <p className="text-[12px] text-muted mt-0.5">{tx.notes}</p>}
                                  <p className="text-[11.5px] text-faint mt-0.5">
                                    {new Date(tx.created_at).toLocaleString()}{tx.admin_name ? ` · ${tx.admin_name}` : ''}
                                  </p>
                                </div>
                                <span className={`font-mono text-[14px] font-semibold ml-4 flex-shrink-0 ${isPos ? 'text-pos-fg' : 'text-neg-fg'}`}>
                                  {isPos ? '+' : '−'}{Math.abs(tx.amount).toLocaleString()}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Pagination */}
                      {ledger.total_pages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-[12px] text-faint">Page {ledgerPage} of {ledger.total_pages}</p>
                          <div className="flex gap-2">
                            <button onClick={() => loadLedgerPage(ledgerPage - 1)} disabled={ledgerPage === 1 || ledgerLoading}
                              className="h-[30px] px-3 rounded-field border border-line text-[12px] font-medium text-muted hover:text-ink hover:bg-track transition-colors disabled:opacity-40">← Prev</button>
                            <button onClick={() => loadLedgerPage(ledgerPage + 1)} disabled={ledgerPage === ledger.total_pages || ledgerLoading}
                              className="h-[30px] px-3 rounded-field border border-line text-[12px] font-medium text-muted hover:text-ink hover:bg-track transition-colors disabled:opacity-40">Next →</button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-panel-2">
                  <button onClick={() => openAdjustModal(selectedStudentPoints)} className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" /> Adjust Points
                  </button>
                  <button onClick={() => setShowLedgerModal(false)} className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )

      case 'terms': {
        const TFIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
        const TLABEL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-semibold text-ink tracking-[-0.01em]">Terms & calendar</h2>
                <p className="mt-0.5 text-[13px] text-muted">Manage academic terms and grading periods.</p>
              </div>
              <button
                onClick={() => setShowTermForm(true)}
                className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Term
              </button>
            </div>

            <div className="mb-6">
              <input
                type="text"
                placeholder="Filter terms…"
                value={termFilter}
                onChange={e => setTermFilter(e.target.value)}
                className="w-full max-w-xs bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
              />
            </div>

            {termError && <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px] mb-4">{termError}</div>}

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : terms.length === 0 ? (
              <div className="bg-panel border border-line rounded-card-lg flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-12 h-12 rounded-full bg-track flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-faint" />
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-semibold text-ink">No academic terms yet</p>
                  <p className="text-[13px] text-muted mt-1">Create a term to start organizing your curriculum</p>
                </div>
                <button
                  onClick={() => setShowTermForm(true)}
                  className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create First Term
                </button>
              </div>
            ) : (() => {
              const q = termFilter.trim().toLowerCase()
              const filtered = q
                ? terms.filter(t => t.name.toLowerCase().includes(q) || t.academic_year.toLowerCase().includes(q))
                : terms
              if (filtered.length === 0) return (
                <p className="text-[13px] text-muted py-8 text-center">No terms match "{termFilter}"</p>
              )
              return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(term => {
                  const { progress, daysRemaining } = calcTermProgress(term.start_date, term.end_date)
                  return (
                    <div key={term.id} className={`bg-panel border rounded-card-lg overflow-hidden flex flex-col transition-shadow hover:shadow-md ${term.is_active ? 'border-accent/40' : 'border-line'}`}>
                      <div className={`px-5 py-4 ${term.is_active ? 'bg-accent/8' : 'bg-panel-2'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="text-[15px] font-semibold text-ink truncate">{term.name}</h3>
                              {term.is_active && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-pos-bg text-pos-fg">
                                  <CheckCircle2 className="w-3 h-3" /> Active
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-muted">{term.academic_year} · {termTypeLabel(term.term_type)}</p>
                          </div>
                        </div>
                      </div>

                      {term.is_active && (
                        <div className="h-1 bg-track">
                          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                      )}

                      <div className="px-5 py-4 flex-1 flex flex-col gap-3">
                        {term.description && <p className="text-[13px] text-muted leading-relaxed">{term.description}</p>}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[13px]">
                            <Calendar className="w-3.5 h-3.5 text-faint shrink-0" />
                            <span className="text-ink">{formatTermDate(term.start_date)} – {formatTermDate(term.end_date)}</span>
                          </div>
                          {term.is_active && (
                            <p className="text-[12px] text-muted pl-5">{progress}% complete · {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-auto border-t border-line">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => navigate('/reports')}
                              className="h-7 px-2.5 rounded-field text-[12px] font-semibold text-muted hover:text-ink hover:bg-track transition-colors flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" /> Reports
                            </button>
                            {!term.is_active && (
                              <button
                                onClick={() => handleTermActivate(term.id)}
                                className="h-7 px-2.5 rounded-field text-[12px] font-semibold text-pos-fg bg-pos-bg hover:opacity-80 transition-opacity flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => openTermEdit(term)}
                              className="w-7 h-7 flex items-center justify-center rounded-field text-faint hover:text-ink hover:bg-track transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleTermDelete(term.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-field text-faint hover:text-neg-fg hover:bg-neg-bg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              )
            })()}

            {/* Term form modal */}
            {showTermForm && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{editingTerm ? 'Edit Term' : 'New Term'}</h3>
                      <p className="text-[12px] text-muted mt-0.5">{editingTerm ? 'Update term details' : 'Add a new academic term'}</p>
                    </div>
                    <button onClick={resetTermForm} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleTermSubmit} className="flex flex-col">
                    <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
                      <div>
                        <label className={TLABEL}>Name <span className="text-neg-fg normal-case">*</span></label>
                        <input type="text" required autoFocus value={termFormData.name} onChange={e => setTermFormData(p => ({ ...p, name: e.target.value }))} className={TFIELD} placeholder="e.g., Fall 2025" />
                      </div>
                      <div>
                        <label className={TLABEL}>Description</label>
                        <textarea value={termFormData.description} onChange={e => setTermFormData(p => ({ ...p, description: e.target.value }))} className={TFIELD} rows={2} placeholder="Optional description" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={TLABEL}>Start Date <span className="text-neg-fg normal-case">*</span></label>
                          <input type="date" required value={termFormData.start_date} onChange={e => setTermFormData(p => ({ ...p, start_date: e.target.value }))} className={TFIELD} />
                        </div>
                        <div>
                          <label className={TLABEL}>End Date <span className="text-neg-fg normal-case">*</span></label>
                          <input type="date" required value={termFormData.end_date} onChange={e => setTermFormData(p => ({ ...p, end_date: e.target.value }))} className={TFIELD} />
                        </div>
                      </div>
                      <div>
                        <label className={TLABEL}>Academic Year <span className="text-neg-fg normal-case">*</span></label>
                        <input
                          type="text" required value={termFormData.academic_year}
                          onChange={e => {
                            const v = e.target.value
                            setTermFormData(p => ({ ...p, academic_year: v }))
                            if (termValidationErrors.academic_year) setTermValidationErrors(p => ({ ...p, academic_year: '' }))
                          }}
                          className={termValidationErrors.academic_year ? TFIELD.replace('border-field-border', 'border-[var(--neg-fg)]') : TFIELD}
                          placeholder='e.g., 2025 or 2025-2026'
                        />
                        {termValidationErrors.academic_year
                          ? <p className="mt-1.5 text-[12px] text-neg-fg">{termValidationErrors.academic_year}</p>
                          : <p className="mt-1.5 text-[12px] text-faint">Single year (e.g., "2025") or range (e.g., "2025-2026")</p>
                        }
                      </div>
                      <div>
                        <label className={TLABEL}>Term Type</label>
                        <select value={termFormData.term_type} onChange={e => setTermFormData(p => ({ ...p, term_type: e.target.value as any }))} className={TFIELD}>
                          <option value="semester">Semester</option>
                          <option value="quarter">Quarter</option>
                          <option value="trimester">Trimester</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-panel-2">
                      <button type="button" onClick={resetTermForm} className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors">Cancel</button>
                      <button type="submit" className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity">
                        {editingTerm ? 'Save Changes' : 'Create Term'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'subjects': {
        const SF = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
        const SL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[18px] font-semibold text-ink tracking-[-0.01em]">Subjects</h2>
                <p className="mt-0.5 text-[13px] text-muted">Set up the subjects used across assignments and reports.</p>
              </div>
              <button onClick={() => setShowSubjectForm(true)} className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Subject
              </button>
            </div>

            {subjectError && <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px] mb-4">{subjectError}</div>}

            {loading ? (
              <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : subjects.length === 0 ? (
              <div className="bg-panel border border-line rounded-card-lg flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-12 h-12 rounded-full bg-track flex items-center justify-center">
                  <Tag className="w-6 h-6 text-faint" />
                </div>
                <div className="text-center">
                  <p className="text-[15px] font-semibold text-ink">No subjects yet</p>
                  <p className="text-[13px] text-muted mt-1">Add subjects to organize your curriculum</p>
                </div>
                <button onClick={() => setShowSubjectForm(true)} className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add First Subject
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map(s => (
                  <div key={s.id} className="bg-panel border border-line rounded-card-lg overflow-hidden hover:border-accent/30 transition-colors">
                    <div className="h-1" style={{ backgroundColor: s.color }} />
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.color + '22' }}>
                          <Icon name={s.icon} size={16} color={s.color} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-ink truncate">{s.name}</p>
                          {s.description && <p className="text-[12px] text-muted truncate">{s.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                        <button onClick={() => openSubjectEdit(s)} className="w-7 h-7 flex items-center justify-center rounded-field text-faint hover:text-ink hover:bg-track transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleSubjectDelete(s.id)} className="w-7 h-7 flex items-center justify-center rounded-field text-faint hover:text-neg-fg hover:bg-neg-bg transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showSubjectForm && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                <div className="bg-panel border border-line rounded-card-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{editingSubject ? 'Edit Subject' : 'New Subject'}</h3>
                      <p className="text-[12px] text-muted mt-0.5">{editingSubject ? 'Update subject details' : 'Add a new subject'}</p>
                    </div>
                    <button onClick={resetSubjectForm} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <form onSubmit={handleSubjectSubmit} className="flex flex-col">
                    <div className="px-6 py-5 space-y-4">
                      <div>
                        <label className={SL}>Name <span className="text-neg-fg normal-case">*</span></label>
                        <input type="text" required autoFocus value={subjectForm.name} onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))} className={SF} placeholder="e.g., Mathematics" />
                      </div>
                      <div>
                        <label className={SL}>Description</label>
                        <textarea value={subjectForm.description} onChange={e => setSubjectForm(p => ({ ...p, description: e.target.value }))} className={SF} rows={2} placeholder="Optional description" />
                      </div>
                      <div>
                        <label className={SL}>Color</label>
                        <div className="flex items-center gap-3">
                          <input type="color" value={subjectForm.color} onChange={e => setSubjectForm(p => ({ ...p, color: e.target.value }))} className="h-9 w-16 rounded-field border border-field-border cursor-pointer bg-field-bg p-0.5" />
                          <input type="text" value={subjectForm.color} onChange={e => setSubjectForm(p => ({ ...p, color: e.target.value }))} className={SF} placeholder="#3B82F6" />
                        </div>
                      </div>
                      <div>
                        <label className={SL}>Icon</label>
                        <div className="flex items-center gap-3">
                          <IconPickerButton
                            value={subjectForm.icon}
                            color={subjectForm.color}
                            onSelect={name => setSubjectForm(p => ({ ...p, icon: name ?? undefined }))}
                          />
                          {subjectForm.icon && (
                            <span className="text-[12px] text-muted">{subjectForm.icon}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line bg-panel-2">
                      <button type="button" onClick={resetSubjectForm} className="h-[34px] px-4 text-[13px] font-semibold text-muted hover:text-ink transition-colors">Cancel</button>
                      <button type="submit" className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity">{editingSubject ? 'Save Changes' : 'Create Subject'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'users': {
        const filteredUsers = users.filter(u => userFilter === 'students' ? u.role === 'student' : userFilter === 'admins' ? u.role === 'admin' : true)
        const filterOptions = [
          { label: `All (${users.length})`, value: 'all' },
          { label: `Students (${users.filter(u => u.role === 'student').length})`, value: 'students' },
          { label: `Admins (${users.filter(u => u.role === 'admin').length})`, value: 'admins' },
        ]
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[18px] font-semibold text-ink tracking-[-0.01em]">Users & access</h2>
                <p className="mt-0.5 text-[13px] text-muted">Manage administrators and students.</p>
              </div>
              <Button icon={<Plus size={14} />} onClick={() => setShowAddUser(true)}>Add User</Button>
            </div>

            {userError && <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px] mb-4">{userError}</div>}

            <div className="mb-4">
              <SegmentedControl segments={filterOptions} value={userFilter} onChange={v => setUserFilter(v as any)} />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto rounded-card border border-line">
                <table className="min-w-full divide-y divide-line">
                  <thead className="bg-panel-2">
                    <tr>
                      {['Name', 'Email', 'Username', 'Role', 'Grade', 'Status', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-panel divide-y divide-line">
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-10 text-center text-[13px] text-muted">No users found.</td></tr>
                    ) : filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-panel-2 transition-colors duration-100">
                        <td className="px-5 py-3.5 text-[13.5px] font-semibold text-ink whitespace-nowrap">{u.first_name} {u.last_name}</td>
                        <td className="px-5 py-3.5 text-[13.5px] text-ink-2 whitespace-nowrap">{u.email}</td>
                        <td className="px-5 py-3.5 text-[13.5px] text-ink-2 whitespace-nowrap font-mono">{u.username}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap"><Pill variant={u.role === 'admin' ? 'sub' : 'info'}>{u.role === 'admin' ? 'Admin' : 'Student'}</Pill></td>
                        <td className="px-5 py-3.5 text-[13.5px] text-ink-2 whitespace-nowrap">{u.role === 'student' && u.grade_level ? `Grade ${u.grade_level}` : '—'}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap"><Pill variant={u.is_active ? 'pos' : 'neg'}>{u.is_active ? 'Active' : 'Inactive'}</Pill></td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditUser(u)} className="text-muted hover:text-ink transition-colors" title="Edit"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleResetPassword(u.id, u.username)} className="text-muted hover:text-sub-fg transition-colors" title="Reset password"><Key className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteUser(u.id)} className="text-muted hover:text-neg-fg transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {showAddUser && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-panel border border-line rounded-card-lg shadow-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">Add New User</h3>
                      <p className="text-[12px] text-muted mt-0.5">Create an administrator or student account</p>
                    </div>
                    <button onClick={() => { setShowAddUser(false); setNewUserErrors({}) }} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="First Name" required value={newUser.first_name} error={newUserErrors.first_name} onChange={e => { setNewUser(p => ({ ...p, first_name: e.target.value })); setNewUserErrors(p => ({ ...p, first_name: '' })) }} />
                      <Input label="Last Name" required value={newUser.last_name} error={newUserErrors.last_name} onChange={e => { setNewUser(p => ({ ...p, last_name: e.target.value })); setNewUserErrors(p => ({ ...p, last_name: '' })) }} />
                    </div>
                    <Input label="Email" type="email" required value={newUser.email} error={newUserErrors.email} onChange={e => { setNewUser(p => ({ ...p, email: e.target.value })); setNewUserErrors(p => ({ ...p, email: '' })) }} />
                    <Input label="Username" required value={newUser.username} error={newUserErrors.username} onChange={e => { setNewUser(p => ({ ...p, username: e.target.value })); setNewUserErrors(p => ({ ...p, username: '' })) }} />
                    <Input label="Password" type="password" required value={newUser.password} error={newUserErrors.password} onChange={e => { setNewUser(p => ({ ...p, password: e.target.value })); setNewUserErrors(p => ({ ...p, password: '' })) }} />
                    <Select label="Role" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value as any }))} options={[{ value: 'student', label: 'Student' }, { value: 'admin', label: 'Administrator' }]} />
                    {newUser.role === 'student' && (
                      <>
                        <Input label="Date of Birth" type="date" value={newUser.date_of_birth} onChange={e => setNewUser(p => ({ ...p, date_of_birth: e.target.value }))} />
                        <Input label="Grade Level" type="number" value={String(newUser.grade_level)} onChange={e => setNewUser(p => ({ ...p, grade_level: parseInt(e.target.value) || 1 }))} />
                      </>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-line bg-panel-2 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => { setShowAddUser(false); setNewUserErrors({}) }}>Cancel</Button>
                    <Button onClick={handleAddUser}>Add User</Button>
                  </div>
                </div>
              </div>
            )}

            {showEditUser && editingUser && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-panel border border-line rounded-card-lg shadow-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-line flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">Edit User</h3>
                      <p className="text-[12px] text-muted mt-0.5">{editingUser.first_name} {editingUser.last_name}</p>
                    </div>
                    <button onClick={() => { setShowEditUser(false); setEditingUser(null); setEditUserErrors({}) }} className="w-7 h-7 flex items-center justify-center rounded-full text-faint hover:text-ink hover:bg-track transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="First Name" required value={editUser.first_name} error={editUserErrors.first_name} onChange={e => { setEditUser(p => ({ ...p, first_name: e.target.value })); setEditUserErrors(p => ({ ...p, first_name: '' })) }} />
                      <Input label="Last Name" required value={editUser.last_name} error={editUserErrors.last_name} onChange={e => { setEditUser(p => ({ ...p, last_name: e.target.value })); setEditUserErrors(p => ({ ...p, last_name: '' })) }} />
                    </div>
                    <Input label="Email" type="email" required value={editUser.email} error={editUserErrors.email} onChange={e => { setEditUser(p => ({ ...p, email: e.target.value })); setEditUserErrors(p => ({ ...p, email: '' })) }} />
                    <Input label="Username" required value={editUser.username} error={editUserErrors.username} onChange={e => { setEditUser(p => ({ ...p, username: e.target.value })); setEditUserErrors(p => ({ ...p, username: '' })) }} />
                    <Select label="Status" value={editUser.is_active ? 'active' : 'inactive'} onChange={e => setEditUser(p => ({ ...p, is_active: e.target.value === 'active' }))} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
                    {editingUser.role === 'student' && (
                      <>
                        <Input label="Date of Birth" type="date" value={editUser.date_of_birth} onChange={e => setEditUser(p => ({ ...p, date_of_birth: e.target.value }))} />
                        <Input label="Grade Level" type="number" value={String(editUser.grade_level)} onChange={e => setEditUser(p => ({ ...p, grade_level: parseInt(e.target.value) || 1 }))} />
                      </>
                    )}
                  </div>
                  <div className="px-6 py-4 border-t border-line bg-panel-2 flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => { setShowEditUser(false); setEditingUser(null); setEditUserErrors({}) }}>Cancel</Button>
                    <Button onClick={handleEditUser}>Save Changes</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'api': return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[18px] font-semibold text-ink tracking-[-0.01em]">Integrations & API</h2>
              <p className="mt-0.5 text-[13px] text-muted">Connect external tools with secure API keys.</p>
            </div>
            <button onClick={() => setShowCreateKey(true)} className="h-[34px] px-4 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13.5px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create API Key
            </button>
          </div>
          <div className="flex items-start gap-2.5 bg-sub-bg border border-sub-fg/20 rounded-card p-4 mb-5 text-[13px] text-sub-fg">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>API keys grant direct access to student data. Only create keys for trusted applications and review their scope.</span>
          </div>
          <ErrorBoundary>
            <APIKeyTable
              apiKeys={apiKeysHook.apiKeys}
              expandedStats={apiKeysHook.expandedStats}
              onToggleStatsExpanded={apiKeysHook.toggleStatsExpanded}
              onToggleActive={apiKeysHook.toggleAPIKeyActive}
              onDelete={apiKeysHook.deleteAPIKey}
              refreshing={apiKeysHook.refreshing}
              autoRefresh={apiKeysHook.autoRefresh}
              onToggleAutoRefresh={apiKeysHook.toggleAutoRefresh}
              lastRefresh={apiKeysHook.lastRefresh}
              onRefresh={apiKeysHook.refreshData}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <CreateAPIKeyModal
              isOpen={showCreateKey}
              onClose={() => setShowCreateKey(false)}
              onSuccess={() => { setShowCreateKey(false); apiKeysHook.refreshData() }}
              error={apiKeysHook.error}
              setError={apiKeysHook.setError}
            />
          </ErrorBoundary>
        </div>
      )

      case 'backup': return (
        <div>
          <SectionHeader title="Backup & export" desc="Export or restore your complete homeschool data." />
          <div className="space-y-3">
            {/* Export */}
            <div className="bg-panel border border-line rounded-card p-5">
              <p className="text-[13.5px] font-semibold text-ink mb-1">Export all data</p>
              <p className="text-[12px] text-muted mb-4">Download a complete backup — students, assignments, grades, attendance, and journals — as a single file.</p>
              <button
                onClick={() => setShowBackupModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-field text-[13px] font-semibold bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity"
              >
                <Download size={14} /> Export backup
              </button>
            </div>

            {/* Import */}
            <div className="bg-panel border border-line rounded-card p-5">
              <p className="text-[13.5px] font-semibold text-ink mb-1">Restore from backup</p>
              <p className="text-[12px] text-muted mb-4">Import a previously exported file. This merges into existing data — export first to be safe.</p>

              {importStep === 'idle' && (
                <>
                  {importError && (
                    <div className="flex items-center gap-2 bg-neg-bg border border-neg-fg/20 rounded-card p-3 mb-4 text-[12px] text-neg-fg">
                      <AlertTriangle size={13} className="flex-shrink-0" />
                      {importError}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-field text-[13px] font-semibold bg-panel border border-line text-ink hover:bg-panel-2 transition-colors cursor-pointer">
                    <Upload size={14} /> Choose file…
                    <input ref={backupFileInputRef} type="file" accept=".json" onChange={handleBackupFileUpload} className="hidden" />
                  </label>
                </>
              )}

              {importStep === 'configure' && importData && (
                <div className="space-y-4">
                  {/* Backup summary */}
                  <div className="bg-panel-2 border border-line rounded-card p-3 text-[12px] text-muted grid grid-cols-2 gap-2">
                    <span>{importData.system_info?.total_users || 0} users</span>
                    <span>{importData.system_info?.total_subjects || 0} subjects</span>
                    <span>{importData.system_info?.total_assignment_templates || 0} templates</span>
                    <span>Backed up {new Date(importData.backup_timestamp).toLocaleDateString()}</span>
                    <span className="col-span-2 text-faint">Created by: {importData.created_by}</span>
                  </div>
                  {/* Options */}
                  <div className="space-y-2">
                    {([
                      { key: 'dry_run' as const, label: 'Dry run (preview only — no changes made)' },
                      { key: 'skip_existing_users' as const, label: 'Skip existing users (recommended)' },
                      { key: 'update_existing_data' as const, label: 'Update existing records' },
                    ]).map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-[13px] text-ink">
                        <input
                          type="checkbox"
                          checked={importOptions[key]}
                          onChange={(e) => setImportOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="h-3.5 w-3.5 accent-[var(--accent)] rounded"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={resetImport} className="h-[34px] px-4 rounded-field text-[13px] font-medium border border-line text-muted hover:bg-panel-2 transition-colors">Cancel</button>
                    <button onClick={performImport} className="h-[34px] px-4 rounded-field text-[13px] font-medium bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity">
                      {importOptions.dry_run ? 'Preview import' : 'Import data'}
                    </button>
                  </div>
                </div>
              )}

              {importStep === 'loading' && (
                <div className="flex items-center gap-2 py-4 text-[13px] text-muted">
                  <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
                  {importOptions.dry_run ? 'Previewing import…' : 'Importing data…'}
                </div>
              )}

              {importStep === 'result' && (
                <div className="space-y-3">
                  {importError ? (
                    <div className="flex items-start gap-2 bg-neg-bg border border-neg-fg/20 rounded-card p-4 text-[13px] text-neg-fg">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <div><p className="font-semibold mb-1">Import failed</p><p>{importError}</p></div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink mb-3">
                        <CheckCircle2 size={15} className="text-pos-fg" />
                        {importResult?.dry_run ? 'Preview complete' : 'Import successful'}
                      </div>
                      {importResult?.imported_counts && (
                        <div className="bg-panel-2 border border-line rounded-card p-3 text-[12px] text-muted grid grid-cols-2 gap-1 mb-3">
                          {Object.entries(importResult.imported_counts).map(([k, v]) => (
                            <div key={k}>{importResult.dry_run ? 'Would import' : 'Imported'} {k}: {v as number}</div>
                          ))}
                        </div>
                      )}
                      {importResult?.warnings?.length > 0 && (
                        <div className="bg-panel-2 border border-line rounded-card p-3 text-[11px] text-muted mb-3">
                          {importResult.warnings.slice(0, 3).map((w: string, i: number) => <div key={i}>• {w}</div>)}
                          {importResult.warnings.length > 3 && <div>…and {importResult.warnings.length - 3} more</div>}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={resetImport} className="h-[34px] px-4 rounded-field text-[13px] font-medium border border-line text-muted hover:bg-panel-2 transition-colors">
                      {importResult?.dry_run && !importError ? 'Cancel' : 'Done'}
                    </button>
                    {importResult?.dry_run && !importError && (
                      <button
                        onClick={() => { setImportOptions(prev => ({ ...prev, dry_run: false })); setImportStep('configure'); setImportResult(null) }}
                        className="h-[34px] px-4 rounded-field text-[13px] font-medium bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity"
                      >
                        Import for real
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {showBackupModal && (
            <SystemBackupModal
              isOpen={showBackupModal}
              onClose={() => setShowBackupModal(false)}
              onExport={() => backupApi.exportSystemBackup()}
            />
          )}
        </div>
      )

      default: return null
    }
  }

  return (
    <div className="flex -m-7 h-screen">
      {/* Category rail */}
      <nav className="w-[230px] flex-none bg-panel-2 border-r border-line py-[22px] px-[14px] no-print">
        <p className="text-[12px] font-semibold text-faint uppercase tracking-[.08em] px-2 mb-3">Settings</p>
        <div className="flex flex-col gap-0.5">
          {CATS.map(({ key, label }) => {
            const active = section === key
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`w-full text-left px-3 py-[9px] rounded-[9px] text-[13px] transition-colors duration-100 ${
                  active ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-2 font-medium hover:bg-track hover:text-ink'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Content panel */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-[760px] mx-auto px-9 py-[30px] pb-[90px]">
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

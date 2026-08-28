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
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'
import { getErrorMessage } from '../services/api'
import { termsApi } from '../services/terms'
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'
import { Pill, statusToPillVariant, SubjectDot, useToast, ActionMenu } from '../components/ui'
import type { ActionMenuEntry } from '../components/ui'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import StudentAssignmentsView from '../components/assignments/StudentAssignmentsView'
import AssignmentComposer from '../components/assignments/composer/AssignmentComposer'
import { ComposerMode } from '../components/assignments/composer/composerLogic'
import { AssignmentInfo, SubmissionCard } from '../components/assignments/AssignmentInfo'
import AssignedAssignmentEditor from '../components/assignments/AssignedAssignmentEditor'
import { StudentAssignment, Term } from '../types'
import { formatDateOnly } from '../utils/formatters'
import { isOverdue } from '../utils/assignmentStatus'
import { letterGrade } from '../utils/grading'

type StatusFilter = 'all' | 'open' | 'to_grade' | 'graded' | 'excused'

const Assignments: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const templateFilter = searchParams.get('template') ? parseInt(searchParams.get('template')!) : null

  // ── Filters ──
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  // undefined = not yet initialized (will default to active term); null = user explicitly chose "All terms"
  const [selectedTerm, setSelectedTerm] = useState<number | null | undefined>(undefined)
  const {
    searchTerm,
    setSearchTerm,
    selectedSubject,
    setSelectedSubject,
    selectedStudent,
    setSelectedStudent,
  } = useAssignmentFilters()

  // ── Data (admin only; StudentAssignmentsView owns the student fetch) ──
  const {
    allAssignments,
    subjects,
    students,
    loading,
    error,
    refetch,
  } = useAssignments({ isAdmin, adminViewMode: 'grading', selectedSubject, enabled: isAdmin })

  // Terms are admin-only and have no hook equivalent — loaded locally
  const [terms, setTerms] = useState<Term[]>([])

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // ── Bulk action state ──
  const [bulkLoading, setBulkLoading] = useState(false)

  // ── Modals ──
  const [composer, setComposer] = useState<ComposerMode | null>(null)
  const [unassigningAssignment, setUnassigningAssignment] = useState<StudentAssignment | null>(null)
  const [unassignLoading, setUnassignLoading] = useState(false)
  const [showBulkUnassignConfirm, setShowBulkUnassignConfirm] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<StudentAssignment | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    termsApi.getAll()
      .then(termsData => {
        setTerms(termsData || [])
        // Default to active term on first load (undefined = not yet set)
        const activeTerm = termsData?.find(t => t.is_active)
        if (activeTerm) setSelectedTerm(prev => (prev === undefined ? activeTerm.id : prev))
      })
      .catch(() => {})
  }, [isAdmin])

  const getSubjectById = (id: number) => subjects.find(s => s.id === id)

  // ── Filter logic ──
  const filteredAssignments = allAssignments.filter(a => {
    const stu = students.find(s => s.id === a.student_id)
    const stuName = stu ? `${stu.first_name} ${stu.last_name}`.toLowerCase() : ''
    const tplName = a.template?.name?.toLowerCase() ?? ''

    if (searchTerm && !stuName.includes(searchTerm.toLowerCase()) && !tplName.includes(searchTerm.toLowerCase())) return false
    if (selectedStudent && a.student_id !== selectedStudent) return false
    if (selectedSubject && a.template?.subject_id !== selectedSubject) return false
    if (templateFilter && a.template_id !== templateFilter) return false
    if (selectedTerm) {
      const term = terms.find(t => t.id === selectedTerm)
      if (term && a.assigned_date) {
        if (a.assigned_date < term.start_date || a.assigned_date > term.end_date) return false
      }
    }

    switch (statusFilter) {
      case 'open': return a.status === 'not_started' || a.status === 'in_progress' || isOverdue(a)
      case 'to_grade': return a.status === 'submitted' && !a.is_graded
      case 'graded': return a.is_graded || a.status === 'graded'
      case 'excused': return a.status === 'excused'
      default: return true
    }
  })

  // Sort by due date ascending (null last)
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })

  // Status tab counts (across all assignments, ignoring status filter but respecting other filters)
  const baseFiltered = allAssignments.filter(a => {
    const stu = students.find(s => s.id === a.student_id)
    const stuName = stu ? `${stu.first_name} ${stu.last_name}`.toLowerCase() : ''
    const tplName = a.template?.name?.toLowerCase() ?? ''
    if (searchTerm && !stuName.includes(searchTerm.toLowerCase()) && !tplName.includes(searchTerm.toLowerCase())) return false
    if (selectedStudent && a.student_id !== selectedStudent) return false
    if (selectedSubject && a.template?.subject_id !== selectedSubject) return false
    if (templateFilter && a.template_id !== templateFilter) return false
    if (selectedTerm) {
      const term = terms.find(t => t.id === selectedTerm)
      if (term && a.assigned_date) {
        if (a.assigned_date < term.start_date || a.assigned_date > term.end_date) return false
      }
    }
    return true
  })

  const tabCounts = {
    all: baseFiltered.length,
    open: baseFiltered.filter(a => a.status === 'not_started' || a.status === 'in_progress' || isOverdue(a)).length,
    to_grade: baseFiltered.filter(a => a.status === 'submitted' && !a.is_graded).length,
    graded: baseFiltered.filter(a => a.is_graded || a.status === 'graded').length,
    excused: baseFiltered.filter(a => a.status === 'excused').length,
  }

  // ── Handlers ──
  const studentNameFor = (assignment: StudentAssignment | null) => {
    const stu = assignment ? students.find(s => s.id === assignment.student_id) : undefined
    return stu ? `${stu.first_name} ${stu.last_name}` : 'this student'
  }

  const handleExcuseAssignment = async (assignment: StudentAssignment) => {
    try {
      await assignmentsApi.updateStudentAssignment(assignment.id, { status: 'excused' })
      refetch()
      toast('Assignment excused')
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to excuse assignment'), 'danger')
    }
  }

  const handleReopenAssignment = async (assignment: StudentAssignment) => {
    try {
      await assignmentsApi.updateStudentAssignment(assignment.id, { status: 'not_started' })
      refetch()
      toast('Assignment reopened')
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to reopen assignment'), 'danger')
    }
  }

  const handleArchiveAssignment = async (assignment: StudentAssignment) => {
    try {
      await assignmentsApi.archiveStudentAssignment(assignment.id)
      refetch()
      toast('Assignment archived')
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to archive assignment'), 'danger')
    }
  }

  const handleUnassignAssignment = (assignment: StudentAssignment) => {
    setUnassigningAssignment(assignment)
  }

  const confirmUnassign = async () => {
    if (!unassigningAssignment) return
    try {
      setUnassignLoading(true)
      await assignmentsApi.deleteStudentAssignment(unassigningAssignment.id)
      refetch()
      toast('Assignment removed')
    } catch {
      toast('Failed to unassign assignment', 'danger')
    } finally {
      setUnassignLoading(false)
      setUnassigningAssignment(null)
    }
  }

  // ── Bulk handlers ──
  const handleBulkExcuse = async () => {
    const ids = Array.from(selectedIds)
    setBulkLoading(true)
    try {
      await Promise.all(ids.map(id => assignmentsApi.updateStudentAssignment(id, { status: 'excused' })))
      toast(`${ids.length} assignment${ids.length !== 1 ? 's' : ''} excused`)
      setSelectedIds(new Set())
      refetch()
    } catch {
      toast('Some assignments could not be excused', 'danger')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds)
    setBulkLoading(true)
    try {
      await Promise.all(ids.map(id => assignmentsApi.archiveStudentAssignment(id)))
      toast(`${ids.length} assignment${ids.length !== 1 ? 's' : ''} archived`)
      setSelectedIds(new Set())
      refetch()
    } catch {
      toast('Some assignments could not be archived', 'danger')
    } finally {
      setBulkLoading(false)
    }
  }

  const confirmBulkUnassign = async () => {
    const ids = Array.from(selectedIds)
    setBulkLoading(true)
    try {
      await Promise.all(ids.map(id => assignmentsApi.deleteStudentAssignment(id)))
      toast(`${ids.length} assignment${ids.length !== 1 ? 's' : ''} removed`)
      setSelectedIds(new Set())
      refetch()
    } catch {
      toast('Some assignments could not be removed', 'danger')
    } finally {
      setBulkLoading(false)
      setShowBulkUnassignConfirm(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedAssignments.length && sortedAssignments.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedAssignments.map(a => a.id)))
    }
  }

  const allSelected = sortedAssignments.length > 0 && sortedAssignments.every(a => selectedIds.has(a.id))

  const actionItemsFor = (assignment: StudentAssignment): ActionMenuEntry[] => {
    const isActive = !assignment.is_graded && assignment.status !== 'excused'
    return [
      { label: 'Edit assigned work', onSelect: () => setEditingAssignment(assignment) },
      'separator',
      ...(isActive
        ? [
            { label: 'Grade', onSelect: () => navigate('/grading', { state: { assignmentId: assignment.id } }) },
            { label: 'Excuse', onSelect: () => handleExcuseAssignment(assignment) },
            'separator' as const,
          ]
        : []),
      ...(assignment.status === 'excused'
        ? [{ label: 'Reopen', onSelect: () => handleReopenAssignment(assignment) }, 'separator' as const]
        : []),
      ...(assignment.is_graded
        ? [{ label: 'Archive', onSelect: () => handleArchiveAssignment(assignment) }, 'separator' as const]
        : []),
      { label: 'Unassign', onSelect: () => handleUnassignAssignment(assignment), danger: true },
    ]
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  /* ── STATUS TABS ── */
  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'to_grade', label: 'To grade' },
    { key: 'graded', label: 'Graded' },
    { key: 'excused', label: 'Excused' },
  ]

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] font-semibold text-faint uppercase tracking-[.08em] mb-1.5">
            {isAdmin ? 'Live work' : 'My work'}
          </p>
          <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">Assignments</h1>
          {isAdmin && !loading && (
            <p className="mt-1.5 text-[13px] text-muted">
              Every assignment given to a student — current and past.{' '}
              <span className="font-mono">{baseFiltered.length}</span> shown
              {tabCounts.to_grade > 0 && (
                <>
                  {' · '}
                  <Link to="/grading" className="text-accent font-semibold hover:underline">
                    {tabCounts.to_grade} to grade
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setComposer({ kind: 'create', showAssign: true, libraryDefault: false })}
            className="min-h-[44px] px-4 text-[13px] font-semibold rounded-field bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity flex items-center gap-1.5 mt-1 sm:min-h-[34px]"
          >
            <span className="text-[17px] leading-none" style={{ marginTop: -1 }}>+</span> New assignment
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {isAdmin && error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {isAdmin && loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* ════════════════════════════════════════
          ADMIN VIEW
      ════════════════════════════════════════ */}
      {!loading && isAdmin && (
        <>
          {/* Status filter tabs */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {STATUS_TABS.map(tab => {
              const count = tabCounts[tab.key]
              const isActive = statusFilter === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`h-[44px] px-3.5 text-[13px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors sm:h-[34px] ${
                    isActive
                      ? 'bg-ink text-btn-primary-fg'
                      : 'bg-panel border border-line text-muted hover:text-ink hover:bg-track'
                  }`}
                >
                  {tab.label}
                  {count > 0 && tab.key !== 'all' && (
                    <span className={`font-mono text-[11px] font-semibold ${isActive ? 'text-btn-primary-fg/70' : 'text-faint'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2.5 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                aria-label="Search assignments"
                placeholder="Search student or assignment…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 h-[44px] sm:h-[38px] bg-field-bg border border-field-border rounded-[9px] text-[13.5px] text-ink placeholder:text-faintest focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <select
              aria-label="Filter assignments by student"
              value={selectedStudent ?? ''}
              onChange={e => setSelectedStudent(e.target.value ? parseInt(e.target.value) : null)}
              className="h-[44px] px-3 pr-8 sm:h-[38px] bg-field-bg border border-field-border rounded-[9px] text-[13.5px] text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            >
              <option value="">All students</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
              ))}
            </select>
            <select
              aria-label="Filter assignments by subject"
              value={selectedSubject ?? ''}
              onChange={e => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
              className="h-[44px] px-3 pr-8 sm:h-[38px] bg-field-bg border border-field-border rounded-[9px] text-[13.5px] text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            >
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {terms.length > 0 && (
              <select
                aria-label="Filter assignments by term"
                value={selectedTerm ?? ''}
                onChange={e => setSelectedTerm(e.target.value ? parseInt(e.target.value) : null)}
                className="h-[44px] px-3 pr-8 sm:h-[38px] bg-field-bg border border-field-border rounded-[9px] text-[13.5px] text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="">All terms</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          {/* Active template filter chip */}
          {templateFilter && (() => {
            const templateName = allAssignments.find(a => a.template_id === templateFilter)?.template?.name ?? 'this template'
            return (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-[12px] text-faint">Filtered by template:</span>
                <span className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-accent-soft text-accent text-[12px] font-semibold">
                  {templateName}
                  <button
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.delete('template')
                      setSearchParams(next)
                    }}
                    aria-label="Clear template filter"
                    className="w-[16px] h-[16px] flex items-center justify-center rounded-full hover:bg-accent hover:text-white transition-colors text-[11px] leading-none"
                  >
                    ×
                  </button>
                </span>
              </div>
            )
          })()}

          {/* Mobile cards keep every key field and action reachable without
              squeezing a seven-column table into a phone viewport. */}
          {sortedAssignments.length > 0 && (
            <div className="space-y-3 md:hidden">
              {sortedAssignments.map((assignment) => {
                const stu = students.find((student) => student.id === assignment.student_id)
                const sub = assignment.template?.subject_id
                  ? getSubjectById(assignment.template.subject_id)
                  : undefined
                const overdue = isOverdue(assignment)
                const effectiveStatus = overdue ? 'overdue' : assignment.status
                const isSelected = selectedIds.has(assignment.id)
                const isExpanded = expandedId === assignment.id
                const maxPts = assignment.custom_max_points ?? assignment.template?.max_points ?? 100
                const assignmentName = assignment.template?.name ?? 'Assignment'

                return (
                  <article
                    key={assignment.id}
                    className={`overflow-hidden rounded-card border bg-panel ${
                      isSelected ? 'border-accent bg-accent-soft' : 'border-line'
                    }`}
                  >
                    <div className="flex items-center gap-3 border-b border-line-2 px-3 py-2.5">
                      <button
                        onClick={() => toggleSelect(assignment.id)}
                        aria-label={`${isSelected ? 'Deselect' : 'Select'} ${assignmentName}`}
                        className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-[8px]"
                      >
                        <span className={`flex h-[20px] w-[20px] items-center justify-center rounded-[5px] border-[1.5px] ${
                          isSelected ? 'border-accent bg-accent text-white' : 'border-check-border bg-field-bg'
                        }`}>
                          {isSelected && (
                            <svg width="10" height="8" fill="none" viewBox="0 0 9 7" aria-hidden="true">
                              <path d="M1 3.5 3.5 6 8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-ink">
                          {stu ? `${stu.first_name} ${stu.last_name}` : 'Unknown student'}
                        </p>
                        <p className="truncate text-[12px] text-faint">
                          {sub?.name ?? 'No subject'}
                          {assignment.template?.assignment_type && <> · <span className="capitalize">{assignment.template.assignment_type}</span></>}
                        </p>
                      </div>
                      <ActionMenu
                        ariaLabel={`Actions for ${assignmentName}`}
                        items={actionItemsFor(assignment)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`assignment-mobile-details-${assignment.id}`}
                      className="block w-full px-4 py-3.5 text-left"
                    >
                      <div className="flex items-start gap-2">
                        <SubjectDot color={sub?.color ?? '#74716A'} size={9} className="mt-1 flex-none" />
                        <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{assignmentName}</p>
                        <span className="flex-none text-[12px] font-semibold text-accent">{isExpanded ? 'Hide' : 'Details'}</span>
                      </div>

                      <dl className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[.05em] text-faint">Due</dt>
                          <dd className={`mt-1 text-[12.5px] font-medium ${overdue ? 'text-neg-fg' : 'text-ink-2'}`}>
                            {assignment.due_date
                              ? formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric' })
                              : 'No date'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[.05em] text-faint">Status</dt>
                          <dd className="mt-1"><Pill variant={statusToPillVariant(effectiveStatus)}>{effectiveStatus.replace('_', ' ')}</Pill></dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[.05em] text-faint">Grade</dt>
                          <dd className="mt-1 font-mono text-[12.5px] text-ink-2">
                            {assignment.is_graded && assignment.points_earned != null
                              ? `${assignment.points_earned}/${maxPts} · ${assignment.letter_grade ?? letterGrade(assignment.points_earned, maxPts)}`
                              : assignment.status === 'excused' ? 'Excused' : '—'}
                          </dd>
                        </div>
                      </dl>
                    </button>

                    {isExpanded && (
                      <div
                        id={`assignment-mobile-details-${assignment.id}`}
                        className="space-y-3 border-t border-line-2 bg-panel-2 px-4 py-4"
                      >
                        <AssignmentInfo
                          description={assignment.template?.description}
                          instructions={assignment.template?.instructions}
                          customInstructions={assignment.custom_instructions}
                        />
                        <SubmissionCard notes={assignment.submission_notes} artifacts={assignment.submission_artifacts} />
                        {assignment.teacher_feedback && (
                          <div className="rounded-[10px] border border-pos-fg/20 bg-pos-bg p-3.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[.05em] text-faint">Teacher feedback</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{assignment.teacher_feedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {/* Desktop/tablet table */}
          <div className={`bg-panel border border-line rounded-card overflow-hidden ${
            sortedAssignments.length > 0 ? 'hidden md:block' : ''
          }`}>
            {sortedAssignments.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-[15px] font-semibold text-ink-2 mb-1">No assignments match your filters</p>
                <p className="text-[13px] text-faint">Try adjusting the status tab or filters above.</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-panel-2 border-b border-line">
                    <th className="w-10 pl-4 py-3">
                      <button
                        onClick={toggleSelectAll}
                        aria-label={allSelected ? 'Deselect all assignments' : 'Select all assignments'}
                        className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${
                          allSelected ? 'bg-accent border-accent text-white' : 'border-check-border bg-field-bg'
                        }`}
                      >
                        {allSelected && (
                          <svg width="9" height="7" fill="none" viewBox="0 0 9 7">
                            <path d="M1 3.5 3.5 6 8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.05em] w-[180px]">Student</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.05em]">Assignment</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.05em] w-[90px]">Due</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.05em] w-[120px]">Status</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.05em] w-[140px]">Grade</th>
                    <th className="w-10 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {sortedAssignments.map((assignment, idx) => {
                    const stu = students.find(s => s.id === assignment.student_id)
                    const sub = assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined
                    const overdue = isOverdue(assignment)
                    const effectiveStatus = overdue ? 'overdue' : assignment.status
                    const isSelected = selectedIds.has(assignment.id)
                    const isLast = idx === sortedAssignments.length - 1
                    const initials = stu ? `${stu.first_name[0]}${stu.last_name[0]}` : '?'
                    const maxPts = assignment.custom_max_points ?? assignment.template?.max_points ?? 100
                    const isExpanded = expandedId === assignment.id
                    // Active = not yet completed/resolved; these get Excuse + Unassign + Grade
                    const isActive = !assignment.is_graded && assignment.status !== 'excused'

                    return (
                      <React.Fragment key={assignment.id}>
                      <tr
                        onClick={e => {
                          // Don't expand if clicking checkbox or menu
                          const target = e.target as HTMLElement
                          if (target.closest('button') || target.closest('[role="menu"]')) return
                          setExpandedId(isExpanded ? null : assignment.id)
                        }}
                        className={`group transition-colors cursor-pointer ${
                          isSelected ? 'bg-accent-soft' : isExpanded ? 'bg-panel-2' : 'hover:bg-panel-2'
                        } ${!isLast || isExpanded ? 'border-b border-line-2' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="pl-4 py-3.5 w-10">
                          <button
                            onClick={() => toggleSelect(assignment.id)}
                            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${assignment.template?.name ?? 'assignment'}`}
                            className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-accent border-accent text-white' : 'border-check-border bg-field-bg'
                            }`}
                          >
                            {isSelected && (
                              <svg width="9" height="7" fill="none" viewBox="0 0 9 7">
                                <path d="M1 3.5 3.5 6 8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                        </td>

                        {/* Student */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-track flex items-center justify-center flex-shrink-0">
                              <span className="text-[10.5px] font-semibold text-ink-2 font-mono">{initials}</span>
                            </div>
                            <span className="text-[13.5px] font-semibold text-ink">
                              {stu ? `${stu.first_name} ${stu.last_name}` : '—'}
                            </span>
                          </div>
                        </td>

                        {/* Assignment */}
                        <td className="px-3 py-3.5 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <SubjectDot color={sub?.color ?? '#74716A'} size={9} className="flex-none" />
                            <div className="min-w-0">
                              <div className="text-[14px] font-semibold text-ink tracking-[-0.01em] truncate">
                                {assignment.template?.name ?? '—'}
                              </div>
                              {assignment.is_student_created && <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-pill bg-accent-soft text-accent text-[9.5px] font-semibold uppercase tracking-wide">Student created</span>}
                              <div className="text-[12px] text-faint mt-0.5">
                                {sub?.name ?? '—'}
                                {assignment.template?.assignment_type && (
                                  <> · <span className="capitalize">{assignment.template.assignment_type}</span></>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Due */}
                        <td className="px-3 py-3.5">
                          {assignment.due_date ? (
                            <span className={`font-mono text-[13px] tabular-nums ${overdue ? 'text-neg-fg' : 'text-ink-2'}`}>
                              {formatDateOnly(assignment.due_date, { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-faintest text-[13px]">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3.5">
                          <Pill variant={statusToPillVariant(effectiveStatus)}>
                            {effectiveStatus.replace('_', ' ')}
                          </Pill>
                        </td>

                        {/* Grade */}
                        <td className="px-3 py-3.5">
                          {assignment.is_graded && assignment.points_earned != null ? (
                            <span className="font-mono tabular-nums text-[13px] text-ink-2">
                              {assignment.points_earned}/{maxPts}
                              {' '}·{' '}
                              <span className="text-ink font-semibold">
                                {assignment.letter_grade ?? letterGrade(assignment.points_earned, maxPts)}
                              </span>
                            </span>
                          ) : assignment.status === 'excused' ? (
                            <span className="text-[13px] text-exc-fg font-medium">Excused</span>
                          ) : (
                            <span className="text-faintest font-mono text-[13px]">—</span>
                          )}
                        </td>

                        {/* ⋯ Menu */}
                        <td className="pr-4 py-3.5 w-10">
                          <div className="flex justify-end">
                            <ActionMenu
                              ariaLabel={`Actions for ${assignment.template?.name ?? 'assignment'}`}
                              revealOnHover
                              items={actionItemsFor(assignment)}
                            />
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {isExpanded && (
                        <tr className={`${!isLast ? 'border-b border-line-2' : ''}`}>
                          <td colSpan={7} className="px-6 pb-5 pt-0 bg-panel-2">
                            <div className="pt-4 space-y-4">
                              {/* Meta row */}
                              <div className="flex items-center gap-3 flex-wrap text-[12.5px] text-muted">
                                {sub && <SubjectDot color={sub?.color ?? '#74716A'} size={9} />}
                                <span>{sub?.name ?? '—'}</span>
                                {assignment.template?.assignment_type && (
                                  <>
                                    <span className="text-check-border">·</span>
                                    <span className="capitalize">{assignment.template.assignment_type}</span>
                                  </>
                                )}
                                {assignment.assigned_date && (
                                  <>
                                    <span className="text-check-border">·</span>
                                    <span>Assigned {formatDateOnly(assignment.assigned_date, { month: 'short', day: 'numeric' })}</span>
                                  </>
                                )}
                                {assignment.submitted_date && (
                                  <>
                                    <span className="text-check-border">·</span>
                                    <span>Submitted {formatDateOnly(assignment.submitted_date, { month: 'short', day: 'numeric' })}</span>
                                  </>
                                )}
                                {isActive && (
                                  <button
                                    onClick={() => navigate('/grading', { state: { assignmentId: assignment.id } })}
                                    className="ml-auto h-[28px] px-3 text-[12.5px] font-semibold rounded-[7px] bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                                  >
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Grade
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Assignment info */}
                                <AssignmentInfo
                                  description={assignment.template?.description}
                                  instructions={assignment.template?.instructions}
                                  customInstructions={assignment.custom_instructions}
                                />

                                {/* Submission + grade */}
                                <div className="space-y-3">
                                  <SubmissionCard notes={assignment.submission_notes} artifacts={assignment.submission_artifacts} />

                                  {assignment.is_graded && assignment.points_earned != null && (
                                    <div className="bg-pos-bg border border-pos-fg/20 rounded-[10px] p-3.5">
                                      <p className="text-[11px] font-semibold text-faint uppercase tracking-[.05em] mb-1">Grade recorded</p>
                                      <p className="font-mono text-[20px] font-semibold text-pos-fg">
                                        {assignment.points_earned} / {maxPts}
                                        {(assignment.letter_grade ?? letterGrade(assignment.points_earned, maxPts)) && (
                                          <span className="ml-2 text-[15px]">
                                            ({assignment.letter_grade ?? letterGrade(assignment.points_earned, maxPts)})
                                          </span>
                                        )}
                                      </p>
                                      {assignment.teacher_feedback && (
                                        <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">{assignment.teacher_feedback}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-[13px] px-4 py-2.5 animate-slide-up"
              style={{ background: 'var(--btn-primary-bg)', boxShadow: '0 16px 40px var(--shadow-lg)' }}
            >
              <span className="text-[13.5px] font-semibold text-btn-primary-fg">
                {selectedIds.size} selected
              </span>
              <span className="w-px h-[22px] mx-2 bg-btn-primary-fg/20" />
              <button
                onClick={handleBulkExcuse}
                disabled={bulkLoading}
                className="h-[30px] px-3 text-[12.5px] font-semibold text-btn-primary-fg/80 hover:text-btn-primary-fg rounded-[7px] hover:bg-btn-primary-fg/10 transition-colors disabled:opacity-50"
              >
                Excuse
              </button>
              <button
                onClick={handleBulkArchive}
                disabled={bulkLoading}
                className="h-[30px] px-3 text-[12.5px] font-semibold text-btn-primary-fg/80 hover:text-btn-primary-fg rounded-[7px] hover:bg-btn-primary-fg/10 transition-colors disabled:opacity-50"
              >
                Archive
              </button>
              <button
                onClick={() => setShowBulkUnassignConfirm(true)}
                disabled={bulkLoading}
                className="h-[30px] px-3 text-[12.5px] font-semibold text-btn-primary-fg/80 hover:text-btn-primary-fg rounded-[7px] hover:bg-btn-primary-fg/10 transition-colors disabled:opacity-50"
              >
                Unassign
              </button>
              <span className="w-px h-[22px] mx-1 bg-btn-primary-fg/20" />
              <button
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
                className="w-[30px] h-[30px] flex items-center justify-center rounded-[7px] text-[16px] text-btn-primary-fg/60 hover:text-btn-primary-fg transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════
          STUDENT VIEW (owns its own data/loading)
      ════════════════════════════════════════ */}
      {!isAdmin && <StudentAssignmentsView />}

      {/* ── Modals ── */}
      {composer && (
        <AssignmentComposer
          mode={composer}
          subjects={subjects}
          students={students}
          onClose={() => setComposer(null)}
          onSuccess={() => { setComposer(null); refetch() }}
        />
      )}

      {editingAssignment && (
        <AssignedAssignmentEditor
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSaved={() => { setEditingAssignment(null); refetch() }}
        />
      )}

      {/* Unassign Confirmation */}
      <ConfirmDialog
        isOpen={!!unassigningAssignment}
        onClose={() => setUnassigningAssignment(null)}
        onConfirm={confirmUnassign}
        tone="danger"
        title="Remove assignment"
        message={<>Remove <strong className="text-ink">"{unassigningAssignment?.template?.name ?? 'this assignment'}"</strong> from {studentNameFor(unassigningAssignment)}?</>}
        confirmLabel="Remove"
        loading={unassignLoading}
      />

      {/* Bulk Unassign Confirmation */}
      <ConfirmDialog
        isOpen={showBulkUnassignConfirm}
        onClose={() => setShowBulkUnassignConfirm(false)}
        onConfirm={confirmBulkUnassign}
        tone="danger"
        title="Remove assignments"
        message={<>Remove <strong className="text-ink">{selectedIds.size} assignment{selectedIds.size !== 1 ? 's' : ''}</strong>? This cannot be undone.</>}
        confirmLabel={`Remove ${selectedIds.size}`}
        loading={bulkLoading}
      />
    </div>
  )
}

export default Assignments

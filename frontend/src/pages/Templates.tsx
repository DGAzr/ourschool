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
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'

// Hooks
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'

// Components
import { SubjectDot, Icon } from '../components/ui'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import StudentAssignmentCard from '../components/assignments/StudentAssignmentCard'
import CreateTemplateModal from '../components/assignments/CreateTemplateModal'
import EditTemplateModal from '../components/assignments/EditTemplateModal'
import AssignTemplateModal from '../components/assignments/AssignTemplateModal'
import { ExportAssignmentModal } from '../components/assignments/ExportAssignmentModal'
import { ImportAssignmentModal } from '../components/assignments/ImportAssignmentModal'
import SubmissionDialog from '../components/assignments/SubmissionDialog'

// Types
import { AssignmentTemplate, StudentAssignment } from '../types'

const Templates: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<AssignmentTemplate | null>(null)
  const [assigningTemplate, setAssigningTemplate] = useState<AssignmentTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<AssignmentTemplate | null>(null)
  const [archivingTemplate, setArchivingTemplate] = useState<AssignmentTemplate | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)
  const [archivingLoading, setArchivingLoading] = useState(false)
  const [exportingTemplate, setExportingTemplate] = useState<AssignmentTemplate | null>(null)
  const [submittingAssignment, setSubmittingAssignment] = useState<StudentAssignment | null>(null)
  const [deletingStudentAssignment, setDeletingStudentAssignment] = useState<StudentAssignment | null>(null)
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())
  const [collapsedShelves, setCollapsedShelves] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('assignments.collapsedShelves')
      return new Set<string>(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  })
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    localStorage.setItem('assignments.collapsedShelves', JSON.stringify([...collapsedShelves]))
  }, [collapsedShelves])

  // Filters
  const {
    searchTerm,
    setSearchTerm,
    selectedSubject,
    setSelectedSubject,
    selectedType,
    setSelectedType,
    filterTemplates,
    filterStudentAssignments,
    filterGradingAssignments
  } = useAssignmentFilters()

  // Data
  const {
    templates,
    studentAssignments,
    submittedAssignments,
    subjects,
    students,
    loading,
    error,
    refetch,
    setTemplates,
    setError
  } = useAssignments({
    isAdmin,
    adminViewMode: 'templates',
    selectedSubject,
    includeArchived: showArchived,
  })

  // Utility functions
  const getSubjectById = (id: number) => subjects.find(s => s.id === id)

  // Event handlers
  const handleCreateTemplate = () => {
    setShowCreateModal(true)
  }

  const handleEditTemplate = (template: AssignmentTemplate) => {
    setEditingTemplate(template)
    setShowEditModal(true)
  }

  const handleDeleteTemplate = (template: AssignmentTemplate) => {
    setDeletingTemplate(template)
    setShowDeleteConfirm(true)
  }

  const handleAssignTemplate = (template: AssignmentTemplate) => {
    setAssigningTemplate(template)
    setShowAssignModal(true)
  }

  const handleArchiveTemplate = (template: AssignmentTemplate) => {
    setArchivingTemplate(template)
    setShowArchiveConfirm(true)
  }

  const handleUnarchiveTemplate = async (template: AssignmentTemplate) => {
    try {
      await assignmentsApi.archiveTemplate(template.id) // toggle — unarchives when already archived
      refetch()
      setMenuOpenId(null)
    } catch {
      setError('Failed to unarchive template')
    }
  }

  const handleExportTemplate = (template: AssignmentTemplate) => {
    setExportingTemplate(template)
    setSelectedTemplates(new Set())
    setShowExportModal(true)
  }

  const handleBulkExport = () => {
    if (selectedTemplates.size === 0) return
    setExportingTemplate(null)
    setShowExportModal(true)
  }

  const handleImportTemplate = () => {
    setShowImportModal(true)
  }

  const performTemplateExport = async (templateId: number) => {
    return await assignmentsApi.exportTemplate(templateId)
  }

  const performBulkExport = async (templateIds: number[]) => {
    return await assignmentsApi.bulkExportTemplates(templateIds)
  }

  const performTemplateImport = async (data: any) => {
    return await assignmentsApi.importTemplate(data)
  }

  const toggleTemplateSelection = (templateId: number) => {
    const newSelected = new Set(selectedTemplates)
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId)
    } else {
      newSelected.add(templateId)
    }
    setSelectedTemplates(newSelected)
  }

  const toggleShelf = (key: string) => {
    const next = new Set(collapsedShelves)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setCollapsedShelves(next)
  }

  const toggleShelfSelection = (templateIds: number[], allSelected: boolean) => {
    const next = new Set(selectedTemplates)
    if (allSelected) {
      templateIds.forEach(id => next.delete(id))
    } else {
      templateIds.forEach(id => next.add(id))
    }
    setSelectedTemplates(next)
  }

  const confirmDelete = async () => {
    if (!deletingTemplate) return

    try {
      setDeletingLoading(true)
      await assignmentsApi.delete(deletingTemplate.id)
      setTemplates(templates.filter(t => t.id !== deletingTemplate.id))
      setShowDeleteConfirm(false)
      setDeletingTemplate(null)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete assignment template'
      setError(errorMessage)
      setShowDeleteConfirm(false)
      setDeletingTemplate(null)
    } finally {
      setDeletingLoading(false)
    }
  }

  const confirmArchive = async () => {
    if (!archivingTemplate) return
    try {
      setArchivingLoading(true)
      await assignmentsApi.archiveTemplate(archivingTemplate.id)
      refetch()
    } catch (err) {
      setError('Failed to archive template')
    } finally {
      setArchivingLoading(false)
      setShowArchiveConfirm(false)
      setArchivingTemplate(null)
    }
  }

  const handleStartAssignment = async (assignmentId: number) => {
    try {
      await assignmentsApi.startAssignment(assignmentId)
      refetch()
    } catch (err) {
      setError('Failed to start assignment')
    }
  }

  const handleCompleteAssignment = (assignment: StudentAssignment) => {
    if (assignment.status === 'in_progress') {
      setSubmittingAssignment(assignment)
      setShowSubmissionDialog(true)
    }
  }

  const handleSubmitAssignment = async (submissionData: {
    submission_notes?: string
    submission_artifacts?: string[]
  }) => {
    if (!submittingAssignment) return

    try {
      await assignmentsApi.updateStudentAssignment(submittingAssignment.id, {
        status: 'submitted',
        ...submissionData
      })
      setShowSubmissionDialog(false)
      setSubmittingAssignment(null)
      refetch()
    } catch (err) {
      setError('Failed to submit assignment')
    }
  }

  const handleArchiveStudentAssignment = async (assignment: StudentAssignment) => {
    try {
      await assignmentsApi.archiveStudentAssignment(assignment.id)
      refetch()
    } catch (err) {
      setError('Failed to archive assignment')
    }
  }

  const handleDeleteStudentAssignment = (assignment: StudentAssignment) => {
    setDeletingStudentAssignment(assignment)
  }

  const confirmDeleteStudentAssignment = async () => {
    if (!deletingStudentAssignment) return
    try {
      await assignmentsApi.deleteStudentAssignment(deletingStudentAssignment.id)
      refetch()
    } catch (err) {
      setError('Failed to delete assignment')
    } finally {
      setDeletingStudentAssignment(null)
    }
  }

  const deletingStudentAssignmentName = (() => {
    const student = deletingStudentAssignment
      ? students.find(s => s.id === deletingStudentAssignment.student_id)
      : undefined
    return student ? `${student.first_name} ${student.last_name}` : 'this student'
  })()

  // Apply filters — when showArchived is on, restrict to only archived templates
  const filteredTemplates = filterTemplates(templates).filter(t => showArchived ? t.is_archived : !t.is_archived)
  const filteredStudentAssignments = filterStudentAssignments(studentAssignments)

  void filterGradingAssignments

  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  /* ── derived data ── */
  // Group templates by subject for Shelves view
  const templateGroups = (() => {
    const groups: { subjectId: number | null; name: string; color: string; icon?: string | null; templates: typeof filteredTemplates }[] = []
    const seen = new Map<string, typeof groups[0]>()
    for (const t of filteredTemplates) {
      const sub = getSubjectById(t.subject_id ?? 0)
      const key = sub ? String(sub.id) : 'none'
      if (!seen.has(key)) {
        const g = { subjectId: sub?.id ?? null, name: sub?.name ?? 'No Subject', color: (sub as any)?.color ?? '#8B7355', icon: sub?.icon, templates: [] as typeof filteredTemplates }
        seen.set(key, g)
        groups.push(g)
      }
      seen.get(key)!.templates.push(t)
    }
    return groups
  })()

  const TYPE_LABELS: Record<string, string> = {
    homework: 'Homework', quiz: 'Quiz', test: 'Test', project: 'Project',
    essay: 'Essay', lab: 'Lab', presentation: 'Presentation', other: 'Other',
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">
            {isAdmin ? 'Library' : 'My Work'}
          </p>
          <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">Templates</h1>
          {isAdmin && (
            <p className="mt-1.5 text-[13px] text-muted">
              <span className="font-mono">{filteredTemplates.length}</span> template{filteredTemplates.length !== 1 ? 's' : ''}
              {submittedAssignments.length > 0 && (
                <> · <Link to="/grading" className="text-accent font-semibold hover:underline">{submittedAssignments.length} awaiting grade</Link></>
              )}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {selectedTemplates.size > 0 && (
              <button
                onClick={handleBulkExport}
                className="h-[34px] px-3 text-[13px] font-semibold rounded-field border border-btn-border bg-panel text-ink hover:bg-track transition-colors"
              >
                Export {selectedTemplates.size}
              </button>
            )}
            <button
              onClick={handleImportTemplate}
              className="h-[34px] px-3 text-[13px] font-semibold rounded-field border border-btn-border bg-panel text-ink hover:bg-track transition-colors"
            >
              Import
            </button>
            <button
              onClick={handleCreateTemplate}
              className="h-[34px] px-4 text-[13px] font-semibold rounded-field bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <span className="text-[17px] leading-none" style={{ marginTop: -1 }}>+</span> New template
            </button>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}

      {/* ════════════════════════════════════════
          ADMIN — LIBRARY (templates)
      ════════════════════════════════════════ */}
      {!loading && isAdmin && (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
            <div className="relative w-full sm:max-w-[280px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search templates…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-field-bg border border-field-border rounded-field text-[13px] text-ink placeholder:text-faintest focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedSubject ?? ''}
                onChange={e => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
                className="h-[34px] px-3 bg-field-bg border border-field-border rounded-field text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                value={selectedType ?? ''}
                onChange={e => setSelectedType(e.target.value || null)}
                className="h-[34px] px-3 bg-field-bg border border-field-border rounded-field text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="">All Types</option>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button
                onClick={() => setShowArchived(v => !v)}
                className={`h-[34px] px-3 text-[13px] font-semibold rounded-field border transition-colors flex items-center gap-1.5 ${
                  showArchived
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-btn-border bg-panel text-muted hover:text-ink hover:bg-track'
                }`}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8m-9 4v4m4-4v4" /></svg>
                Archived
              </button>
            </div>
          </div>

          {/* ── Shelves view ── */}
          <div className="bg-panel border border-line rounded-card overflow-hidden">
            {templateGroups.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-[15px] font-semibold text-ink-2 mb-1">No templates match your filters</p>
                <p className="text-[13px] text-faint">Try clearing search, subject, or type.</p>
              </div>
            ) : templateGroups.map((group, gi) => {
              const shelfKey = group.subjectId != null ? String(group.subjectId) : 'none'
              const isCollapsed = collapsedShelves.has(shelfKey)
              const shelfIds = group.templates.map(t => t.id)
              const allSelected = shelfIds.length > 0 && shelfIds.every(id => selectedTemplates.has(id))
              return (
                <div key={shelfKey}>
                  {/* Subject header — click to collapse/expand */}
                  <button
                    onClick={() => toggleShelf(shelfKey)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-panel-2 border-b border-line-3 text-left hover:bg-faintest/30 transition-colors"
                  >
                    {/* Per-shelf select-all checkbox */}
                    <span
                      role="checkbox"
                      aria-checked={allSelected}
                      aria-label={`Select all templates in ${group.name}`}
                      onClick={e => { e.stopPropagation(); toggleShelfSelection(shelfIds, allSelected) }}
                      className={`w-4 h-4 rounded border flex-none flex items-center justify-center transition-colors cursor-pointer ${
                        allSelected ? 'bg-accent border-accent text-white' : 'border-check-border bg-field-bg'
                      }`}
                    >
                      {allSelected && (
                        <svg width="9" height="7" fill="none" viewBox="0 0 9 7"><path d="M1 3.5 3.5 6 8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </span>
                    {group.icon
                      ? <Icon name={group.icon} color={group.color} size={15} className="flex-shrink-0" />
                      : <SubjectDot color={group.color} size={10} />
                    }
                    <span className="font-bold text-[13.5px] tracking-[-0.01em] text-ink">{group.name}</span>
                    <span className="font-mono text-[11.5px] text-faint">{group.templates.length}</span>
                    {/* Collapse chevron */}
                    <svg
                      className={`ml-auto text-faint transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                      width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                    >
                      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {!isCollapsed && group.templates.map((template, ri) => (
                    <div
                      key={template.id}
                      className={`relative flex items-center gap-3 px-4 py-3.5 group ${
                        ri < group.templates.length - 1 || gi < templateGroups.length - 1 ? 'border-b border-line-2' : ''
                      } hover:bg-faintest/40 transition-colors ${template.is_archived ? 'opacity-50' : ''}`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTemplateSelection(template.id)}
                        aria-label={`${selectedTemplates.has(template.id) ? 'Deselect' : 'Select'} ${template.name}`}
                        className={`w-4 h-4 rounded border flex-none flex items-center justify-center transition-colors ${
                          selectedTemplates.has(template.id)
                            ? 'bg-accent border-accent text-white'
                            : 'border-check-border bg-field-bg'
                        }`}
                      >
                        {selectedTemplates.has(template.id) && (
                          <svg width="9" height="7" fill="none" viewBox="0 0 9 7"><path d="M1 3.5 3.5 6 8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                      </button>
                      {/* Name + desc + mobile metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] text-ink tracking-[-0.01em]">{template.name}</div>
                        {template.description && (
                          <div className="text-[12px] text-faint mt-0.5 truncate">{template.description}</div>
                        )}
                        {/* Mobile-only metadata row (hidden on desktop) */}
                        <div className="flex items-center gap-2 mt-1 lg:hidden">
                          <span className="inline-block px-2 py-[2px] rounded-pill bg-track text-ink-2 text-[11px] font-semibold">
                            {TYPE_LABELS[template.assignment_type] ?? template.assignment_type}
                          </span>
                          {template.max_points != null && (
                            <span className="text-[11.5px] font-mono text-ink-2">{template.max_points} pts</span>
                          )}
                          {template.estimated_duration_minutes ? (
                            <span className="text-[11.5px] font-mono text-muted">{template.estimated_duration_minutes}m</span>
                          ) : null}
                          {(template.total_assigned ?? 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent text-[11px] font-mono font-semibold">
                              {template.total_assigned} assigned
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Type pill — desktop only */}
                      <span className="hidden lg:inline-block flex-none px-2.5 py-[3px] rounded-pill bg-track text-ink-2 text-[11.5px] font-semibold">
                        {TYPE_LABELS[template.assignment_type] ?? template.assignment_type}
                      </span>
                      {/* Points — desktop only */}
                      <span className="hidden lg:inline flex-none w-[62px] text-right font-mono tabular-nums text-[13px] text-ink-2">
                        {template.max_points ?? '—'} pts
                      </span>
                      {/* Duration — desktop only */}
                      <span className="hidden lg:inline flex-none w-[52px] text-right font-mono tabular-nums text-[13px] text-muted">
                        {template.estimated_duration_minutes ? `${template.estimated_duration_minutes}m` : '—'}
                      </span>
                      {/* Assigned count — desktop only */}
                      <span className="hidden lg:flex flex-none w-[40px] justify-center">
                        {(template.total_assigned ?? 0) > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent text-[11px] font-mono font-semibold">
                            {template.total_assigned}
                          </span>
                        ) : (
                          <span className="text-[11px] text-faintest">—</span>
                        )}
                      </span>
                      {/* Actions — always visible on mobile, hover-revealed on desktop */}
                      <div className="flex-none w-[96px] flex justify-end gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        {!template.is_archived && (
                          <button
                            onClick={() => handleAssignTemplate(template)}
                            className="h-[30px] px-3 border border-btn-border bg-panel rounded-[7px] text-[12.5px] font-semibold text-ink hover:bg-track transition-colors"
                          >
                            Assign
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === template.id ? null : template.id)}
                            aria-label={`Actions for ${template.name}`}
                            className="w-[30px] h-[30px] border border-line bg-panel rounded-[7px] text-muted flex items-center justify-center text-[16px] leading-none hover:bg-track transition-colors"
                          >
                            ⋯
                          </button>
                          {menuOpenId === template.id && (
                            <div className="absolute right-0 top-[34px] z-20 bg-panel border border-field-border rounded-[10px] shadow-menu p-1 w-40 animate-pop">
                              {!template.is_archived && (
                                <>
                                  <button onClick={() => { handleEditTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-ink-2 hover:bg-track rounded-[6px]">Edit</button>
                                  <button onClick={() => { handleExportTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-ink-2 hover:bg-track rounded-[6px]">Export</button>
                                  <button onClick={() => { handleArchiveTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-ink-2 hover:bg-track rounded-[6px]">Archive</button>
                                  <div className="h-px bg-line-2 my-1 mx-1.5" />
                                </>
                              )}
                              {template.is_archived && (
                                <>
                                  <button onClick={() => handleUnarchiveTemplate(template)} className="w-full text-left px-2.5 py-2 text-[13px] text-ink-2 hover:bg-track rounded-[6px]">Unarchive</button>
                                  <div className="h-px bg-line-2 my-1 mx-1.5" />
                                </>
                              )}
                              <button onClick={() => { handleDeleteTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-danger hover:bg-track rounded-[6px]">Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          STUDENT VIEW
      ════════════════════════════════════════ */}
      {!loading && !isAdmin && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-[260px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search assignments…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-field-bg border border-field-border rounded-field text-[13px] text-ink placeholder:text-faintest focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <select
              value={selectedSubject ?? ''}
              onChange={e => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
              className="h-[34px] px-3 bg-field-bg border border-field-border rounded-field text-[13px] text-ink"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredStudentAssignments.length === 0 ? (
              <div className="col-span-full py-14 text-center">
                <p className="text-[15px] font-semibold text-ink-2 mb-1">
                  {searchTerm || selectedSubject ? 'No assignments match your filters' : 'No assignments yet'}
                </p>
                <p className="text-[13px] text-faint">
                  {searchTerm || selectedSubject ? 'Try clearing your filters.' : 'Your assigned work will appear here.'}
                </p>
              </div>
            ) : filteredStudentAssignments.map(assignment => (
              <StudentAssignmentCard
                key={assignment.id}
                assignment={assignment}
                subject={assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined}
                isAdmin={isAdmin}
                onStart={handleStartAssignment}
                onComplete={handleCompleteAssignment}
                onArchive={handleArchiveStudentAssignment}
                onDelete={handleDeleteStudentAssignment}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Modals ── */}

      {/* Create Template Modal */}
      {showCreateModal && (
        <CreateTemplateModal
          subjects={subjects}
            onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            refetch()
          }}
        />
      )}

      {/* Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          subjects={subjects}
          onClose={() => {
            setShowEditModal(false)
            setEditingTemplate(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setEditingTemplate(null)
            refetch()
          }}
        />
      )}

      {/* Assign Template Modal */}
      {showAssignModal && assigningTemplate && (
        <AssignTemplateModal
          template={assigningTemplate}
          students={students}
          onClose={() => {
            setShowAssignModal(false)
            setAssigningTemplate(null)
          }}
          onSuccess={() => {
            setShowAssignModal(false)
            setAssigningTemplate(null)
            refetch()
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm && !!deletingTemplate}
        onClose={() => { setShowDeleteConfirm(false); setDeletingTemplate(null) }}
        onConfirm={confirmDelete}
        tone="danger"
        title="Delete assignment template"
        message={<>Are you sure you want to delete <strong className="text-ink">"{deletingTemplate?.name}"</strong>? This action cannot be undone.</>}
        note={deletingTemplate?.total_assigned && deletingTemplate.total_assigned > 0
          ? <>This template is currently assigned to <strong className="text-danger">{deletingTemplate.total_assigned} student{deletingTemplate.total_assigned !== 1 ? 's' : ''}</strong>. Their existing assignments will be removed too.</>
          : undefined}
        confirmLabel="Delete template"
        loading={deletingLoading}
      />

      {/* Archive Confirmation */}
      <ConfirmDialog
        isOpen={showArchiveConfirm && !!archivingTemplate}
        onClose={() => { setShowArchiveConfirm(false); setArchivingTemplate(null) }}
        onConfirm={confirmArchive}
        tone="warn"
        title="Archive assignment template"
        message={<>Archive <strong className="text-ink">"{archivingTemplate?.name}"</strong>? It will be hidden from the assignment-creation list, but existing assignments are preserved.</>}
        confirmLabel="Archive template"
        loading={archivingLoading}
      />

      {/* Delete Student Assignment Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingStudentAssignment}
        onClose={() => setDeletingStudentAssignment(null)}
        onConfirm={confirmDeleteStudentAssignment}
        tone="danger"
        title="Delete assignment"
        message={<>Are you sure you want to delete this assignment for <strong className="text-ink">{deletingStudentAssignmentName}</strong>?</>}
        confirmLabel="Delete assignment"
      />

      {/* Export Modal */}
      {showExportModal && (
        <ExportAssignmentModal
          isOpen={showExportModal}
          onClose={() => {
            setShowExportModal(false)
            setExportingTemplate(null)
            setSelectedTemplates(new Set())
          }}
          templateId={exportingTemplate?.id || 0}
          templateName={exportingTemplate?.name || ''}
          onExport={performTemplateExport}
          onBulkExport={performBulkExport}
          selectedTemplateIds={Array.from(selectedTemplates)}
          isBulkMode={!exportingTemplate && selectedTemplates.size > 0}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportAssignmentModal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false)
            refetch()
          }}
          onImport={performTemplateImport}
          subjects={subjects}
          />
      )}

      {/* Submission Dialog */}
      {showSubmissionDialog && submittingAssignment && (
        <SubmissionDialog
          assignment={submittingAssignment}
          isOpen={showSubmissionDialog}
          onClose={() => {
            setShowSubmissionDialog(false)
            setSubmittingAssignment(null)
          }}
          onSubmit={handleSubmitAssignment}
          loading={false}
        />
      )}
    </div>
  )
}

export default Templates
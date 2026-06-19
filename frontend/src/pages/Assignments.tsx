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

import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'

// Hooks
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'

// Components
import { SegmentedControl, Pill, SubjectDot, statusToPillVariant } from '../components/ui'
import StudentAssignmentCard from '../components/assignments/StudentAssignmentCard'
import CreateTemplateModal from '../components/assignments/CreateTemplateModal'
import EditTemplateModal from '../components/assignments/EditTemplateModal'
import AssignTemplateModal from '../components/assignments/AssignTemplateModal'
import { ExportAssignmentModal } from '../components/assignments/ExportAssignmentModal'
import { ImportAssignmentModal } from '../components/assignments/ImportAssignmentModal'
import SubmissionDialog from '../components/assignments/SubmissionDialog'
import QuickAssignModal from '../components/assignments/QuickAssignModal'

// Types
import { AssignmentTemplate, StudentAssignment } from '../types'

const Assignments: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showQuickAssignModal, setShowQuickAssignModal] = useState(false)
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
  const [exportingTemplate, setExportingTemplate] = useState<AssignmentTemplate | null>(null)
  const [submittingAssignment, setSubmittingAssignment] = useState<StudentAssignment | null>(null)
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())
  const [templateView, setTemplateView] = useState<'shelves' | 'table' | 'cards'>('shelves')
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)

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

  const confirmDelete = async () => {
    if (!deletingTemplate) return

    try {
      await assignmentsApi.delete(deletingTemplate.id)
      setTemplates(templates.filter(t => t.id !== deletingTemplate.id))
      setShowDeleteConfirm(false)
      setDeletingTemplate(null)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete assignment template'
      setError(errorMessage)
      setShowDeleteConfirm(false)
      setDeletingTemplate(null)
    }
  }

  const confirmArchive = async () => {
    if (!archivingTemplate) return
    try {
      await assignmentsApi.archiveTemplate(archivingTemplate.id)
      refetch()
    } catch (err) {
      setError('Failed to archive template')
    } finally {
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

  const handleDeleteStudentAssignment = async (assignment: StudentAssignment) => {
    const student = students.find(s => s.id === assignment.student_id)
    const studentName = student ? `${student.first_name} ${student.last_name}` : 'this student'
    
    if (!confirm(`Are you sure you want to delete this assignment for ${studentName}?`)) {
      return
    }

    try {
      await assignmentsApi.deleteStudentAssignment(assignment.id)
      refetch()
    } catch (err) {
      setError('Failed to delete assignment')
    }
  }

  // Apply filters
  const filteredTemplates = filterTemplates(templates)
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
    const groups: { subjectId: number | null; name: string; color: string; templates: typeof filteredTemplates }[] = []
    const seen = new Map<string, typeof groups[0]>()
    for (const t of filteredTemplates) {
      const sub = getSubjectById(t.subject_id ?? 0)
      const key = sub ? String(sub.id) : 'none'
      if (!seen.has(key)) {
        const g = { subjectId: sub?.id ?? null, name: sub?.name ?? 'No Subject', color: (sub as any)?.color ?? '#8B7355', templates: [] as typeof filteredTemplates }
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
    <div className="space-y-0">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">
            {isAdmin ? 'Library' : 'My Work'}
          </p>
          <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">Assignments</h1>
          {isAdmin && (
            <p className="mt-1.5 text-[13px] text-muted">
              <span className="font-mono">{filteredTemplates.length}</span> template{filteredTemplates.length !== 1 ? 's' : ''}
              {submittedAssignments.length > 0 && (
                <> · <span className="font-mono text-accent">{submittedAssignments.length}</span> awaiting grade</>
              )}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 mt-1">
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
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-[280px]">
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
            <div className="ml-auto">
              <SegmentedControl
                segments={[
                  { value: 'shelves', label: 'Shelves' },
                  { value: 'table', label: 'Table' },
                  { value: 'cards', label: 'Cards' },
                ]}
                value={templateView}
                onChange={setTemplateView}
              />
            </div>
          </div>

          {/* ── Shelves view ── */}
          {templateView === 'shelves' && (
            <div className="bg-panel border border-line rounded-card overflow-hidden">
              {templateGroups.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="text-[15px] font-semibold text-ink-2 mb-1">No templates match your filters</p>
                  <p className="text-[13px] text-faint">Try clearing search, subject, or type.</p>
                </div>
              ) : templateGroups.map((group, gi) => (
                <div key={group.subjectId ?? 'none'}>
                  {/* Subject header */}
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-panel-2 border-b border-line-3">
                    <SubjectDot color={group.color} size={10} />
                    <span className="font-bold text-[13.5px] tracking-[-0.01em] text-ink">{group.name}</span>
                    <span className="font-mono text-[11.5px] text-faint">{group.templates.length}</span>
                  </div>
                  {group.templates.map((template, ri) => (
                    <div
                      key={template.id}
                      className={`relative flex items-center gap-3 px-4 py-3.5 group ${
                        ri < group.templates.length - 1 || gi < templateGroups.length - 1 ? 'border-b border-line-2' : ''
                      } hover:bg-faintest/40 transition-colors`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTemplateSelection(template.id)}
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
                      {/* Name + desc */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] text-ink tracking-[-0.01em]">{template.name}</div>
                        {template.description && (
                          <div className="text-[12px] text-faint mt-0.5 truncate">{template.description}</div>
                        )}
                      </div>
                      {/* Type pill */}
                      <span className="flex-none inline-block px-2.5 py-[3px] rounded-pill bg-track text-ink-2 text-[11.5px] font-semibold">
                        {TYPE_LABELS[template.assignment_type] ?? template.assignment_type}
                      </span>
                      {/* Points */}
                      <span className="flex-none w-[62px] text-right font-mono tabular-nums text-[13px] text-ink-2">
                        {template.max_points ?? '—'} pts
                      </span>
                      {/* Duration */}
                      <span className="flex-none w-[52px] text-right font-mono tabular-nums text-[13px] text-muted">
                        {template.estimated_duration_minutes ? `${template.estimated_duration_minutes}m` : '—'}
                      </span>
                      {/* Assigned count */}
                      <span className="flex-none w-[40px] flex justify-center">
                        {(template.total_assigned ?? 0) > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent text-[11px] font-mono font-semibold">
                            {template.total_assigned}
                          </span>
                        ) : (
                          <span className="text-[11px] text-faintest">—</span>
                        )}
                      </span>
                      {/* Actions (hover-revealed) */}
                      <div className="flex-none w-[96px] flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleAssignTemplate(template)}
                          className="h-[30px] px-3 border border-btn-border bg-panel rounded-[7px] text-[12.5px] font-semibold text-ink hover:bg-track transition-colors"
                        >
                          Assign
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === template.id ? null : template.id)}
                            className="w-[30px] h-[30px] border border-line bg-panel rounded-[7px] text-muted flex items-center justify-center text-[16px] leading-none hover:bg-track transition-colors"
                          >
                            ⋯
                          </button>
                          {menuOpenId === template.id && (
                            <div className="absolute right-0 top-[34px] z-20 bg-panel border border-field-border rounded-[10px] shadow-menu p-1 w-40 animate-pop">
                              <button onClick={() => { handleEditTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-ink-2 hover:bg-track rounded-[6px]">Edit</button>
                              <button onClick={() => { handleExportTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-ink-2 hover:bg-track rounded-[6px]">Export</button>
                              <button onClick={() => { handleArchiveTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-ink-2 hover:bg-track rounded-[6px]">Archive</button>
                              <div className="h-px bg-line-2 my-1 mx-1.5" />
                              <button onClick={() => { handleDeleteTemplate(template); setMenuOpenId(null) }} className="w-full text-left px-2.5 py-2 text-[13px] text-danger hover:bg-track rounded-[6px]">Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── Table view ── */}
          {templateView === 'table' && (
            <div className="bg-panel border border-line rounded-card overflow-hidden">
              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="bg-panel-2 border-b border-line">
                    <th className="w-[42px] pl-4 py-2.5 text-left">
                      <button
                        onClick={() => {
                          if (selectedTemplates.size === filteredTemplates.length) {
                            setSelectedTemplates(new Set())
                          } else {
                            setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)))
                          }
                        }}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0
                            ? 'bg-accent border-accent text-white'
                            : 'border-check-border bg-field-bg'
                        }`}
                      >
                        {selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0 && (
                          <svg width="9" height="7" fill="none" viewBox="0 0 9 7"><path d="M1 3.5 3.5 6 8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        )}
                      </button>
                    </th>
                    {['Template', 'Subject', 'Type', 'Points', 'Time', 'Assigned'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-faint uppercase tracking-[.05em]">{h}</th>
                    ))}
                    <th className="w-[120px] px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.length === 0 ? (
                    <tr><td colSpan={8} className="py-14 text-center text-[13px] text-faint">No templates match your filters</td></tr>
                  ) : filteredTemplates.map(template => {
                    const sub = getSubjectById(template.subject_id ?? 0)
                    return (
                      <tr key={template.id} className="group border-b border-line-2 hover:bg-faintest/40 transition-colors">
                        <td className="pl-4 py-3 align-middle">
                          <button
                            onClick={() => toggleTemplateSelection(template.id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selectedTemplates.has(template.id) ? 'bg-accent border-accent text-white' : 'border-check-border bg-field-bg'
                            }`}
                          >
                            {selectedTemplates.has(template.id) && (
                              <svg width="9" height="7" fill="none" viewBox="0 0 9 7"><path d="M1 3.5 3.5 6 8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="font-semibold text-ink tracking-[-0.01em]">{template.name}</div>
                          {template.description && <div className="text-[12px] text-faint mt-0.5 truncate max-w-[300px]">{template.description}</div>}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            <SubjectDot color={(sub as any)?.color ?? '#8B7355'} size={9} />
                            <span className="text-ink-2">{sub?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className="inline-block px-2.5 py-[3px] rounded-pill bg-track text-ink-2 text-[11.5px] font-semibold">
                            {TYPE_LABELS[template.assignment_type] ?? template.assignment_type}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle text-right font-mono tabular-nums text-ink-2">{template.max_points ?? '—'}</td>
                        <td className="px-3 py-3 align-middle text-right font-mono tabular-nums text-muted">{template.estimated_duration_minutes ? `${template.estimated_duration_minutes}m` : '—'}</td>
                        <td className="px-3 py-3 align-middle">
                          {(template.total_assigned ?? 0) > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent text-[11px] font-mono font-semibold">{template.total_assigned}</span>
                          ) : <span className="text-faintest text-[12px]">—</span>}
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleAssignTemplate(template)} className="h-[28px] px-2.5 border border-btn-border bg-panel rounded-[7px] text-[12px] font-semibold text-ink hover:bg-track transition-colors">Assign</button>
                            <button onClick={() => handleEditTemplate(template)} className="h-[28px] px-2.5 border border-btn-border bg-panel rounded-[7px] text-[12px] font-semibold text-ink hover:bg-track transition-colors">Edit</button>
                            <button onClick={() => handleDeleteTemplate(template)} className="h-[28px] px-2.5 border border-btn-border bg-panel rounded-[7px] text-[12px] font-semibold text-danger hover:bg-neg-bg transition-colors">Del</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Cards view ── */}
          {templateView === 'cards' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.length === 0 ? (
                <div className="col-span-full py-14 text-center">
                  <p className="text-[15px] font-semibold text-ink-2 mb-1">No templates match your filters</p>
                  <p className="text-[13px] text-faint">Try clearing search, subject, or type.</p>
                </div>
              ) : filteredTemplates.map(template => {
                const sub = getSubjectById(template.subject_id ?? 0)
                return (
                  <div key={template.id} className="bg-panel border border-line rounded-card p-4 shadow-card hover:shadow-float transition-shadow group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <SubjectDot color={(sub as any)?.color ?? '#8B7355'} size={8} />
                        <span className="text-[11.5px] text-muted truncate">{sub?.name ?? 'No subject'}</span>
                      </div>
                      <Pill variant={statusToPillVariant(template.assignment_type)}>
                        {TYPE_LABELS[template.assignment_type] ?? template.assignment_type}
                      </Pill>
                    </div>
                    <h3 className="font-semibold text-[14px] text-ink tracking-[-0.01em] mb-1">{template.name}</h3>
                    {template.description && (
                      <p className="text-[12.5px] text-faint line-clamp-2 mb-3">{template.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-line-2">
                      <div className="flex items-center gap-3 text-[12px] text-muted font-mono tabular-nums">
                        <span>{template.max_points ?? '—'} pts</span>
                        {template.estimated_duration_minutes && <span>{template.estimated_duration_minutes}m</span>}
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleAssignTemplate(template)} className="h-[28px] px-2.5 border border-btn-border bg-panel rounded-[7px] text-[12px] font-semibold text-ink hover:bg-track transition-colors">Assign</button>
                        <button onClick={() => handleEditTemplate(template)} className="h-[28px] px-2.5 border border-btn-border bg-panel rounded-[7px] text-[12px] font-semibold text-ink hover:bg-track transition-colors">Edit</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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

      {/* Quick Assign Modal */}
      {showQuickAssignModal && (
        <QuickAssignModal
          isOpen={showQuickAssignModal}
          onClose={() => setShowQuickAssignModal(false)}
          onSuccess={() => { setShowQuickAssignModal(false); refetch() }}
        />
      )}

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

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && deletingTemplate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Assignment Template</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <span className="font-semibold">"{deletingTemplate.name}"</span>? This action cannot be undone.
              {deletingTemplate.total_assigned && deletingTemplate.total_assigned > 0 && (
                <span className="block mt-3 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-200 font-medium">
                  ⚠️ Warning: This template is currently assigned to {deletingTemplate.total_assigned} student(s).
                </span>
              )}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingTemplate(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm hover:shadow-md transition-all duration-200"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Archive Confirmation Modal */}
      {showArchiveConfirm && archivingTemplate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l6 6 6-6" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive Assignment Template</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to archive <span className="font-semibold">"{archivingTemplate.name}"</span>? This will hide it from the assignment creation list but preserve existing assignments.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false)
                  setArchivingTemplate(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmArchive}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 shadow-sm hover:shadow-md transition-all duration-200"
              >
                Archive Template
              </button>
            </div>
          </div>
        </div>
      )}

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

export default Assignments
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
 * The student's Assignments page body. Defaults to the actionable "To do"
 * tab, sectioned by urgency so the top of the page always answers "what
 * should I be working on?". Submitted work waits in its own tab; graded and
 * excused work lands in Done, scoped to the current term by default.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { assignmentsApi } from '../../services/assignments'
import { termsApi } from '../../services/terms'
import { useAssignments } from '../../hooks/useAssignments'
import { useAssignmentFilters } from '../../hooks/useAssignmentFilters'
import StudentAssignmentCard from './StudentAssignmentCard'
import SubmissionDialog from './SubmissionDialog'
import AssignmentDetailModal from './AssignmentDetailModal'
import StudentCreatedAssignmentEditor from './StudentCreatedAssignmentEditor'
import { useAssignmentTypes } from '../../contexts/AssignmentTypesContext'
import { StudentAssignment, Term } from '../../types'
import {
  StudentTab,
  URGENCY_LABELS,
  URGENCY_ORDER,
  UrgencyGroup,
  bucketTab,
  inTerm,
  urgencyGroup,
} from '../../utils/studentAssignments'

const TABS: { key: StudentTab; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'done', label: 'Done' },
]

const EMPTY_COPY: Record<StudentTab, { title: string; hint: string }> = {
  todo: { title: "You're all caught up!", hint: 'New work from your teacher will appear here.' },
  submitted: { title: 'Nothing waiting on a grade', hint: 'Work you submit shows up here until it is graded.' },
  done: { title: 'No finished work yet', hint: 'Graded assignments will collect here.' },
}

const StudentAssignmentsView: React.FC = () => {
  const { user } = useAuth()
  const { types: assignmentTypes } = useAssignmentTypes()

  const [activeTab, setActiveTab] = useState<StudentTab>('todo')
  // undefined = defaulting to the active term once terms load; null = "All terms"
  const [selectedTerm, setSelectedTerm] = useState<number | null | undefined>(undefined)
  const [terms, setTerms] = useState<Term[]>([])

  const { searchTerm, setSearchTerm, selectedSubject, setSelectedSubject, filterStudentAssignments } =
    useAssignmentFilters()

  const { studentAssignments, subjects, loading, error, refetch, setError } = useAssignments({
    isAdmin: false,
    adminViewMode: 'grading',
    selectedSubject,
  })

  const [submittingAssignment, setSubmittingAssignment] = useState<StudentAssignment | null>(null)
  const [detailAssignmentId, setDetailAssignmentId] = useState<number | null>(null)
  const [editingOwn, setEditingOwn] = useState<StudentAssignment | 'new' | null>(null)

  useEffect(() => {
    termsApi
      .getAll()
      .then(termsData => {
        setTerms(termsData || [])
        const activeTerm = termsData?.find(t => t.is_active)
        if (activeTerm) setSelectedTerm(prev => (prev === undefined ? activeTerm.id : prev))
      })
      .catch(() => {})
  }, [])

  // ── Handlers ──
  const handleStart = async (assignmentId: number) => {
    try {
      await assignmentsApi.startAssignment(assignmentId)
      refetch()
    } catch {
      setError('Failed to start assignment')
    }
  }

  const handleComplete = (assignment: StudentAssignment) => {
    if (assignment.status === 'in_progress') setSubmittingAssignment(assignment)
  }

  const handleSubmit = async (submissionData: { submission_notes?: string; submission_artifacts?: string[] }) => {
    if (!submittingAssignment) return
    try {
      await assignmentsApi.updateStudentAssignment(submittingAssignment.id, {
        status: 'submitted',
        ...submissionData,
      })
      setSubmittingAssignment(null)
      refetch()
    } catch {
      setError('Failed to submit assignment')
    }
  }

  // ── Bucketing ──
  const searched = filterStudentAssignments(studentAssignments)

  const tabCounts = useMemo(() => {
    const counts: Record<StudentTab, number> = { todo: 0, submitted: 0, done: 0 }
    for (const a of searched) counts[bucketTab(a)]++
    return counts
  }, [searched])

  const visible = useMemo(() => {
    let list = searched.filter(a => bucketTab(a) === activeTab)
    if (activeTab === 'done' && selectedTerm) {
      const term = terms.find(t => t.id === selectedTerm)
      if (term) list = list.filter(a => inTerm(a, term))
    }
    return list
  }, [searched, activeTab, selectedTerm, terms])

  // To-do tab: section by urgency, preserving the API's due-date ordering.
  const todoSections = useMemo(() => {
    if (activeTab !== 'todo') return []
    const groups = new Map<UrgencyGroup, StudentAssignment[]>()
    for (const a of visible) {
      const g = urgencyGroup(a)
      groups.set(g, [...(groups.get(g) ?? []), a])
    }
    return URGENCY_ORDER.filter(g => groups.has(g)).map(g => ({
      group: g,
      assignments: groups.get(g)!,
    }))
  }, [activeTab, visible])

  const getSubjectById = (id: number) => subjects.find(s => s.id === id)

  const renderCards = (assignments: StudentAssignment[]) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {assignments.map(assignment => (
        <StudentAssignmentCard
          key={assignment.id}
          assignment={assignment}
          subject={assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined}
          isAdmin={false}
          onStart={handleStart}
          onComplete={handleComplete}
          onView={a => setDetailAssignmentId(a.id)}
          onEditSelf={setEditingOwn}
        />
      ))}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  const hasFilters = !!(searchTerm || selectedSubject)

  return (
    <>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      )}

      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setEditingOwn('new')}
          className="h-[44px] px-3.5 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[13px] font-semibold hover:opacity-90 sm:h-[34px]"
        >
          + Add your own assignment
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {TABS.map(tab => {
          const count = tabCounts[tab.key]
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`h-[44px] px-3.5 text-[13px] font-semibold rounded-[8px] flex items-center gap-1.5 transition-colors sm:h-[34px] ${
                isActive
                  ? 'bg-ink text-btn-primary-fg'
                  : 'bg-panel border border-line text-muted hover:text-ink hover:bg-track'
              }`}
            >
              {tab.label}
              {count > 0 && (
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
        <div className="relative flex-1 min-w-[220px] max-w-[320px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search assignments…"
            aria-label="Search assignments"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 h-[44px] sm:h-[38px] bg-field-bg border border-field-border rounded-[9px] text-[13.5px] text-ink placeholder:text-faintest focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
        <select
          aria-label="Filter assignments by subject"
          value={selectedSubject ?? ''}
          onChange={e => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
          className="h-[44px] px-3 pr-8 sm:h-[38px] bg-field-bg border border-field-border rounded-[9px] text-[13.5px] text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        >
          <option value="">All subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {activeTab === 'done' && terms.length > 0 && (
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

      {/* Body */}
      {visible.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-[15px] font-semibold text-ink-2 mb-1">
            {hasFilters ? 'No assignments match your filters' : EMPTY_COPY[activeTab].title}
          </p>
          <p className="text-[13px] text-faint">
            {hasFilters ? 'Try clearing your filters.' : EMPTY_COPY[activeTab].hint}
          </p>
        </div>
      ) : activeTab === 'todo' ? (
        <div className="space-y-7">
          {todoSections.map(({ group, assignments }) => (
            <section key={group}>
              <h2
                className={`text-[11px] font-semibold uppercase tracking-[.08em] mb-3 flex items-center gap-1.5 ${
                  group === 'overdue' ? 'text-neg-fg' : group === 'today' ? 'text-accent' : 'text-faint'
                }`}
              >
                {URGENCY_LABELS[group]}
                <span className="font-mono">({assignments.length})</span>
              </h2>
              {renderCards(assignments)}
            </section>
          ))}
        </div>
      ) : (
        renderCards(visible)
      )}

      {/* Modals */}
      {submittingAssignment && (
        <SubmissionDialog
          assignment={submittingAssignment}
          isOpen={!!submittingAssignment}
          onClose={() => setSubmittingAssignment(null)}
          onSubmit={handleSubmit}
          loading={false}
        />
      )}

      {detailAssignmentId !== null && (
        <AssignmentDetailModal
          assignmentId={detailAssignmentId}
          studentId={user?.id}
          isOpen={detailAssignmentId !== null}
          onClose={() => setDetailAssignmentId(null)}
        />
      )}

      {editingOwn && (
        <StudentCreatedAssignmentEditor
          assignment={editingOwn === 'new' ? null : editingOwn}
          subjects={subjects}
          assignmentTypes={assignmentTypes}
          onClose={() => setEditingOwn(null)}
          onSaved={() => { setEditingOwn(null); refetch() }}
        />
      )}
    </>
  )
}

export default StudentAssignmentsView

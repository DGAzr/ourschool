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
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { todayISO } from '../utils/dates'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'
import { useIsMobile } from '../hooks/useMediaQuery'
import {
  SegmentedControl,
  StatTile,
  Pill,
  SubjectDot,
  statusToPillVariant,
  useToast,
  EmptyState,
  ActionMenu,
} from '../components/ui'
import type { ActionMenuEntry } from '../components/ui'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import GradeForm, { GradeDraft } from '../components/assignments/GradeForm'
import AssignedAssignmentEditor from '../components/assignments/AssignedAssignmentEditor'
import AssignmentTimeLog from '../components/assignments/AssignmentTimeLog'
import {
  AssignmentInfo,
  SubmissionCard,
} from '../components/assignments/AssignmentInfo'
import { StudentAssignment, Term } from '../types'
import { formatDateOnly } from '../utils/formatters'
import { termsApi } from '../services/terms'
import { getErrorMessage } from '../services/api'

import PageNavigation from '../components/assignments/PageNavigation'
import { useAssignmentDetail } from '../hooks/useAssignmentDetail'

type Subject = { id: number; name: string; color?: string }
type Student = { id: number; first_name: string; last_name: string }

import {
  savedReviewFilter,
  saveReviewFilter,
  isReviewFilter,
} from '../utils/dashboard'
import { ReviewFilter } from '../types/dashboard'
import { useRecoverableDraft } from '../hooks/useRecoverableDraft'
import DraftRecovery from '../components/ui/DraftRecovery'

interface QueuePanelProps {
  needsGradingCount: number
  overdueCount: number
  awaitingCount: number
  queueFilter: ReviewFilter | 'all'
  setQueueFilter: (v: ReviewFilter | 'all') => void
  selectedSubject: number | null
  setSelectedSubject: (v: number | null) => void
  selectedStudent: number | null
  setSelectedStudent: (v: number | null) => void
  subjects: Subject[]
  students: Student[]
  queueItems: StudentAssignment[]
  selectedAssignmentId: number | undefined
  getSubjectById: (id: number) => Subject | undefined
  onSelect: (id: number) => void
}

const QueuePanel: React.FC<QueuePanelProps> = ({
  needsGradingCount,
  overdueCount,
  awaitingCount,
  queueFilter,
  setQueueFilter,
  selectedSubject,
  setSelectedSubject,
  selectedStudent,
  setSelectedStudent,
  subjects,
  students,
  queueItems,
  selectedAssignmentId,
  getSubjectById,
  onSelect,
}) => (
  <div className="bg-panel border border-line rounded-card flex flex-col min-h-0 h-full">
    <div className="flex-none p-3 border-b border-line-3">
      <SegmentedControl
        segments={[
          { value: 'review', label: 'Combined' },
          { value: 'needs', label: 'Submitted', count: needsGradingCount },
          { value: 'overdue', label: 'Overdue', count: overdueCount },
          { value: 'awaiting', label: 'Awaiting', count: awaitingCount },
          { value: 'all', label: 'All' },
        ]}
        value={queueFilter}
        onChange={setQueueFilter}
        className="w-full"
      />
    </div>

    <div className="flex-none px-2 pt-2 pb-1 flex gap-2">
      <select
        aria-label="Filter grading queue by subject"
        value={selectedSubject ?? ''}
        onChange={(e) =>
          setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)
        }
        className="flex-1 h-[44px] sm:h-[30px] px-2 bg-field-bg border border-field-border rounded-field text-[12px] text-ink focus:outline-none"
      >
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter grading queue by student"
        value={selectedStudent ?? ''}
        onChange={(e) =>
          setSelectedStudent(e.target.value ? parseInt(e.target.value) : null)
        }
        className="flex-1 h-[44px] sm:h-[30px] px-2 bg-field-bg border border-field-border rounded-field text-[12px] text-ink focus:outline-none"
      >
        <option value="">All students</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
        ))}
      </select>
    </div>

    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {queueItems.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center gap-3 text-center text-faint">
          <div className="w-11 h-11 rounded-[11px] border-2 border-dashed border-check-border" />
          <div>
            <p className="text-[14px] font-semibold text-ink-2 mb-0.5">All caught up</p>
            <p className="text-[12.5px]">Nothing in this queue right now.</p>
          </div>
        </div>
      ) : (
        queueItems.map((a) => {
          const stu = students.find((s) => s.id === a.student_id)
          const sub = a.template?.subject_id ? getSubjectById(a.template.subject_id) : undefined
          const isSelected = a.id === selectedAssignmentId
          return (
            <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`w-full text-left p-3 rounded-[11px] border transition-colors font-[inherit] ${
              isSelected
                ? 'border-accent bg-accent-soft'
                : 'border-line-3 bg-panel hover:bg-track'
            }`}
          >
              <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 min-w-0">
                <SubjectDot color={sub?.color ?? '#74716A'} size={8} />
                <span className="font-semibold text-[13.5px] text-ink truncate">
                  {stu ? `${stu.first_name} ${stu.last_name}` : 'Student'}
                </span>
              </span>
              <Pill variant={statusToPillVariant(a.status)}>
                {a.status.replace('_', ' ')}
              </Pill>
            </div>
              <div className="text-[13px] text-ink-2 mt-1.5 truncate">{a.template?.name ?? '—'}</div>
              <div className="flex items-center justify-between mt-1.5 text-[11.5px] text-faint">
                <span>{sub?.name ?? '—'}</span>
                {a.due_date && (
                  <span className="font-mono">
                    Due{' '}
                    {formatDateOnly(a.due_date, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </button>
          )
        })
      )}
    </div>
  </div>
)

interface DetailPanelProps {
  draft?: GradeDraft
  onDraftChange: (id: number, draft: GradeDraft) => void
  selectedAssignment: StudentAssignment | undefined
  students: Student[]
  getSubjectById: (id: number) => Subject | undefined
  queueIds: number[]
  onSaveGrade: (
    points: number,
    feedback: string,
    advance: boolean,
  ) => Promise<boolean>
  saving: boolean
  isMobile: boolean
  onBack: () => void
  actions?: React.ReactNode
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  draft,
  onDraftChange,
  selectedAssignment,
  students,
  getSubjectById,
  queueIds,
  onSaveGrade,
  saving,
  isMobile,
  onBack,
  actions,
}) => {
  const [editing, setEditing] = useState(false)
  // Reset edit mode whenever the selected assignment changes (derive during render
  // rather than in an effect, so no stale editing carries across assignments).
  const [editingFor, setEditingFor] = useState<number | undefined>(
    selectedAssignment?.id,
  )
  if (editingFor !== selectedAssignment?.id) {
    setEditingFor(selectedAssignment?.id)
    setEditing(false)
  }

  return (
    <div className="bg-panel border border-line rounded-card flex flex-col min-h-0 overflow-y-auto">
      {!selectedAssignment ? (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-10 py-16 text-faint">
        <div className="w-12 h-12 rounded-[12px] border-2 border-dashed border-check-border" />
        <div>
          <p className="text-[15px] font-semibold text-ink-2 mb-1">Pick a submission to grade</p>
          <p className="text-[13px] max-w-[280px] leading-relaxed">
            Select from the queue and grade right here — Save &amp; next moves you to the following one.
          </p>
        </div>
      </div>
    ) : (
        (() => {
          const stu = students.find(
            (s) => s.id === selectedAssignment.student_id,
          )
          const sub = selectedAssignment.template?.subject_id
        ? getSubjectById(selectedAssignment.template.subject_id)
        : undefined
          const maxPts = selectedAssignment.custom_max_points ?? selectedAssignment.template?.max_points ?? 100
          const curIdx = queueIds.indexOf(selectedAssignment.id)
          const hasNext = curIdx >= 0 && curIdx < queueIds.length - 1
          const queuePosition = curIdx >= 0 ? { index: curIdx, total: queueIds.length } : undefined
          const submittedWork = (
            <>
              {selectedAssignment.submission_method === 'paper' && (
                <p className="rounded-card bg-accent-soft p-3 text-sm font-semibold">Finished on paper · review the original work with the student.</p>
              )}
              <SubmissionCard notes={selectedAssignment.submission_notes} artifacts={selectedAssignment.submission_artifacts} />
              {selectedAssignment.student_notes && (
                <div className="bg-panel-2 rounded-card p-4"><h3 className="font-semibold text-ink">Student working notes</h3><p className="whitespace-pre-wrap text-sm text-muted mt-2">{selectedAssignment.student_notes}</p></div>
              )}
              <AssignmentInfo collapsible description={selectedAssignment.template?.description} instructions={selectedAssignment.template?.instructions} customInstructions={selectedAssignment.custom_instructions} />
              <details className="bg-panel-2 border border-line rounded-card p-4">
                <summary className="text-[12px] font-semibold text-ink cursor-pointer">
                  Work sessions · {selectedAssignment.time_spent_minutes ?? 0}{' '}
                  min logged
                </summary>
                <div className="mt-3"><AssignmentTimeLog assignment={selectedAssignment} onTotalChanged={() => {}} /></div>
              </details>
            </>
          )

          return (
            <div className="p-6 space-y-5">
              {isMobile && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-accent -mt-1 mb-1"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to queue
            </button>
          )}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[12.5px] text-muted mb-1.5">
                    {sub && (
                      <SubjectDot color={sub?.color ?? '#74716A'} size={9} />
                    )}
                    <span>{sub?.name ?? 'Assignment'}</span>
                    <span className="text-check-border">·</span>
                    <span>{selectedAssignment.template?.assignment_type ?? 'Assignment'}</span>
                  </div>
                  <h2 className="text-[20px] font-bold text-ink tracking-[-0.01em] leading-snug">
                {selectedAssignment.template?.name ?? 'Assignment'}
              </h2>
                  {selectedAssignment.is_student_created && (
                    <span className="inline-flex mt-1 px-2 py-0.5 rounded-pill bg-accent-soft text-accent text-[10px] font-semibold uppercase tracking-wide">Student created</span>
                  )}
                  <div className="mt-1.5 text-[13.5px] text-muted">
                    {stu ? `${stu.first_name} ${stu.last_name}` : ''}
                    {selectedAssignment.submitted_date && (
                      <>
                        {' '}
                        · submitted{' '}
                        {formatDateOnly(selectedAssignment.submitted_date, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-none">
              <Pill variant={statusToPillVariant(selectedAssignment.status)}>
                {selectedAssignment.status.replace('_', ' ')}
              </Pill>
              {actions}
            </div>
              </div>

              {selectedAssignment.is_graded && !editing ? (
            <div className="space-y-4">
              {submittedWork}
            <div className="bg-pos-bg border border-pos-fg/20 rounded-card p-4">
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.05em] mb-1">Grade recorded</p>
              <p className="font-mono text-[22px] font-semibold text-pos-fg">
                {selectedAssignment.points_earned} / {maxPts}
                {selectedAssignment.letter_grade && (
                  <span className="ml-2 text-[16px]">({selectedAssignment.letter_grade})</span>
                )}
              </p>
              {selectedAssignment.teacher_feedback && (
                <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">{selectedAssignment.teacher_feedback}</p>
              )}
              <button
                onClick={() => setEditing(true)}
                className="mt-3 h-[30px] px-3 border border-btn-border bg-panel rounded-[7px] text-[12.5px] font-semibold text-ink hover:bg-track transition-colors"
              >
                Edit grade
              </button>
            </div>
            </div>
          ) : (
                <GradeForm
                  key={editing ? `${selectedAssignment.id}-edit` : selectedAssignment.id}
                  draft={draft}
                  onDraftChange={(next) =>
                    onDraftChange(selectedAssignment.id, next)
                  }
                  work={submittedWork}
                  maxPoints={maxPts}
                  initialPoints={editing ? selectedAssignment.points_earned : undefined}
                  initialFeedback={editing ? (selectedAssignment.teacher_feedback ?? '') : ''}
                  hasNext={hasNext}
                  queuePosition={queuePosition}
                  saving={saving}
                  onSave={(points, feedback, advance) => {
                    void onSaveGrade(points, feedback, advance).then(
                      (saved) => {
                        if (saved) setEditing(false)
                      },
                    )
                  }}
                />
              )}
            </div>
          )
        })()
      )}
    </div>
  )
}

const Grading: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isMobile = useIsMobile()

  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryId = Number(searchParams.get('assignmentId'))
  const incomingId: number | undefined = Number.isSafeInteger(queryId) && queryId > 0
    ? queryId : (location.state as { assignmentId?: number } | null)?.assignmentId

  const rawQueue = searchParams.get('queue')
  const queueFilter: ReviewFilter | 'all' =
    isReviewFilter(rawQueue) || rawQueue === 'all'
      ? rawQueue
      : savedReviewFilter(user?.id)
  const setQueueFilter = (value: ReviewFilter | 'all') => {
    if (isReviewFilter(value)) saveReviewFilter(user?.id, value)
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('queue', value)
        next.delete('assignmentId')
        return next
      },
      { replace: true },
    )
  }
  const [selection, setSelection] = useState({
    locationKey: location.key,
    id: incomingId ?? (null as number | null),
  })
  const selectedQueueId =
    selection.locationKey === location.key ? selection.id : (incomingId ?? null)
  const setSelectedQueueId = (id: number | null) => {
    setSelection({ locationKey: location.key, id })
    setSearchParams(
      (previous) => {
      const next = new URLSearchParams(previous)
      if (id) next.set('assignmentId', String(id))
      else next.delete('assignmentId')
      return next
    },
      { replace: true },
    )
  }
  const [mobileView, setMobileView] = useState<'queue' | 'detail'>(
    incomingId ? 'detail' : 'queue',
  )
  const [drafts, setDrafts] = useState<Record<number, GradeDraft>>({})
  const recoverable = useRecoverableDraft('grading', drafts, setDrafts)
  const updateDraft = (id: number, draft: GradeDraft) =>
    setDrafts((previous) => ({ ...previous, [id]: draft }))
  const [saving, setSaving] = useState(false)
  const [activeTerm, setActiveTerm] = useState<Term | null>(null)
  const [unassigning, setUnassigning] = useState<StudentAssignment | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<StudentAssignment | null>(null)

  useEffect(() => {
    termsApi.getActive().then(setActiveTerm).catch(() => {})
  }, [])

  const {
    selectedSubject,
    setSelectedSubject,
    selectedStudent,
    setSelectedStudent,
  } = useAssignmentFilters()

  const {
    allAssignments,
    subjects,
    students,
    loading,
    error,
    refetch, counts, pagination, pageKey,
  } = useAssignments({
    isAdmin,
    adminViewMode: 'grading',
    selectedSubject,
    studentId: selectedStudent,
    tab: queueFilter,
    dueTo: searchParams.get('due_to') ?? undefined,
    effectiveDue: searchParams.get('effective_due') === 'true',
    activeStudents: searchParams.get('active_students') === 'true',
    includeUndated: searchParams.get('include_undated') === 'true',
    today: searchParams.get('today') ?? todayISO(),
  })

  const { toast } = useToast()

  const getSubjectById = (id: number) => subjects.find((s) => s.id === id)

  const needsGradingCount = counts.needs ?? 0
  const overdueCount = counts.overdue ?? 0
  const awaitingCount = counts.awaiting ?? 0
  const awaitingSubmission = counts.awaiting_submission ?? 0

  const termDateRange = activeTerm
    ? `${formatDateOnly(activeTerm.start_date, { month: 'short', day: 'numeric' })} – ${formatDateOnly(activeTerm.end_date, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null

  const queueItems = allAssignments
  // Deep links may target a row outside the current page.
  const selectedId = selectedQueueId ?? queueItems[0]?.id
  const detail = useAssignmentDetail(selectedId, pageKey)
  const selectedAssignment = detail.data

  const queueIds = queueItems.map((q) => q.id)

  const handleSaveGrade = async (
    points: number,
    feedback: string,
    advance: boolean,
  ) => {
    if (!selectedAssignment || saving) return false
    // Capture the next id now, before the queue shifts on refetch
    const curIdx = queueIds.indexOf(selectedAssignment.id)
    const nextId = advance && curIdx >= 0 ? (queueIds[curIdx + 1] ?? null) : null
    try {
      setSaving(true)
      await assignmentsApi.gradeStudentAssignment(selectedAssignment.id, {
        points_earned: points,
        teacher_feedback: feedback,
      })
      setDrafts((previous) => {
        const next = { ...previous }
        delete next[selectedAssignment.id]
        return next
      })
      toast('Grade saved')
      if (advance) setSelectedQueueId(nextId)
      refetch()
      return true
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to save grade'), 'danger')
      return false
    } finally {
      setSaving(false)
    }
  }

  const advanceAfter = (id: number) => {
    const idx = queueIds.indexOf(id)
    return queueIds[idx + 1] ?? null
  }

  const runAssignmentAction = async (
    action: 'excuse' | 'archive' | 'unassign',
    assignment: StudentAssignment,
  ) => {
    // Capture the next id now, before the queue shifts on refetch
    const nextId = advanceAfter(assignment.id)
    try {
      if (action === 'excuse')
        await assignmentsApi.updateStudentAssignment(assignment.id, {
          status: 'excused',
        })
      if (action === 'archive') await assignmentsApi.archiveStudentAssignment(assignment.id)
      if (action === 'unassign') await assignmentsApi.deleteStudentAssignment(assignment.id)
      toast(
        action === 'excuse' ? 'Assignment excused' : action === 'archive' ? 'Assignment archived' : 'Assignment removed',
      )
      setSelectedQueueId(nextId)
      refetch()
    } catch (err) {
      toast(getErrorMessage(err, `Failed to ${action} assignment`), 'danger')
    }
  }

  const assignmentActions: React.ReactNode = selectedAssignment ? (
    <ActionMenu
      ariaLabel="Assignment actions"
      items={
        [
          {
            label: 'Edit assigned work',
            onSelect: () => setEditingAssignment(selectedAssignment),
          },
          'separator',
          ...(selectedAssignment.status !== 'excused'
            ? [
                {
                  label: 'Excuse',
                  onSelect: () => runAssignmentAction('excuse', selectedAssignment),
                },
              ]
            : []),
          {
            label: 'Archive',
            onSelect: () => runAssignmentAction('archive', selectedAssignment),
          },
          'separator',
          {
            label: 'Unassign',
            onSelect: () => setUnassigning(selectedAssignment),
            danger: true,
          },
        ] as ActionMenuEntry[]
      }
    />
  ) : undefined

  const handleSelect = (id: number) => {
    setSelectedQueueId(id)
    if (isMobile) setMobileView('detail')
  }

  if (!isAdmin) {
    return (
      <div className="py-16 text-center text-[14px] text-faint">
        Only teachers can access the grading desk.
      </div>
    )
  }

  return (
    <div
      style={{
        height: 'calc(100vh - 4rem)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 520,
      }}
    >
      <div className="flex-none mb-5">
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.08em] mb-1.5">Grading desk</p>
        <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">Grading</h1>
      </div>

      <DraftRecovery closing={recoverable.pendingClose !== null} onConfirmClose={recoverable.confirmClose} onCancelClose={recoverable.cancelClose} available={recoverable.recovery !== null} dirty={recoverable.dirty} storageError={recoverable.storageError} onResume={recoverable.resume} onDiscard={recoverable.discard} />
      {error && (
        <div className="flex-none mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
      )}

      <PageNavigation
        {...pagination}
        next={() => {
          setSelectedQueueId(null)
          pagination.next()
        }}
        previous={() => {
          setSelectedQueueId(null)
          pagination.previous()
        }}
      />
      {detail.loading && <p role="status">Loading assignment details…</p>}
      {detail.error && (
        <p role="alert" className="text-neg-fg">
          {detail.error}
        </p>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : allAssignments.length === 0 && students.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to grade yet"
          subtext="Add students, subjects, and assignments in Admin to start using the grading desk."
          action={
            <Link
              to="/admin"
              className="inline-flex items-center px-4 py-2 rounded-field bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Go to Admin
            </Link>
          }
        />
      ) : (
        <>
          {searchParams.get('due_to') && (
            <p className="text-sm text-muted mb-3">
              Showing work due through {searchParams.get('due_to')}, including
              carryover and undated work.{' '}
              <button
                className="text-accent"
                onClick={() =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    next.delete('due_to')
                    next.delete('assignmentId')
                    return next
                  })
                }
              >
                Show all dates
              </button>
            </p>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 flex-none">
            <StatTile label="Awaiting grade" value={String(needsGradingCount)} accent={needsGradingCount > 0} />
            <StatTile label="Overdue" value={String(overdueCount)} />
            <StatTile label="Awaiting submission" value={String(awaitingSubmission)} />
            <StatTile label="Current term" value={activeTerm?.name ?? '—'} sub={termDateRange ?? undefined} />
          </div>

          {/* ── Desktop: side-by-side split ── */}
          {!isMobile && (
            <div className="flex gap-4 flex-1 min-h-0">
              <div className="flex-none w-[360px] flex flex-col min-h-0">
                <QueuePanel
                  needsGradingCount={needsGradingCount}
                  overdueCount={overdueCount}
                  awaitingCount={awaitingCount}
                  queueFilter={queueFilter}
                  setQueueFilter={(value) => {
                    setSelectedQueueId(null)
                    setQueueFilter(value)
                  }}
                  selectedSubject={selectedSubject}
                  setSelectedSubject={(value) => {
                    setSelectedQueueId(null)
                    setSelectedSubject(value)
                  }}
                  selectedStudent={selectedStudent}
                  setSelectedStudent={(value) => {
                    setSelectedQueueId(null)
                    setSelectedStudent(value)
                  }}
                  subjects={subjects}
                  students={students}
                  queueItems={queueItems}
                  selectedAssignmentId={selectedAssignment?.id}
                  getSubjectById={getSubjectById}
                  onSelect={handleSelect}
                />
              </div>
              <div className="flex-1 min-h-0">
              <DetailPanel
                draft={selectedAssignment ? drafts[selectedAssignment.id] : undefined}
                onDraftChange={updateDraft}
                selectedAssignment={selectedAssignment}
                students={students}
                getSubjectById={getSubjectById}
                queueIds={queueIds}
                onSaveGrade={handleSaveGrade}
                saving={saving}
                isMobile={false}
                onBack={() => setMobileView('queue')}
                actions={assignmentActions}
              />
            </div>
            </div>
          )}

          {/* ── Mobile: drill-in — queue OR detail, full width ── */}
          {isMobile && (
            <div className="flex-1 min-h-0">
              {mobileView === 'queue' ? (
                <QueuePanel
                  needsGradingCount={needsGradingCount}
                  overdueCount={overdueCount}
                  awaitingCount={awaitingCount}
                  queueFilter={queueFilter}
                  setQueueFilter={(value) => {
                    setSelectedQueueId(null)
                    setQueueFilter(value)
                  }}
                  selectedSubject={selectedSubject}
                  setSelectedSubject={(value) => {
                    setSelectedQueueId(null)
                    setSelectedSubject(value)
                  }}
                  selectedStudent={selectedStudent}
                  setSelectedStudent={(value) => {
                    setSelectedQueueId(null)
                    setSelectedStudent(value)
                  }}
                  subjects={subjects}
                  students={students}
                  queueItems={queueItems}
                  selectedAssignmentId={selectedAssignment?.id}
                  getSubjectById={getSubjectById}
                  onSelect={handleSelect}
                />
              ) : (
              <DetailPanel
                draft={selectedAssignment ? drafts[selectedAssignment.id] : undefined}
                onDraftChange={updateDraft}
                selectedAssignment={selectedAssignment}
                students={students}
                getSubjectById={getSubjectById}
                queueIds={queueIds}
                onSaveGrade={handleSaveGrade}
                saving={saving}
                isMobile={true}
                onBack={() => setMobileView('queue')}
                actions={assignmentActions}
              />
            )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!unassigning}
        onClose={() => setUnassigning(null)}
        onConfirm={() => {
          if (unassigning) {
            runAssignmentAction('unassign', unassigning)
            setUnassigning(null)
          }
        }}
        tone="danger"
        title="Remove assignment"
        message={
          <>
            Remove{' '}
            <strong className="text-ink">"{unassigning?.template?.name ?? 'this assignment'}"</strong>{' '}
            from the student?
          </>
        }
        confirmLabel="Remove"
      />
      {editingAssignment && (
        <AssignedAssignmentEditor
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSaved={() => {
            setEditingAssignment(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}

export default Grading

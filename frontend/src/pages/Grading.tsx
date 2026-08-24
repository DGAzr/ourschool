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
import { Link, useLocation } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'
import { useIsMobile } from '../hooks/useMediaQuery'
import { SegmentedControl, StatTile, Pill, SubjectDot, statusToPillVariant, useToast, EmptyState, ActionMenu } from '../components/ui'
import type { ActionMenuEntry } from '../components/ui'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import GradeForm from '../components/assignments/GradeForm'
import AssignedAssignmentEditor from '../components/assignments/AssignedAssignmentEditor'
import AssignmentTimeLog from '../components/assignments/AssignmentTimeLog'
import { AssignmentInfo, SubmissionCard } from '../components/assignments/AssignmentInfo'
import { StudentAssignment, Term } from '../types'
import { formatDateOnly } from '../utils/formatters'
import { isOverdue } from '../utils/assignmentStatus'
import { termsApi } from '../services/terms'
import { getErrorMessage } from '../services/api'


type Subject = { id: number; name: string; color?: string }
type Student = { id: number; first_name: string; last_name: string }

interface QueuePanelProps {
  needsGradingCount: number
  overdueCount: number
  awaitingCount: number
  queueFilter: 'needs' | 'overdue' | 'awaiting' | 'all'
  setQueueFilter: (v: 'needs' | 'overdue' | 'awaiting' | 'all') => void
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
          { value: 'needs', label: 'To grade', count: needsGradingCount },
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
        value={selectedSubject ?? ''}
        onChange={e => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
        className="flex-1 h-[30px] px-2 bg-field-bg border border-field-border rounded-field text-[12px] text-ink focus:outline-none"
      >
        <option value="">All subjects</option>
        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select
        value={selectedStudent ?? ''}
        onChange={e => setSelectedStudent(e.target.value ? parseInt(e.target.value) : null)}
        className="flex-1 h-[30px] px-2 bg-field-bg border border-field-border rounded-field text-[12px] text-ink focus:outline-none"
      >
        <option value="">All students</option>
        {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
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
      ) : queueItems.map(a => {
        const stu = students.find(s => s.id === a.student_id)
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
                  Due {new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  </div>
)

interface DetailPanelProps {
  selectedAssignment: StudentAssignment | undefined
  students: Student[]
  getSubjectById: (id: number) => Subject | undefined
  queueIds: number[]
  onSaveGrade: (points: number, feedback: string, advance: boolean) => void
  saving: boolean
  isMobile: boolean
  onBack: () => void
  actions?: React.ReactNode
}

const DetailPanel: React.FC<DetailPanelProps> = ({
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
  const [editingFor, setEditingFor] = useState<number | undefined>(selectedAssignment?.id)
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
    ) : (() => {
      const stu = students.find(s => s.id === selectedAssignment.student_id)
      const sub = selectedAssignment.template?.subject_id
        ? getSubjectById(selectedAssignment.template.subject_id)
        : undefined
      const maxPts = selectedAssignment.custom_max_points ?? selectedAssignment.template?.max_points ?? 100
      const curIdx = queueIds.indexOf(selectedAssignment.id)
      const hasNext = curIdx >= 0 && curIdx < queueIds.length - 1
      const queuePosition = curIdx >= 0 ? { index: curIdx, total: queueIds.length } : undefined

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
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[12.5px] text-muted mb-1.5">
                {sub && <SubjectDot color={sub?.color ?? '#74716A'} size={9} />}
                <span>{sub?.name ?? 'Assignment'}</span>
                <span className="text-check-border">·</span>
                <span>{selectedAssignment.template?.assignment_type ?? 'Assignment'}</span>
              </div>
              <h2 className="text-[20px] font-bold text-ink tracking-[-0.01em] leading-snug">
                {selectedAssignment.template?.name ?? 'Assignment'}
              </h2>
              {selectedAssignment.is_student_created && <span className="inline-flex mt-1 px-2 py-0.5 rounded-pill bg-accent-soft text-accent text-[10px] font-semibold uppercase tracking-wide">Student created</span>}
              <div className="mt-1.5 text-[13.5px] text-muted">
                {stu ? `${stu.first_name} ${stu.last_name}` : ''}
                {selectedAssignment.submitted_date && (
                  <> · submitted {new Date(selectedAssignment.submitted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
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

          <SubmissionCard notes={selectedAssignment.submission_notes} artifacts={selectedAssignment.submission_artifacts} />

          <AssignmentInfo
            collapsible
            description={selectedAssignment.template?.description}
            instructions={selectedAssignment.template?.instructions}
            customInstructions={selectedAssignment.custom_instructions}
          />

          <div className="bg-panel-2 border border-line rounded-card p-4">
            <p className="text-[12px] font-semibold text-ink mb-3">Work sessions</p>
            <AssignmentTimeLog assignment={selectedAssignment} onTotalChanged={() => {}} />
          </div>

          {selectedAssignment.is_graded && !editing ? (
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
          ) : (
            <GradeForm
              key={editing ? `${selectedAssignment.id}-edit` : selectedAssignment.id}
              maxPoints={maxPts}
              initialPoints={editing ? selectedAssignment.points_earned : undefined}
              initialFeedback={editing ? (selectedAssignment.teacher_feedback ?? '') : ''}
              hasNext={hasNext}
              queuePosition={queuePosition}
              saving={saving}
              onSave={(points, feedback, advance) => {
                onSaveGrade(points, feedback, advance)
                setEditing(false)
              }}
            />
          )}
        </div>
      )
    })()}
  </div>
  )
}

const Grading: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isMobile = useIsMobile()

  const location = useLocation()
  const incomingId: number | undefined = (location.state as { assignmentId?: number } | null)?.assignmentId

  const [queueFilter, setQueueFilter] = useState<'needs' | 'overdue' | 'awaiting' | 'all'>(
    incomingId ? 'all' : 'needs'
  )
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(incomingId ?? null)
  const [mobileView, setMobileView] = useState<'queue' | 'detail'>(incomingId ? 'detail' : 'queue')
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
    refetch,
  } = useAssignments({
    isAdmin,
    adminViewMode: 'grading',
    selectedSubject,
  })

  const { toast } = useToast()

  const getSubjectById = (id: number) => subjects.find(s => s.id === id)

  const needsGrading = allAssignments.filter(a => a.status === 'submitted' && !a.is_graded)
  const overdueAssignments = allAssignments.filter(isOverdue)
  const awaitingAssignments = allAssignments.filter(a =>
    (a.status === 'not_started' || a.status === 'in_progress' || a.status === 'overdue') && !a.is_graded
  )
  const awaitingSubmission = allAssignments.filter(a => a.status === 'not_started' || a.status === 'in_progress').length

  const termDateRange = activeTerm
    ? `${formatDateOnly(activeTerm.start_date, { month: 'short', day: 'numeric' })} – ${formatDateOnly(activeTerm.end_date, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null

  // "All" shows every assignment; subject/student filters still apply.
  const filteredAllAssignments = allAssignments.filter(a => {
    const matchesSubject = !selectedSubject || a.template?.subject_id === selectedSubject
    const matchesStudent = !selectedStudent || a.student_id === selectedStudent
    return matchesSubject && matchesStudent
  })

  const queueItems = queueFilter === 'needs' ? needsGrading
    : queueFilter === 'overdue' ? overdueAssignments
    : queueFilter === 'awaiting' ? awaitingAssignments
    : filteredAllAssignments

  const selectedAssignment = selectedQueueId
    ? queueItems.find(a => a.id === selectedQueueId) ?? queueItems[0]
    : queueItems[0]

  const queueIds = queueItems.map(q => q.id)

  const handleSaveGrade = async (points: number, feedback: string, advance: boolean) => {
    if (!selectedAssignment) return
    // Capture the next id now, before the queue shifts on refetch
    const curIdx = queueIds.indexOf(selectedAssignment.id)
    const nextId = advance && curIdx >= 0 ? (queueIds[curIdx + 1] ?? null) : null
    try {
      setSaving(true)
      await assignmentsApi.gradeStudentAssignment(selectedAssignment.id, {
        points_earned: points,
        teacher_feedback: feedback,
      })
      toast('Grade saved')
      if (advance) setSelectedQueueId(nextId)
      refetch()
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to save grade'), 'danger')
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
      if (action === 'excuse') await assignmentsApi.updateStudentAssignment(assignment.id, { status: 'excused' })
      if (action === 'archive') await assignmentsApi.archiveStudentAssignment(assignment.id)
      if (action === 'unassign') await assignmentsApi.deleteStudentAssignment(assignment.id)
      toast(action === 'excuse' ? 'Assignment excused' : action === 'archive' ? 'Assignment archived' : 'Assignment removed')
      setSelectedQueueId(nextId)
      refetch()
    } catch (err) {
      toast(getErrorMessage(err, `Failed to ${action} assignment`), 'danger')
    }
  }

  const assignmentActions: React.ReactNode = selectedAssignment ? (
    <ActionMenu
      ariaLabel="Assignment actions"
      items={[
        { label: 'Edit assigned work', onSelect: () => setEditingAssignment(selectedAssignment) },
        'separator',
        ...(selectedAssignment.status !== 'excused'
          ? [{ label: 'Excuse', onSelect: () => runAssignmentAction('excuse', selectedAssignment) }]
          : []),
        { label: 'Archive', onSelect: () => runAssignmentAction('archive', selectedAssignment) },
        'separator',
        { label: 'Unassign', onSelect: () => setUnassigning(selectedAssignment), danger: true },
      ] as ActionMenuEntry[]}
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
    <div style={{ height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column', minHeight: 520 }}>
      <div className="flex-none mb-5">
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.08em] mb-1.5">Grading desk</p>
        <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">Grading</h1>
      </div>

      {error && (
        <div className="flex-none mb-4 px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          {error}
        </div>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 flex-none">
            <StatTile label="Awaiting grade" value={String(needsGrading.length)} accent={needsGrading.length > 0} />
            <StatTile label="Overdue" value={String(overdueAssignments.length)} />
            <StatTile label="Awaiting submission" value={String(awaitingSubmission)} />
            <StatTile label="Current term" value={activeTerm?.name ?? '—'} sub={termDateRange ?? undefined} />
          </div>

          {/* ── Desktop: side-by-side split ── */}
          <div className="hidden lg:flex gap-4 flex-1 min-h-0">
            <div className="flex-none w-[360px] flex flex-col min-h-0">
              <QueuePanel
                needsGradingCount={needsGrading.length}
                overdueCount={overdueAssignments.length}
                awaitingCount={awaitingAssignments.length}
                queueFilter={queueFilter}
                setQueueFilter={setQueueFilter}
                selectedSubject={selectedSubject}
                setSelectedSubject={setSelectedSubject}
                selectedStudent={selectedStudent}
                setSelectedStudent={setSelectedStudent}
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

          {/* ── Mobile: drill-in — queue OR detail, full width ── */}
          <div className="lg:hidden flex-1 min-h-0">
            {mobileView === 'queue' ? (
              <QueuePanel
                needsGradingCount={needsGrading.length}
                overdueCount={overdueAssignments.length}
                awaitingCount={awaitingAssignments.length}
                queueFilter={queueFilter}
                setQueueFilter={setQueueFilter}
                selectedSubject={selectedSubject}
                setSelectedSubject={setSelectedSubject}
                selectedStudent={selectedStudent}
                setSelectedStudent={setSelectedStudent}
                subjects={subjects}
                students={students}
                queueItems={queueItems}
                selectedAssignmentId={selectedAssignment?.id}
                getSubjectById={getSubjectById}
                onSelect={handleSelect}
              />
            ) : (
              <DetailPanel
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
        </>
      )}

      <ConfirmDialog
        isOpen={!!unassigning}
        onClose={() => setUnassigning(null)}
        onConfirm={() => { if (unassigning) { runAssignmentAction('unassign', unassigning); setUnassigning(null) } }}
        tone="danger"
        title="Remove assignment"
        message={<>Remove <strong className="text-ink">"{unassigning?.template?.name ?? 'this assignment'}"</strong> from the student?</>}
        confirmLabel="Remove"
      />
      {editingAssignment && (
        <AssignedAssignmentEditor
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
          onSaved={() => { setEditingAssignment(null); refetch() }}
        />
      )}
    </div>
  )
}

export default Grading

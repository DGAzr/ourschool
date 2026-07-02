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
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'
import { useIsMobile } from '../hooks/useMediaQuery'
import { SegmentedControl, StatTile, Pill, SubjectDot, statusToPillVariant, useToast } from '../components/ui'
import GradeAssignmentModal from '../components/assignments/GradeAssignmentModal'
import { StudentAssignment, Term } from '../types'
import { isPastDateOnly, formatDateOnly } from '../utils/formatters'
import { letterGrade, gradeColor } from '../utils/grading'
import { termsApi } from '../services/terms'


type Subject = { id: number; name: string; color?: string }
type Student = { id: number; first_name: string; last_name: string }

interface QueuePanelProps {
  needsGradingCount: number
  overdueCount: number
  queueFilter: 'needs' | 'overdue' | 'all'
  setQueueFilter: (v: 'needs' | 'overdue' | 'all') => void
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
                <SubjectDot color={(sub as any)?.color ?? '#74716A'} size={8} />
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

// letterGrade and gradeColor imported from src/utils/grading.ts

interface DetailPanelProps {
  selectedAssignment: StudentAssignment | undefined
  students: Student[]
  getSubjectById: (id: number) => Subject | undefined
  queueIds: number[]
  gradeInput: string
  setGradeInput: (v: string) => void
  feedbackInput: string
  setFeedbackInput: (v: string) => void
  onSaveGrade: (advance: boolean) => void
  onEditGrade: (a: StudentAssignment) => void
  isMobile: boolean
  onBack: () => void
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  selectedAssignment,
  students,
  getSubjectById,
  queueIds,
  gradeInput,
  setGradeInput,
  feedbackInput,
  setFeedbackInput,
  onSaveGrade,
  onEditGrade,
  isMobile,
  onBack,
}) => {
  const [assignmentInfoOpen, setAssignmentInfoOpen] = useState(false)

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
      const ptsNum = parseFloat(gradeInput)
      const hasPts = !isNaN(ptsNum) && gradeInput !== ''
      const pct = hasPts ? Math.round((Math.max(0, Math.min(maxPts, ptsNum)) / maxPts) * 100) : null
      const currentGradeColor = pct != null ? gradeColor(pct) : 'var(--check-border)'

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
                {sub && <SubjectDot color={(sub as any)?.color ?? '#74716A'} size={9} />}
                <span>{sub?.name ?? 'Assignment'}</span>
                <span className="text-check-border">·</span>
                <span>{selectedAssignment.template?.assignment_type ?? 'Assignment'}</span>
              </div>
              <h2 className="text-[20px] font-bold text-ink tracking-[-0.01em] leading-snug">
                {selectedAssignment.template?.name ?? 'Assignment'}
              </h2>
              <div className="mt-1.5 text-[13.5px] text-muted">
                {stu ? `${stu.first_name} ${stu.last_name}` : ''}
                {selectedAssignment.submitted_date && (
                  <> · submitted {new Date(selectedAssignment.submitted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                )}
              </div>
            </div>
            <Pill variant={statusToPillVariant(selectedAssignment.status)}>
              {selectedAssignment.status.replace('_', ' ')}
            </Pill>
          </div>

          {selectedAssignment.submission_notes && (
            <div className="bg-panel-2 border border-line-3 rounded-[11px] p-4">
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-2">Student submission</p>
              <p className="text-[13.5px] text-ink-2 leading-relaxed">{selectedAssignment.submission_notes}</p>
              {selectedAssignment.submission_artifacts && selectedAssignment.submission_artifacts.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {selectedAssignment.submission_artifacts.map((af, i) => (
                    <a key={i} href={af} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-panel border border-line rounded-[8px] text-[12.5px] text-accent hover:underline">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      {af}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {(selectedAssignment.template?.description || selectedAssignment.template?.instructions || selectedAssignment.custom_instructions) && (
            <div className="bg-panel-2 border border-line rounded-[11px] overflow-hidden">
              <button
                type="button"
                onClick={() => setAssignmentInfoOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-panel transition-colors"
              >
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide">Assignment Info</p>
                <svg
                  className={`w-4 h-4 text-muted transition-transform ${assignmentInfoOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {assignmentInfoOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
                  {selectedAssignment.template?.description && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Description</p>
                      <p className="text-[13px] text-ink whitespace-pre-wrap">{selectedAssignment.template.description}</p>
                    </div>
                  )}
                  {selectedAssignment.template?.instructions && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Instructions</p>
                      <p className="text-[13px] text-ink whitespace-pre-wrap">{selectedAssignment.template.instructions}</p>
                    </div>
                  )}
                  {selectedAssignment.custom_instructions && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Custom Instructions</p>
                      <p className="text-[13px] text-ink whitespace-pre-wrap">{selectedAssignment.custom_instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedAssignment.is_graded ? (
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
                onClick={() => onEditGrade(selectedAssignment)}
                className="mt-3 h-[30px] px-3 border border-btn-border bg-panel rounded-[7px] text-[12.5px] font-semibold text-ink hover:bg-track transition-colors"
              >
                Edit grade
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-5 flex-wrap items-end">
                <div>
                  <label htmlFor="grading-points-earned" className="block text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Points earned</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="grading-points-earned"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={maxPts}
                      value={gradeInput}
                      onChange={e => setGradeInput(e.target.value)}
                      placeholder="0"
                      className="w-[88px] h-[46px] bg-field-bg border border-field-border rounded-[10px] font-mono text-[20px] font-semibold text-center text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="font-mono text-[18px] text-faint">/ {maxPts}</span>
                  </div>
                </div>
                {pct != null && (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">Grade</span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[30px] font-semibold tracking-[-0.02em]" style={{ color: currentGradeColor }}>
                        {pct != null ? letterGrade(ptsNum, maxPts) : ''}
                      </span>
                      <span className="font-mono text-[16px] text-faint">{pct}%</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-1.5 flex-1 justify-end flex-wrap">
                  {[maxPts, Math.round(maxPts * 0.9), Math.round(maxPts * 0.8), Math.round(maxPts * 0.7)].map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setGradeInput(String(v))}
                      className="h-[32px] px-3 border border-field-border bg-panel rounded-[7px] font-mono text-[12.5px] font-semibold text-muted hover:bg-track transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="grading-feedback" className="block text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Feedback to student</label>
                <textarea
                  id="grading-feedback"
                  value={feedbackInput}
                  onChange={e => setFeedbackInput(e.target.value)}
                  rows={3}
                  placeholder="Optional — what went well, what to work on…"
                  className="w-full bg-field-bg border border-field-border rounded-[10px] px-3 py-2.5 text-[13.5px] text-ink leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1.5 border-t border-line-2">
                <button
                  onClick={() => onSaveGrade(true)}
                  disabled={!gradeInput}
                  className="h-[42px] px-5 border-none bg-btn-primary-bg text-btn-primary-fg rounded-[10px] text-[14px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                >
                  {hasNext ? 'Save & next' : 'Save & finish'}
                </button>
                <button
                  onClick={() => onSaveGrade(false)}
                  disabled={!gradeInput}
                  className="h-[42px] px-4 border border-btn-border bg-panel text-ink-2 rounded-[10px] text-[14px] font-semibold disabled:opacity-40 hover:bg-track transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <div className="flex-1" />
                {curIdx >= 0 && (
                  <span className="text-[12.5px] text-faint">
                    {curIdx + 1} of {queueIds.length} in queue
                  </span>
                )}
              </div>
            </>
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
  const incomingId: number | undefined = (location.state as any)?.assignmentId

  const [queueFilter, setQueueFilter] = useState<'needs' | 'overdue' | 'all'>(
    incomingId ? 'all' : 'needs'
  )
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(incomingId ?? null)
  const [mobileView, setMobileView] = useState<'queue' | 'detail'>(incomingId ? 'detail' : 'queue')
  const [gradeInput, setGradeInput] = useState('')
  const [feedbackInput, setFeedbackInput] = useState('')
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [gradingAssignment, setGradingAssignment] = useState<StudentAssignment | null>(null)
  const [activeTerm, setActiveTerm] = useState<Term | null>(null)

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
  const overdueAssignments = allAssignments.filter(a => a.status !== 'graded' && a.status !== 'excused' && isPastDateOnly(a.due_date))
  const awaitingSubmission = allAssignments.filter(a => a.status === 'not_started' || a.status === 'in_progress').length

  const termDateRange = activeTerm
    ? `${formatDateOnly(activeTerm.start_date, { month: 'short', day: 'numeric' })} – ${formatDateOnly(activeTerm.end_date, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null

  // "All" shows every assignment without status filtering (search/subject/student still apply)
  const filteredAllAssignments = allAssignments.filter(a => {
    const template = a.template
    const matchesSearch = !template || template.name.toLowerCase().includes('')
    const matchesSubject = !selectedSubject || template?.subject_id === selectedSubject
    const matchesStudent = !selectedStudent || a.student_id === selectedStudent
    return matchesSearch && matchesSubject && matchesStudent
  })

  const queueItems = queueFilter === 'needs' ? needsGrading
    : queueFilter === 'overdue' ? overdueAssignments
    : filteredAllAssignments

  const selectedAssignment = selectedQueueId
    ? queueItems.find(a => a.id === selectedQueueId) ?? queueItems[0]
    : queueItems[0]

  const queueIds = queueItems.map(q => q.id)

  const handleSaveGrade = async (advance: boolean) => {
    if (!selectedAssignment) return
    const pts = parseFloat(gradeInput)
    if (isNaN(pts)) return
    // Capture the next id now, before the queue shifts on refetch
    const curIdx = queueIds.indexOf(selectedAssignment.id)
    const nextId = advance && curIdx >= 0 ? (queueIds[curIdx + 1] ?? null) : null
    try {
      await assignmentsApi.gradeStudentAssignment(selectedAssignment.id, {
        points_earned: pts,
        teacher_feedback: feedbackInput,
      })
      toast('Grade saved')
      setGradeInput('')
      setFeedbackInput('')
      if (advance) setSelectedQueueId(nextId)
      refetch()
    } catch {
      toast('Failed to save grade', 'danger')
    }
  }

  const handleSelect = (id: number) => {
    setSelectedQueueId(id)
    setGradeInput('')
    setFeedbackInput('')
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
                gradeInput={gradeInput}
                setGradeInput={setGradeInput}
                feedbackInput={feedbackInput}
                setFeedbackInput={setFeedbackInput}
                onSaveGrade={handleSaveGrade}
                onEditGrade={a => { setGradingAssignment(a); setShowGradeModal(true) }}
                isMobile={false}
                onBack={() => setMobileView('queue')}
              />
            </div>
          </div>

          {/* ── Mobile: drill-in — queue OR detail, full width ── */}
          <div className="lg:hidden flex-1 min-h-0">
            {mobileView === 'queue' ? (
              <QueuePanel
                needsGradingCount={needsGrading.length}
                overdueCount={overdueAssignments.length}
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
                gradeInput={gradeInput}
                setGradeInput={setGradeInput}
                feedbackInput={feedbackInput}
                setFeedbackInput={setFeedbackInput}
                onSaveGrade={handleSaveGrade}
                onEditGrade={a => { setGradingAssignment(a); setShowGradeModal(true) }}
                isMobile={true}
                onBack={() => setMobileView('queue')}
              />
            )}
          </div>
        </>
      )}

      {showGradeModal && gradingAssignment && (
        <GradeAssignmentModal
          assignment={gradingAssignment}
          student={students.find(s => s.id === gradingAssignment.student_id)}
          onClose={() => { setShowGradeModal(false); setGradingAssignment(null) }}
          onSuccess={() => { setShowGradeModal(false); setGradingAssignment(null); refetch() }}
        />
      )}
    </div>
  )
}

export default Grading

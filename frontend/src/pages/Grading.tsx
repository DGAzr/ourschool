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
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'
import { useIsMobile } from '../hooks/useMediaQuery'
import { SegmentedControl, StatTile, Pill, SubjectDot, statusToPillVariant, useToast } from '../components/ui'
import GradeAssignmentModal from '../components/assignments/GradeAssignmentModal'
import { StudentAssignment } from '../types'
import { isPastDateOnly } from '../utils/formatters'

const Grading: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isMobile = useIsMobile()

  const [queueFilter, setQueueFilter] = useState<'needs' | 'overdue' | 'all'>('needs')
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null)
  // Mobile drill-in: 'queue' shows the list, 'detail' shows the grade panel
  const [mobileView, setMobileView] = useState<'queue' | 'detail'>('queue')
  const [gradeInput, setGradeInput] = useState('')
  const [feedbackInput, setFeedbackInput] = useState('')
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [gradingAssignment, setGradingAssignment] = useState<StudentAssignment | null>(null)

  const {
    selectedSubject,
    setSelectedSubject,
    selectedStudent,
    setSelectedStudent,
    filterGradingAssignments,
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
  const overdueAssignments = allAssignments.filter(a => a.status !== 'graded' && isPastDateOnly(a.due_date))
  const gradedCount = allAssignments.filter(a => a.is_graded).length
  const inProgressCount = allAssignments.filter(a => a.status === 'in_progress').length

  const filteredAllAssignments = filterGradingAssignments(allAssignments)

  const queueItems = queueFilter === 'needs' ? needsGrading
    : queueFilter === 'overdue' ? overdueAssignments
    : filteredAllAssignments

  const selectedAssignment = selectedQueueId
    ? queueItems.find(a => a.id === selectedQueueId) ?? queueItems[0]
    : queueItems[0]

  const handleSaveGrade = async (advance: boolean) => {
    if (!selectedAssignment) return
    const pts = parseFloat(gradeInput)
    if (isNaN(pts)) return
    try {
      await assignmentsApi.gradeStudentAssignment(selectedAssignment.id, {
        points_earned: pts,
        teacher_feedback: feedbackInput,
      })
      toast('Grade saved')
      setGradeInput('')
      setFeedbackInput('')
      refetch()
      if (advance) {
        const queueIds = queueItems.map(q => q.id)
        const curIdx = queueIds.indexOf(selectedAssignment.id)
        const next = queueIds[curIdx + 1] ?? null
        setSelectedQueueId(next)
      }
    } catch {
      toast('Failed to save grade', 'danger')
    }
  }

  if (!isAdmin) {
    return (
      <div className="py-16 text-center text-[14px] text-faint">
        Only teachers can access the grading desk.
      </div>
    )
  }

  // ── Shared sub-components ────────────────────────────────────────────────────

  /** The queue list panel — shared between desktop and mobile */
  const QueuePanel = () => (
    <div className="bg-panel border border-line rounded-card flex flex-col min-h-0 h-full">
      <div className="flex-none p-3 border-b border-line-3">
        <SegmentedControl
          segments={[
            { value: 'needs', label: 'To grade', count: needsGrading.length },
            { value: 'overdue', label: 'Overdue', count: overdueAssignments.length },
            { value: 'all', label: 'All' },
          ]}
          value={queueFilter}
          onChange={setQueueFilter}
          className="w-full"
        />
      </div>

      {/* Queue filters */}
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
          const isSelected = a.id === (selectedAssignment?.id)
          return (
            <button
              key={a.id}
              onClick={() => {
                setSelectedQueueId(a.id)
                setGradeInput('')
                setFeedbackInput('')
                if (isMobile) setMobileView('detail')
              }}
              className={`w-full text-left p-3 rounded-[11px] border transition-colors font-[inherit] ${
                isSelected
                  ? 'border-accent bg-accent-soft'
                  : 'border-line-3 bg-panel hover:bg-track'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <SubjectDot color={(sub as any)?.color ?? '#8B7355'} size={8} />
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

  /** The detail/grade panel — shared between desktop and mobile */
  const DetailPanel = () => (
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
        const maxPts = selectedAssignment.template?.max_points ?? 100
        const queueIds = queueItems.map(q => q.id)
        const curIdx = queueIds.indexOf(selectedAssignment.id)
        const hasNext = curIdx >= 0 && curIdx < queueIds.length - 1
        const ptsNum = parseFloat(gradeInput)
        const hasPts = !isNaN(ptsNum) && gradeInput !== ''
        const pct = hasPts ? Math.round((Math.max(0, Math.min(maxPts, ptsNum)) / maxPts) * 100) : null
        const letterGrade = (p: number) => {
          if (p >= 93) return 'A'; if (p >= 90) return 'A−'; if (p >= 87) return 'B+'
          if (p >= 83) return 'B'; if (p >= 80) return 'B−'; if (p >= 77) return 'C+'
          if (p >= 73) return 'C'; if (p >= 70) return 'C−'; if (p >= 67) return 'D+'
          if (p >= 63) return 'D'; if (p >= 60) return 'D−'; return 'F'
        }
        const gradeColor = pct != null
          ? pct >= 90 ? 'var(--grade-a)' : pct >= 80 ? 'var(--grade-b)' : pct >= 70 ? 'var(--grade-c)' : 'var(--grade-f)'
          : 'var(--check-border)'

        return (
          <div className="p-6 space-y-5">
            {/* Mobile back button */}
            {isMobile && (
              <button
                onClick={() => setMobileView('queue')}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-accent -mt-1 mb-1"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back to queue
              </button>
            )}
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12.5px] text-muted mb-1.5">
                  {sub && <SubjectDot color={(sub as any)?.color ?? '#8B7355'} size={9} />}
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

            {/* Student submission */}
            {selectedAssignment.submission_notes && (
              <div className="bg-panel-2 border border-line-3 rounded-[11px] p-4">
                <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-2">Student submission</p>
                <p className="text-[13.5px] text-ink-2 leading-relaxed">{selectedAssignment.submission_notes}</p>
                {selectedAssignment.submission_artifacts && selectedAssignment.submission_artifacts.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {selectedAssignment.submission_artifacts.map((af, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-panel border border-line rounded-[8px] text-[12.5px] text-ink-2">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-faint" />
                        {af}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Grade already recorded */}
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
                  onClick={() => { setGradingAssignment(selectedAssignment); setShowGradeModal(true) }}
                  className="mt-3 h-[30px] px-3 border border-btn-border bg-panel rounded-[7px] text-[12.5px] font-semibold text-ink hover:bg-track transition-colors"
                >
                  Edit grade
                </button>
              </div>
            ) : (
              /* Grade entry */
              <>
                <div className="flex gap-5 flex-wrap items-end">
                  <div>
                    <label className="block text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Points earned</label>
                    <div className="flex items-center gap-2">
                      <input
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
                        <span className="font-mono text-[30px] font-semibold tracking-[-0.02em]" style={{ color: gradeColor }}>
                          {letterGrade(pct)}
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
                  <label className="block text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1.5">Feedback to student</label>
                  <textarea
                    value={feedbackInput}
                    onChange={e => setFeedbackInput(e.target.value)}
                    rows={3}
                    placeholder="Optional — what went well, what to work on…"
                    className="w-full bg-field-bg border border-field-border rounded-[10px] px-3 py-2.5 text-[13.5px] text-ink leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1.5 border-t border-line-2">
                  <button
                    onClick={() => handleSaveGrade(true)}
                    disabled={!gradeInput}
                    className="h-[42px] px-5 border-none bg-btn-primary-bg text-btn-primary-fg rounded-[10px] text-[14px] font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                  >
                    {hasNext ? 'Save & next' : 'Save & finish'}
                  </button>
                  <button
                    onClick={() => handleSaveGrade(false)}
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

  return (
    <div style={{ height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column', minHeight: 520 }}>
      {/* Page header */}
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
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 flex-none">
            <StatTile label="Awaiting grade" value={String(needsGrading.length)} accent={needsGrading.length > 0} />
            <StatTile label="Overdue" value={String(overdueAssignments.length)} />
            <StatTile label="In progress" value={String(inProgressCount)} />
            <StatTile label="Graded" value={String(gradedCount)} />
          </div>

          {/* ── Desktop: side-by-side split (unchanged) ── */}
          <div className="hidden lg:flex gap-4 flex-1 min-h-0">
            <div className="flex-none w-[360px] flex flex-col min-h-0">
              <QueuePanel />
            </div>
            <div className="flex-1 min-h-0">
              <DetailPanel />
            </div>
          </div>

          {/* ── Mobile: drill-in — queue OR detail, full width ── */}
          <div className="lg:hidden flex-1 min-h-0">
            {mobileView === 'queue' ? (
              <QueuePanel />
            ) : (
              <DetailPanel />
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

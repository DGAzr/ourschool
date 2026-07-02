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
import { reportsApi } from '../services/reports'
import { subjectsApi } from '../services/subjects'
import { pointsApi, type StudentPoints, type AwardPreset } from '../services/points'
import { activityApi, type ActivityItem } from '../services/activity'
import { termsApi } from '../services/terms'
import { AdminReport, StudentReport, Term } from '../types'
import { Subject } from '../types/subject'
import { usePageLayout } from '../components/layouts'
import { StatTile } from '../components/ui'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import BulkAttendanceModal from '../components/BulkAttendanceModal'
import AssignmentDetailModal from '../components/assignments/AssignmentDetailModal'
import { getErrorMessage } from '../services/api'

// Quick Award Points Modal Component
interface QuickAwardModalProps {
  onClose: () => void
  onSuccess: () => void
}

const QuickAwardModal: React.FC<QuickAwardModalProps> = ({ onClose, onSuccess }) => {
  const [students, setStudents] = useState<StudentPoints[]>([])
  const [presets, setPresets] = useState<AwardPreset[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStudents()
    pointsApi.getPresets().then(setPresets).catch(() => {})
  }, [])

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const loadStudents = async () => {
    try {
      setLoadingStudents(true)
      const overview = await pointsApi.getAdminOverview()
      setStudents(overview.student_points)
    } catch (err) {
      setError('Failed to load students')
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedStudentId || !amount || !notes.trim()) {
      setError('Please fill in all fields')
      return
    }

    const pointAmount = parseInt(amount)
    if (isNaN(pointAmount) || pointAmount <= 0) {
      setError('Please enter a valid positive point amount')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await pointsApi.adjustPoints({
        student_id: parseInt(selectedStudentId),
        amount: pointAmount,
        notes: notes.trim()
      })
      
      onSuccess()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to award points'))
    } finally {
      setLoading(false)
    }
  }

  const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
  const LABEL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Quick Award Points"
      subtitle="Manually award points to a student"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={loading || loadingStudents}
            onClick={() => {
              const form = document.getElementById('quick-award-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            Award Points
          </Button>
        </>
      }
    >
      <form id="quick-award-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">{error}</div>
        )}

        <div>
          <label className={LABEL}>Student <span className="text-neg-fg normal-case">*</span></label>
          {loadingStudents ? (
            <div className="h-[38px] bg-track rounded-field animate-pulse" />
          ) : (
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className={FIELD}
              required
            >
              <option value="">Choose a student…</option>
              {students.map(s => (
                <option key={s.student_id} value={s.student_id}>{s.student_name}</option>
              ))}
            </select>
          )}
        </div>

            <div>
              <label className={LABEL}>Points to Award <span className="text-neg-fg normal-case">*</span></label>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {presets.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setAmount(String(p.amount)); setNotes(p.label) }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-[12px] font-medium text-accent hover:bg-accent/20 transition-colors"
                    >
                      <span>{p.label}</span>
                      <span className="font-semibold">+{p.amount}</span>
                    </button>
                  ))}
                </div>
              )}
              <input
                type="number"
                min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g., 10"
                className={FIELD}
                required
              />
            </div>

            <div>
              <label className={LABEL}>Reason <span className="text-neg-fg normal-case">*</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Explain why you're awarding these points…"
                rows={3}
                className={FIELD}
                required
              />
            </div>
      </form>
    </Modal>
  )
}

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { loading, setLoading } = usePageLayout({ initialLoading: true })
  const [adminReport, setAdminReport] = useState<AdminReport | null>(null)
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null)
  const [activeTerm, setActiveTerm] = useState<Term | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showRecentActivity, setShowRecentActivity] = useState(false)
  const [activityLoading, setActivityLoading] = useState(true)
  const [showAwardModal, setShowAwardModal] = useState(false)
  const [showBulkAttendanceModal, setShowBulkAttendanceModal] = useState(false)
  const [showAssignmentDetailModal, setShowAssignmentDetailModal] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  
  const isAdmin = user?.role === 'admin'

  const handleAwardSuccess = () => {
    // Could show a success message here if needed
  }

  const handleAttendanceSuccess = () => {
    // Optionally refresh dashboard data or show success message
  }

  const handleActivityClick = (activity: ActivityItem) => {
    // Check if this is an assignment-related activity and has assignment_id
    const assignmentId = activity.details?.assignment_id || activity.details?.student_assignment_id
    if (assignmentId) {
      setSelectedAssignmentId(assignmentId)
      setShowAssignmentDetailModal(true)
    }
  }

  const isAssignmentActivity = (activity: ActivityItem) => {
    // Check if this activity is assignment-related
    return activity.activity_type?.includes('assignment') || 
           activity.details?.assignment_id || 
           activity.details?.student_assignment_id ||
           activity.description?.toLowerCase().includes('assignment')
  }

  // Helper function to get subject color
  const getSubjectColor = (subjectName: string) => {
    const subject = subjects.find(s => s.name === subjectName)
    return subject?.color || '#6B7280' // Default to gray-500 if not found
  }

  // Calculate days remaining in active term
  const calculateDaysRemaining = (term: Term | null) => {
    if (!term) return null
    
    // Use date-only comparison to avoid timezone issues
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset to start of day
    
    const endDate = new Date(term.end_date)
    endDate.setHours(0, 0, 0, 0) // Reset to start of day
    
    // Calculate difference in days using date-only math
    const timeDiff = endDate.getTime() - today.getTime()
    const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24))
    
    return daysDiff
  }

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        
        if (isAdmin) {
          // Load admin data
          const [adminData, subjectsData, termData] = await Promise.all([
            reportsApi.getAdminReport(),
            subjectsApi.getAll(),
            termsApi.getActive()
          ])

          setAdminReport(adminData)
          setSubjects(subjectsData || [])
          setActiveTerm(termData)
        } else {
          // Load student data
          const [studentData, subjectsData, termData] = await Promise.all([
            reportsApi.getStudentReport(),
            subjectsApi.getAll(),
            termsApi.getActive()
          ])
          setStudentReport(studentData)
          setSubjects(subjectsData || [])
          setActiveTerm(termData)
        }
      } catch (error) {
      } finally {
        setLoading(false)
      }
    }
    
    loadDashboardData()
  }, [isAdmin])

  // Load activity data separately
  useEffect(() => {
    const loadActivityData = async () => {
      try {
        setActivityLoading(true)
        const activities = await activityApi.getDashboardActivity()
        setRecentActivity(activities || [])
      } catch (error) {
        // Fallback to empty array on error
        setRecentActivity([])
      } finally {
        setActivityLoading(false)
      }
    }
    
    if (user?.id) {
      loadActivityData()
    }
  }, [user?.id])
  
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    )
  }

  const daysRemaining = calculateDaysRemaining(activeTerm)
  const daysLabel = daysRemaining === null ? 'No term' : daysRemaining < 0 ? 'Term ended' : daysRemaining === 0 ? 'Last day' : String(daysRemaining)

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-[30px] font-medium tracking-[-0.01em] text-ink leading-tight">
            {greeting}{user?.first_name ? `, ${user.first_name}` : ''}.
          </h1>
          <p className="mt-1.5 text-muted text-[14px]">
            {todayLabel}
            {activeTerm && <> · {activeTerm.name}</>}
          </p>
        </div>
      </div>

      {/* ── Health tiles ── */}
      {isAdmin && adminReport && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatTile label="Students" value={String(adminReport.total_students ?? 0)} />
          <StatTile label="Active assignments" value={String(adminReport.active_assignments ?? 0)} />
          <StatTile label="Pending grades" value={String(adminReport.pending_grades ?? 0)} accent={(adminReport.pending_grades ?? 0) > 0} />
          <StatTile label="Avg grade" value={`${adminReport.average_grade ?? 0}%`} accent={(adminReport.average_grade ?? 0) >= 80} />
          <StatTile label="Days left in term" value={daysLabel} />
        </div>
      )}

      {!isAdmin && studentReport && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatTile label="Assignments" value={String(studentReport.total_assignments ?? 0)} />
          <StatTile label="Completed" value={String(studentReport.completed_assignments ?? 0)} accent />
          <StatTile label="In progress" value={String(studentReport.in_progress_assignments ?? 0)} />
          <StatTile label="Days left" value={daysLabel} />
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* LEFT — Activity feed */}
        <div className="bg-panel border border-line rounded-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-2">
            <h3 className="text-[15px] font-semibold text-ink">Recent activity</h3>
            {recentActivity.length > 3 && (
              <button
                onClick={() => setShowRecentActivity(!showRecentActivity)}
                className="text-[12.5px] font-semibold text-accent hover:text-ink transition-colors"
              >
                {showRecentActivity ? 'Show less' : `View all ${recentActivity.length}`}
              </button>
            )}
          </div>
          <div className="p-4 space-y-1">
            {activityLoading ? (
              <div className="py-8 text-center text-[13px] text-faint">Loading…</div>
            ) : recentActivity.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[14px] font-semibold text-ink-2 mb-1">No activity yet</p>
                <p className="text-[12.5px] text-faint">Activity will appear here as you use the system.</p>
              </div>
            ) : (showRecentActivity ? recentActivity : recentActivity.slice(0, 5)).map((activity, i) => {
              const clickable = isAssignmentActivity(activity)
              return (
                <div
                  key={i}
                  onClick={() => clickable && handleActivityClick(activity)}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-[9px] transition-colors ${
                    clickable ? 'cursor-pointer hover:bg-accent-soft' : 'hover:bg-faintest/40'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-none mt-[5px] ${clickable ? 'bg-pos-fg' : 'bg-accent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink leading-snug">{activity.description}</p>
                    <p className="text-[12px] text-faint mt-0.5">
                      {activity.student_name && `${activity.student_name} · `}{activity.time_ago}
                    </p>
                    {activity.details?.subject && (
                      <span
                        className="inline-block mt-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-white"
                        style={{ background: getSubjectColor(activity.details.subject) }}
                      >
                        {activity.details.subject}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — Quick actions + needs you */}
        <div className="flex flex-col gap-4">
          {/* Quick actions */}
          <div className="bg-panel border border-line rounded-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2">
              <h3 className="text-[15px] font-semibold text-ink">Quick actions</h3>
            </div>
            <div className="p-3 space-y-1.5">
              {isAdmin ? (
                <>
                  <button onClick={() => setShowAwardModal(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors text-left">
                    <span className="w-7 h-7 rounded-[7px] bg-acc-soft flex items-center justify-center text-[14px]">⭐</span>
                    Award points
                  </button>
                  <button onClick={() => setShowBulkAttendanceModal(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors text-left">
                    <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">📋</span>
                    Mark attendance
                  </button>
                </>
              ) : (
                <>
                  <Link to="/assignments" className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors">
                    <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">📚</span>
                    My assignments
                  </Link>
                  <Link to="/reports" className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors">
                    <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">📊</span>
                    View progress
                  </Link>
                  <Link to="/journal" className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors">
                    <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">📓</span>
                    Write in journal
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Needs you (admin: pending grades + flagged) */}
          {isAdmin && adminReport && (adminReport.pending_grades ?? 0) > 0 && (
            <div className="bg-panel border border-accent-line rounded-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-line-2">
                <h3 className="text-[15px] font-semibold text-ink">Needs you today</h3>
              </div>
              <Link
                to="/assignments?view=grading"
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-accent-soft transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-[8px] bg-neg-bg flex items-center justify-center text-[14px]">📝</span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">{adminReport.pending_grades} assignment{adminReport.pending_grades !== 1 ? 's' : ''} to grade</p>
                    <p className="text-[12px] text-faint">Submitted and waiting for feedback</p>
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-accent flex-none">Grade →</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showAwardModal && (
        <QuickAwardModal
          onClose={() => setShowAwardModal(false)}
          onSuccess={handleAwardSuccess}
        />
      )}
      <BulkAttendanceModal
        isOpen={showBulkAttendanceModal}
        onClose={() => setShowBulkAttendanceModal(false)}
        onSuccess={handleAttendanceSuccess}
      />
      {showAssignmentDetailModal && selectedAssignmentId && (
        <AssignmentDetailModal
          assignmentId={selectedAssignmentId}
          isOpen={showAssignmentDetailModal}
          onClose={() => {
            setShowAssignmentDetailModal(false)
            setSelectedAssignmentId(null)
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
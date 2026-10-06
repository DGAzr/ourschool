import RewardChoices from '../components/shop/RewardChoices'
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

import { termCalendarProgress } from '../utils/dates'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePointsStatus } from '../contexts/PointsStatusContext'
import { reportsApi } from '../services/reports'
import { subjectsApi } from '../services/subjects'
import { pointsApi, type StudentPoints } from '../services/points'
import { activityApi, type ActivityItem } from '../services/activity'
import { termsApi } from '../services/terms'
import { StudentReport, Term } from '../types'
import { Subject } from '../types/subject'
import { usePageLayout } from '../components/layouts'
import { StatTile } from '../components/ui'
import AssignmentDetailModal from '../components/assignments/AssignmentDetailModal'
import UpNextPanel from '../components/dashboard/UpNextPanel'
import ComingUpWidget from '../components/dashboard/ComingUpWidget'
import { getErrorMessage } from '../services/api'

import LearnerWins from '../components/dashboard/LearnerWins'
import TeacherDashboard from './TeacherDashboard'

const StudentDashboard: React.FC = () => {
  const { user } = useAuth()
  const { loading, error, setLoading, setError } = usePageLayout({
    initialLoading: true,
  })
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null)
  const [activeTerm, setActiveTerm] = useState<Term | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showRecentActivity, setShowRecentActivity] = useState(false)
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [activityReloadKey, setActivityReloadKey] = useState(0)
  const [showAssignmentDetailModal, setShowAssignmentDetailModal] =
    useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    number | null
  >(null)

  // Student balance and saving goal.
  const [myPoints, setMyPoints] = useState<StudentPoints | null>(null)

  const { enabled: pointsEnabled, ready: pointsReady } = usePointsStatus()
  const showPoints = pointsReady && pointsEnabled && user?.show_points !== false

  const handleActivityClick = (activity: ActivityItem) => {
    // Check if this is an assignment-related activity and has assignment_id
    const assignmentId =
      activity.details?.assignment_id || activity.details?.student_assignment_id
    if (assignmentId) {
      setSelectedAssignmentId(assignmentId)
      setShowAssignmentDetailModal(true)
    }
  }

  const isAssignmentActivity = (activity: ActivityItem) => {
    // Check if this activity is assignment-related
    return (
      activity.activity_type?.includes('assignment') ||
      activity.details?.assignment_id ||
      activity.details?.student_assignment_id ||
      activity.description?.toLowerCase().includes('assignment')
    )
  }

  // Helper function to get subject color
  const getSubjectColor = (subjectName: string) => {
    const subject = subjects.find((s) => s.name === subjectName)
    return subject?.color || '#6B7280' // Default to gray-500 if not found
  }

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load student data
        const [studentData, subjectsData, termData] = await Promise.all([
          reportsApi.getStudentReport(),
          subjectsApi.getAll(),
          termsApi.getActive(),
        ])
        setStudentReport(studentData)
        setSubjects(subjectsData || [])
        setActiveTerm(termData)
      } catch (error) {
        setError(getErrorMessage(error, 'Couldn’t load dashboard data.'))
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
    // setLoading is a stable useState setter returned by usePageLayout
  }, [reloadKey, setError, setLoading])

  // Load activity data separately
  useEffect(() => {
    const loadActivityData = async () => {
      try {
        setActivityLoading(true)
        setActivityError(null)
        const activities = await activityApi.getDashboardActivity()
        setRecentActivity(activities || [])
      } catch (error) {
        setActivityError(
          getErrorMessage(error, 'Couldn’t load recent activity.'),
        )
      } finally {
        setActivityLoading(false)
      }
    }

    if (user?.id) {
      loadActivityData()
    }
  }, [activityReloadKey, user?.id])

  useEffect(() => {
    if (!showPoints) return
    pointsApi
      .getMyBalance()
      .then(setMyPoints)
      .catch(() => setMyPoints(null))
  }, [showPoints])

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg
          className="h-6 w-6 animate-spin text-accent"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      </div>
    )
  }

  const daysRemaining = activeTerm
    ? termCalendarProgress(activeTerm.start_date, activeTerm.end_date)
        .daysRemaining
    : null
  const daysLabel =
    daysRemaining === null
      ? 'No term'
      : daysRemaining === 0
        ? 'Term ended'
        : daysRemaining === 1
          ? 'Last day'
          : String(daysRemaining)

  // Student goal progress from the enriched balance payload.
  const goalCost = myPoints?.goal_item_cost ?? null
  const goalPct =
    myPoints && goalCost
      ? Math.min(100, Math.round((myPoints.current_balance / goalCost) * 100))
      : null
  const goalRemaining =
    myPoints && goalCost
      ? Math.max(0, goalCost - myPoints.current_balance)
      : null

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[27px] font-bold tracking-[-0.02em] text-ink leading-tight">
            {greeting}
            {user?.first_name ? `, ${user.first_name}` : ''}.
          </h1>
          <p className="mt-1.5 text-muted text-[14px]">
            {todayLabel}
            {activeTerm && <> · {activeTerm.name}</>}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-field border border-danger-line bg-neg-bg px-4 py-3 text-[13px] text-neg-fg"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="min-h-[44px] rounded-field px-3 font-semibold hover:bg-neg-soft sm:min-h-[34px]"
          >
            Try again
          </button>
        </div>
      )}

      {studentReport && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatTile
            label="Assignments"
            value={String(studentReport.total_assignments ?? 0)}
          />
          <StatTile
            label="Completed"
            value={String(studentReport.completed_assignments ?? 0)}
            accent
          />
          <StatTile
            label="In progress"
            value={String(studentReport.in_progress_assignments ?? 0)}
          />
          <StatTile label="Calendar days left (incl. end)" value={daysLabel} />
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* LEFT — Up next (student) + activity feed */}
        <div className="flex flex-col gap-4">
          {
            <>
              <UpNextPanel />
              <LearnerWins />
            </>
          }
          <div className="bg-panel border border-line rounded-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-2">
              <h3 className="text-[15px] font-semibold text-ink">
                Recent activity
              </h3>
              {recentActivity.length > 3 && (
                <button
                  onClick={() => setShowRecentActivity(!showRecentActivity)}
                  className="text-[12.5px] font-semibold text-accent hover:text-ink transition-colors"
                >
                  {showRecentActivity
                    ? 'Show less'
                    : `View all ${recentActivity.length}`}
                </button>
              )}
            </div>
            <div className="p-4 space-y-1">
              {activityLoading ? (
                <div className="py-8 text-center text-[13px] text-faint">
                  Loading…
                </div>
              ) : activityError ? (
                <div role="alert" className="py-8 text-center">
                  <p className="text-[13px] font-semibold text-neg-fg">
                    {activityError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActivityReloadKey((key) => key + 1)}
                    className="mt-2 min-h-[44px] rounded-field px-3 text-[12.5px] font-semibold text-accent hover:bg-accent-soft sm:min-h-[34px]"
                  >
                    Try again
                  </button>
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[14px] font-semibold text-ink-2 mb-1">
                    No activity yet
                  </p>
                  <p className="text-[12.5px] text-faint">
                    Activity will appear here as you use the system.
                  </p>
                </div>
              ) : (
                (showRecentActivity
                  ? recentActivity
                  : recentActivity.slice(0, 5)
                ).map((activity, i) => {
                  const clickable = isAssignmentActivity(activity)
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-[9px] transition-colors ${
                        clickable
                          ? 'cursor-pointer hover:bg-accent-soft'
                          : 'hover:bg-faintest/40'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-none mt-[5px] ${clickable ? 'bg-pos-fg' : 'bg-accent'}`}
                      />
                      <div className="flex-1 min-w-0">
                        {clickable ? (
                          <button
                            type="button"
                            onClick={() => handleActivityClick(activity)}
                            className="text-left text-[13.5px] font-semibold text-ink leading-snug hover:text-accent"
                          >
                            {activity.description}
                          </button>
                        ) : (
                          <p className="text-[13.5px] font-semibold text-ink leading-snug">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-[12px] text-faint mt-0.5">
                          {activity.student_name &&
                            `${activity.student_name} · `}
                          {activity.time_ago}
                        </p>
                        {activity.details?.subject && (
                          <span
                            className="inline-block mt-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-white"
                            style={{
                              background: getSubjectColor(
                                activity.details.subject,
                              ),
                            }}
                          >
                            {activity.details.subject}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Quick actions + needs you */}
        <div className="flex flex-col gap-4">
          {/* Quick actions */}
          <div className="bg-panel border border-line rounded-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2">
              <h3 className="text-[15px] font-semibold text-ink">
                Quick actions
              </h3>
            </div>
            <div className="p-3 space-y-1.5">
              <>
                <Link
                  to="/assignments"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors"
                >
                  <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">
                    📚
                  </span>
                  My assignments
                </Link>
                {showPoints && (
                  <Link
                    to="/shop"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors"
                  >
                    <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">
                      🛍️
                    </span>
                    Points Shop
                  </Link>
                )}

                <Link
                  to="/reports"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors"
                >
                  <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">
                    📊
                  </span>
                  View progress
                </Link>
                <Link
                  to="/journal"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] text-[13.5px] font-semibold text-ink hover:bg-track transition-colors"
                >
                  <span className="w-7 h-7 rounded-[7px] bg-accent-soft flex items-center justify-center text-[14px]">
                    📓
                  </span>
                  Write in journal
                </Link>
              </>
            </div>
          </div>

          {/* Student: upcoming planned lessons */}
          <ComingUpWidget />

          {/* Student: points balance + goal progress */}
          {showPoints && myPoints && (
            <div className="bg-panel border border-line rounded-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-2">
                <h3 className="text-[15px] font-semibold text-ink">
                  My points
                </h3>
                <Link
                  to="/my-points"
                  className="text-[12.5px] font-semibold text-accent hover:text-ink transition-colors"
                >
                  View ledger
                </Link>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-bold text-ink font-mono leading-none">
                    {myPoints.current_balance.toLocaleString()}
                  </span>
                  <span className="text-[13px] text-muted font-medium">
                    pts
                  </span>
                </div>
                {myPoints.goal_item_name &&
                  goalCost != null &&
                  goalPct != null && (
                    <div className="mt-3.5">
                      <div
                        className="h-2.5 rounded-pill overflow-hidden"
                        style={{ background: 'var(--track)' }}
                      >
                        <div
                          className="h-full"
                          style={{
                            width: `${goalPct}%`,
                            background:
                              'linear-gradient(90deg, var(--accent), var(--gold))',
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[12px] text-muted">
                        Saving toward{' '}
                        <span className="font-semibold text-ink">
                          {myPoints.goal_item_name}
                        </span>
                        {' · '}
                        {goalRemaining === 0
                          ? 'Unlocked! 🎉'
                          : `${goalRemaining?.toLocaleString()} pts to go`}
                      </p>
                    </div>
                  )}
                <RewardChoices points={myPoints} onChanged={setMyPoints} />
                <Link
                  to="/shop"
                  className="inline-block mt-3 text-[12.5px] font-semibold text-accent hover:text-ink transition-colors"
                >
                  Visit the Points Shop →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
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

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  return user?.role === 'admin' ? (
    <TeacherDashboard key={user.id} />
  ) : (
    <StudentDashboard />
  )
}

export default Dashboard

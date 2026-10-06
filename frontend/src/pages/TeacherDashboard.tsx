import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePointsStatus } from '../contexts/PointsStatusContext'
import { useDashboardRead } from '../hooks/useDashboardRead'
import {
  DashboardPage,
  DashboardStudent,
  InboxCategory,
  ReviewFilter,
} from '../types/dashboard'
import { Term, User } from '../types'
import { todayISO } from '../utils/dates'
import {
  dashboardHref,
  savedReviewFilter,
  saveReviewFilter,
  isReviewFilter,
} from '../utils/dashboard'
import { assignmentsApi } from '../services/assignments'
import SetupChecklist from '../components/dashboard/SetupChecklist'
import {
  TeacherSchedule,
  TeacherPreparation,
} from '../components/dashboard/TeacherSchedule'
import TeacherInbox from '../components/dashboard/TeacherInbox'
import TeacherWorkReview from '../components/dashboard/TeacherWorkReview'
import TeacherStudents from '../components/dashboard/TeacherStudents'
import DashboardSection from '../components/dashboard/DashboardSection'
import AssignmentComposer from '../components/assignments/composer/AssignmentComposer'
import QuickAwardModal from '../components/dashboard/QuickAwardModal'
import { ActivityItem } from '../services/activity'

export default function TeacherDashboard() {
  const { user } = useAuth()
  const {
    enabled: pointsEnabled,
    ready: pointsReady,
    error: pointsError,
    refresh: retryPoints,
  } = usePointsStatus()
  const [params, setParams] = useSearchParams()
  const [today, setToday] = useState(todayISO)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const scope = params.get('scope') === 'week' ? 'week' : 'today'
  const value = Number(params.get('student_id'))
  const studentId = Number.isSafeInteger(value) && value > 0 ? value : null
  const rawFilter = params.get('queue')
  const filter = isReviewFilter(rawFilter)
    ? rawFilter
    : savedReviewFilter(user?.id)
  const allWork = params.get('all_work') === 'true'
  const rawInbox = params.get('inbox')
  const category: InboxCategory = [
    'journals',
    'approvals',
    'pickups',
    'help',
  ].includes(rawInbox ?? '')
    ? (rawInbox as InboxCategory)
    : 'all'
  const effectiveCategory =
    !pointsEnabled && ['approvals', 'pickups'].includes(category)
      ? 'all'
      : category
  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  const onFilter = (queue: ReviewFilter) => {
    saveReviewFilter(user?.id, queue)
    setParam('queue', queue)
  }
  useEffect(() => {
    const onFocus = () => {
      setToday(todayISO())
      refresh()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => setToday(todayISO()), 30000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [refresh])
  const [rosterOffset, setRosterOffset] = useState(0)
  const roster = useDashboardRead<
    DashboardPage<Pick<DashboardStudent, 'id' | 'first_name' | 'last_name'>>
  >('/dashboard/teacher/roster', { limit: 50, offset: rosterOffset }, version)
  const term = useDashboardRead<Term>('/terms/active', {}, version)
  const [showComposer, setShowComposer] = useState(false)
  const [students, setStudents] = useState<User[] | null>(null)
  const [showAward, setShowAward] = useState(false)
  const [toolbarError, setToolbarError] = useState('')
  useEffect(() => {
    if (!showComposer) return
    let cancelled = false
    assignmentsApi
      .getStudents()
      .then((rows) => {
        if (!cancelled) setStudents(rows)
      })
      .catch(() => {
        if (!cancelled)
          setToolbarError(
            'Could not load students for the assignment. Close and try again.',
          )
      })
    return () => {
      cancelled = true
    }
  }, [showComposer])
  const [showActivity, setShowActivity] = useState(false)
  const activity = useDashboardRead<{ activities: ActivityItem[] }>(
    '/dashboard/teacher/activity',
    { limit: 5, student_id: studentId },
    version,
    showActivity,
  )
  const subjects = useDashboardRead<import('../types').Subject[]>(
    '/subjects/',
    {},
    version,
    showComposer,
  )
  return (
    <div className="space-y-5 text-ink">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[27px] font-bold">
            {new Date().getHours() < 12
              ? 'Good morning'
              : new Date().getHours() < 17
                ? 'Good afternoon'
                : 'Good evening'}
            {user?.first_name ? `, ${user.first_name}` : ''}.
          </h1>
          <p className="text-sm text-muted mt-1">
            {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
            {term.data?.name ? ` · ${term.data.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            className="text-accent font-semibold min-h-[44px] inline-flex items-center"
            to={dashboardHref('/lessons', { date: today })}
          >
            Plan a lesson
          </Link>
          <button
            className="text-accent font-semibold min-h-[44px] px-2"
            onClick={() => {
              setToolbarError('')
              setShowComposer(true)
            }}
          >
            New assignment
          </button>
          {pointsReady && pointsEnabled && (
            <button
              className="text-accent font-semibold min-h-[44px] px-2"
              onClick={() => setShowAward(true)}
            >
              Award points
            </button>
          )}
        </div>
      </header>
      {pointsError && (
        <p role="alert" className="text-sm text-neg-fg">
          {pointsError}{' '}
          <button
            className="text-accent min-h-[44px]"
            onClick={() => void retryPoints()}
          >
            Retry points status
          </button>
        </p>
      )}
      <SetupChecklist />
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-1" role="group" aria-label="Dashboard period">
          {['today', 'week'].map((s) => (
            <button
              key={s}
              aria-pressed={scope === s}
              className={`px-3 min-h-[44px] rounded-field border text-sm font-semibold ${scope === s ? 'bg-accent-soft text-accent border-accent-line' : 'border-line'}`}
              onClick={() => setParam('scope', s)}
            >
              {s === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
        </div>
        <label className="text-sm">
          Student
          <select
            aria-label="Dashboard student"
            value={studentId ?? ''}
            onChange={(e) => setParam('student_id', e.target.value || null)}
            className="ml-2 bg-field-bg border border-line rounded-field px-3 min-h-[44px]"
          >
            <option value="">All active students</option>
            {studentId &&
              !roster.data?.items.some((s) => s.id === studentId) && (
                <option value={studentId}>Selected student #{studentId}</option>
              )}
            {roster.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
        </label>
        {roster.error && (
          <span role="alert" className="text-sm text-neg-fg">
            Could not load students.{' '}
            <button onClick={roster.retry}>Try again</button>
          </span>
        )}
        {!!roster.data?.has_more && (
          <button
            className="text-sm text-accent min-h-[44px]"
            onClick={() => setRosterOffset((v) => v + 50)}
          >
            More students
          </button>
        )}
        {rosterOffset > 0 && (
          <button
            className="text-sm text-accent min-h-[44px]"
            onClick={() => setRosterOffset((v) => Math.max(0, v - 50))}
          >
            Previous students
          </button>
        )}
      </div>
      <TeacherSchedule
        today={today}
        scope={scope}
        studentId={studentId}
        version={version}
        refresh={refresh}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <TeacherInbox
          studentId={studentId}
          category={effectiveCategory}
          onCategory={(value) => setParam('inbox', value)}
          version={version}
          refresh={refresh}
          pointsEnabled={pointsReady && pointsEnabled}
        />
        <TeacherWorkReview
          today={today}
          scope={scope}
          studentId={studentId}
          version={version}
          filter={filter}
          onFilter={onFilter}
          allWork={allWork}
          onAllWork={(value) => setParam('all_work', value ? 'true' : null)}
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <TeacherStudents
          today={today}
          scope={scope}
          studentId={studentId}
          version={version}
          allWork={allWork}
          onSelect={(id) => setParam('student_id', String(id))}
        />
        <TeacherPreparation
          today={today}
          studentId={studentId}
          version={version}
          refresh={refresh}
        />
      </div>
      <details
        onToggle={(e) => setShowActivity(e.currentTarget.open)}
        className="bg-panel border border-line rounded-card p-4"
      >
        <summary className="cursor-pointer font-semibold min-h-[32px]">
          Recent activity
        </summary>
        <DashboardSection title="Last seven days" {...activity}>
          <ul className="text-sm space-y-3">
            {activity.data?.activities.map((item, index) => {
              const id =
                item.details?.assignment_id ??
                item.details?.student_assignment_id
              return (
                <li key={index}>
                  {id ? (
                    <Link className="text-accent" to={`/assignments/${id}`}>
                      {item.description}
                    </Link>
                  ) : item.details?.attendance_id ? (
                    <Link
                      className="text-accent"
                      to={dashboardHref('/attendance', {
                        date: String(item.details.date),
                        student_id: Number(item.details.student_id),
                      })}
                    >
                      {item.description}
                    </Link>
                  ) : (
                    <span>{item.description}</span>
                  )}
                  <p className="text-xs text-muted">
                    {item.student_name} · {item.time_ago}
                  </p>
                </li>
              )
            })}
          </ul>
          {activity.data && !activity.data.activities.length && (
            <p className="text-sm text-muted">No recent activity.</p>
          )}
        </DashboardSection>
      </details>
      {showComposer && (
        <>
          {toolbarError || subjects.error ? (
            <div role="alert">
              {toolbarError || subjects.error}
              <button onClick={() => setShowComposer(false)}>Close</button>
            </div>
          ) : students && subjects.data ? (
            <AssignmentComposer
              mode={{ kind: 'create', showAssign: true, libraryDefault: false }}
              subjects={subjects.data}
              students={students}
              onClose={() => setShowComposer(false)}
              onSuccess={() => {
                setShowComposer(false)
                refresh()
              }}
            />
          ) : (
            <p role="status">Loading assignment editor…</p>
          )}
        </>
      )}
      {showAward && (
        <QuickAwardModal
          onClose={() => setShowAward(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  )
}

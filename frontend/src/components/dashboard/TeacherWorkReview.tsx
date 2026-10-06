import { Link } from 'react-router-dom'
import { useDashboardRead } from '../../hooks/useDashboardRead'
import { StudentAssignment } from '../../types'
import { ReviewFilter } from '../../types/dashboard'
import {
  dashboardDates,
  dashboardHref,
  reviewFilters,
} from '../../utils/dashboard'
import { formatDateOnly } from '../../utils/formatters'
import DashboardSection from './DashboardSection'

export default function TeacherWorkReview({
  today,
  scope,
  studentId,
  version,
  filter,
  onFilter,
  allWork,
  onAllWork,
}: {
  today: string
  scope: string
  studentId: number | null
  version: number
  filter: ReviewFilter
  onFilter: (filter: ReviewFilter) => void
  allWork: boolean
  onAllWork: (value: boolean) => void
}) {
  const params = {
    tab: filter,
    student_id: studentId,
    active_students: true,
    effective_due: true,
    today,
    due_to: allWork ? undefined : dashboardDates(today, scope).end,
    include_undated: true,
  }
  const read = useDashboardRead<{
    items: StudentAssignment[]
    total: number
    counts: Record<string, number>
  }>('/assignments/page', { ...params, limit: 5 }, version)
  const counts = read.data?.counts
  const href = (queue: ReviewFilter, id?: number) =>
    dashboardHref('/grading', {
      ...params,
      tab: undefined,
      queue,
      assignmentId: id,
    })
  const start = dashboardDates(today, scope).start
  return (
    <DashboardSection
      title="Work to review"
      {...read}
      tools={
        <label className="text-xs flex gap-2 items-center">
          <input
            type="checkbox"
            checked={allWork}
            onChange={(e) => onAllWork(e.target.checked)}
          />
          All ungraded work
        </label>
      }
    >
      <div className="flex flex-wrap gap-2 mb-3">
        {reviewFilters.map((f) => (
          <button
            key={f.value}
            aria-pressed={filter === f.value}
            onClick={() => onFilter(f.value)}
            className={`px-3 min-h-[40px] rounded-field text-sm border ${filter === f.value ? 'bg-accent-soft text-accent border-accent-line' : 'border-line'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {counts && (
        <>
          <Link
            className="block font-semibold text-accent mb-1"
            to={href('review')}
          >
            {counts.review} ungraded assignments
          </Link>
          <div className="flex flex-wrap gap-3 text-sm mb-3">
            <Link className="text-accent" to={href('needs')}>
              {counts.needs} submitted
            </Link>
            <Link className="text-accent" to={href('awaiting')}>
              {counts.awaiting} awaiting
            </Link>
            <Link className="text-accent" to={href('overdue')}>
              {counts.overdue} overdue · included in awaiting
            </Link>
          </div>
        </>
      )}
      <p className="text-xs text-muted mb-3">
        {allWork
          ? 'All due dates'
          : scope === 'week'
            ? 'Due through this week, including carryover'
            : 'Due today or earlier'}{' '}
        · undated work included
      </p>
      {read.data && (
        <>
          {!read.data.items.length && (
            <p className="text-sm text-muted">No work in this review queue.</p>
          )}
          <ul className="space-y-2">
            {read.data.items.map((a) => {
              const due = a.extended_due_date ?? a.due_date
              return (
                <li key={a.id}>
                  <Link
                    to={href(filter, a.id)}
                    className="block rounded-field border border-line p-3"
                  >
                    <p className="text-sm font-semibold text-accent break-words">
                      {a.template?.name}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {a.student_name ?? `Student #${a.student_id}`} ·{' '}
                      {a.subject_name} · {a.status.replace(/_/g, ' ')} ·{' '}
                      {due
                        ? `Due ${formatDateOnly(due, { month: 'short', day: 'numeric' })}${due < start ? ' · Carryover' : ''}`
                        : 'Undated work'}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Link
            className="inline-flex items-center min-h-[44px] text-sm font-semibold text-accent mt-2"
            to={href(filter)}
          >
            View all {read.data.total} in this queue →
          </Link>
        </>
      )}
    </DashboardSection>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardPage, DashboardStudent } from '../../types/dashboard'
import { useDashboardRead } from '../../hooks/useDashboardRead'
import { dashboardDates, dashboardHref } from '../../utils/dashboard'
import DashboardSection, { OffsetNavigation } from './DashboardSection'

export default function TeacherStudents({
  today,
  scope,
  studentId,
  version,
  allWork,
  onSelect,
}: {
  today: string
  scope: string
  studentId: number | null
  version: number
  allWork: boolean
  onSelect: (id: number) => void
}) {
  const [navigation, setNavigation] = useState({ key: '', offset: 0 })
  const key = `${today}:${scope}:${studentId}:${allWork}`
  const offset = navigation.key === key ? navigation.offset : 0
  const read = useDashboardRead<DashboardPage<DashboardStudent>>(
    '/dashboard/teacher/students',
    {
      today,
      scope,
      student_id: studentId,
      all_work: allWork,
      offset,
      limit: 10,
    },
    version,
  )
  const workHref = (id: number, queue: string) =>
    dashboardHref('/grading', {
      queue,
      student_id: id,
      active_students: true,
      effective_due: true,
      include_undated: true,
      today,
      due_to: allWork ? undefined : dashboardDates(today, scope).end,
    })
  return (
    <DashboardSection title="Student overview" {...read}>
      {read.data && (
        <>
          <ul className="space-y-3">
            {read.data.items.map((s) => (
              <li key={s.id} className="p-3 border border-line rounded-field">
                <button
                  className="font-semibold text-accent min-h-[36px]"
                  onClick={() => onSelect(s.id)}
                >
                  {s.first_name} {s.last_name}
                </button>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  <Link
                    to={dashboardHref('/attendance', {
                      date: today,
                      student_id: s.id,
                    })}
                    className={s.attendance ? 'text-pos-fg' : 'text-muted'}
                  >
                    {s.attendance
                      ? `Attendance: ${s.attendance}`
                      : 'Attendance not recorded'}
                  </Link>
                  <Link
                    className="text-accent"
                    to={dashboardHref('/', { student_id: s.id, scope })}
                  >
                    {s.schedule.taught ?? 0}/{s.schedule.lessons ?? 0} lessons
                    taught {scope === 'week' ? 'this week' : 'today'}
                  </Link>
                  <Link className="text-accent" to={workHref(s.id, 'needs')}>
                    {s.work.needs ?? 0} submitted
                  </Link>
                  <Link className="text-accent" to={workHref(s.id, 'awaiting')}>
                    {s.work.awaiting ?? 0} awaiting
                  </Link>
                  <Link className="text-accent" to={workHref(s.id, 'overdue')}>
                    {s.work.overdue ?? 0} overdue
                  </Link>
                  {Object.entries(s.inbox).map(([category, count]) => (
                    <Link
                      key={category}
                      className="text-accent"
                      to={dashboardHref('/', {
                        student_id: s.id,
                        scope,
                        inbox: category,
                      })}
                    >
                      {count}{' '}
                      {category === 'journals'
                        ? 'journal reviews'
                        : category === 'approvals'
                          ? 'shop approvals'
                          : category === 'pickups'
                            ? 'rewards to hand off'
                            : 'help requests'}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {!read.data.total && (
            <p className="text-sm text-muted">
              No active students in this view.
            </p>
          )}
          <OffsetNavigation
            offset={read.data.offset}
            total={read.data.total}
            hasMore={read.data.has_more}
            limit={10}
            onChange={(value) => setNavigation({ key, offset: value })}
          />
        </>
      )}
    </DashboardSection>
  )
}

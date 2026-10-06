import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CalendarDays } from 'lucide-react'
import { useDashboardRead } from '../../hooks/useDashboardRead'
import {
  DashboardLesson,
  DashboardSchedule,
  DashboardPreparation,
} from '../../types/dashboard'
import { dashboardHref } from '../../utils/dashboard'
import { formatDateOnly } from '../../utils/formatters'
import { lessonsApi } from '../../services/lessons'
import { getErrorMessage } from '../../services/api'
import { useToast } from '../ui'
import DashboardSection, { OffsetNavigation } from './DashboardSection'

function LessonRows({
  items,
  refresh,
  preparation = false,
}: {
  items: DashboardLesson[]
  refresh: () => void
  preparation?: boolean
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const { toast } = useToast()
  const action = async (id: number, run: () => Promise<unknown>) => {
    if (busy !== null) return
    setBusy(id)
    try {
      await run()
      refresh()
      toast('Lesson updated.')
    } catch (err) {
      toast(getErrorMessage(err, 'Could not update the lesson.'), 'danger')
    } finally {
      setBusy(null)
    }
  }
  return (
    <ul
      className={
        preparation ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-3'
      }
    >
      {items.map((lesson) => (
        <li key={lesson.id} className="rounded-field border border-line p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="min-w-0">
              <Link
                className="text-accent font-semibold break-words"
                to={dashboardHref('/teach', {
                  date: lesson.date,
                  lessonId: lesson.id,
                })}
              >
                {lesson.title}
              </Link>
              <p className="text-xs text-muted mt-1">
                {formatDateOnly(lesson.date, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                ·{' '}
                {lesson.students.map((s) => s.first_name).join(', ') ||
                  'All students'}
              </p>
            </div>
            <span
              className={
                lesson.status === 'taught'
                  ? 'text-pos-fg text-sm'
                  : 'text-muted text-sm'
              }
            >
              {lesson.status === 'taught'
                ? '✓ Taught'
                : lesson.status === 'ready'
                  ? 'Ready'
                  : 'Planned'}
            </span>
          </div>
          {!preparation && lesson.status !== 'taught' && (
            <button
              disabled={busy !== null}
              className="min-h-[44px] text-sm font-semibold text-accent disabled:opacity-50"
              onClick={() =>
                void action(lesson.id, () =>
                  lessonsApi.setStatus(lesson.id, 'taught'),
                )
              }
            >
              Mark taught
            </button>
          )}
          {lesson.status !== 'taught' && lesson.materials.length > 0 && (
            <fieldset className="mt-2">
              <legend className="text-xs text-muted">
                Materials ·{' '}
                {lesson.materials.filter((m) => m.is_gathered).length}/
                {lesson.materials.length} gathered
              </legend>
              {lesson.materials.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 text-sm min-h-[36px]"
                >
                  <input
                    type="checkbox"
                    checked={m.is_gathered}
                    disabled={busy !== null}
                    onChange={(e) =>
                      void action(lesson.id, () =>
                        lessonsApi.toggleMaterial(
                          lesson.id,
                          m.id,
                          e.target.checked,
                        ),
                      )
                    }
                  />
                  <span
                    className={m.is_gathered ? 'text-muted line-through' : ''}
                  >
                    {m.label}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </li>
      ))}
    </ul>
  )
}

export function TeacherSchedule({
  today,
  scope,
  studentId,
  version,
  refresh,
}: {
  today: string
  scope: string
  studentId: number | null
  version: number
  refresh: () => void
}) {
  const [navigation, setNavigation] = useState({ key: '', offset: 0 })
  const key = `${today}:${scope}:${studentId}`
  const offset = navigation.key === key ? navigation.offset : 0
  const read = useDashboardRead<DashboardSchedule>(
    '/dashboard/teacher/schedule',
    { today, scope, student_id: studentId, offset, limit: 10 },
    version,
  )
  const data = read.data
  return (
    <DashboardSection
      title={scope === 'week' ? 'This week' : 'Today'}
      {...read}
      tools={
        <Link
          className="text-sm text-accent font-semibold"
          to={dashboardHref('/lessons', { date: today, student_id: studentId })}
        >
          Open planner
        </Link>
      }
    >
      {data && (
        <>
          <Link
            to={dashboardHref('/attendance', {
              date: today,
              student_id: studentId,
            })}
            className={`block rounded-field border p-3 mb-4 ${data.attendance.recorded ? 'bg-pos-bg text-pos-fg border-[var(--pos-fg)]/20' : 'bg-panel-2 border-line'}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              {data.attendance.recorded > 0 && <Check size={16} />}Take
              attendance
            </span>
            <span className="text-sm">
              {data.attendance.recorded} of {data.attendance.total}{' '}
              {data.attendance.total === 1 ? 'student' : 'students'} recorded
              today
            </span>
          </Link>
          <p className="text-sm text-muted mb-3">
            {data.total} lessons · {data.taught} taught ·{' '}
            {data.materials_remaining} materials to gather
          </p>
          {!data.items.length && (
            <p className="text-sm text-muted flex items-center gap-2">
              <CalendarDays size={16} />
              No lessons scheduled in this view.
            </p>
          )}
          <LessonRows items={data.items} refresh={refresh} />
          <OffsetNavigation
            offset={data.offset}
            total={data.total}
            hasMore={data.has_more}
            limit={10}
            onChange={(value) => setNavigation({ key, offset: value })}
          />
          <div className="mt-4 pt-3 border-t border-line text-sm">
            <h3 className="font-semibold mb-1">Before finishing today</h3>
            <Link
              className="text-accent block min-h-[32px]"
              to={dashboardHref('/attendance', {
                date: today,
                student_id: studentId,
                unrecorded: true,
              })}
            >
              {Math.max(0, data.attendance.total - data.attendance.recorded)}{' '}
              {data.attendance.total - data.attendance.recorded === 1
                ? 'student still needs'
                : 'students still need'}{' '}
              attendance recorded
            </Link>
            <Link
              className="text-accent block min-h-[32px]"
              to={dashboardHref('/teach', {
                date: today,
                student_id: studentId,
                remaining: true,
              })}
            >
              {data.today_planned}{' '}
              {data.today_planned === 1 ? 'lesson' : 'lessons'} still marked
              planned or ready
            </Link>
          </div>
        </>
      )}
    </DashboardSection>
  )
}

export function TeacherPreparation({
  today,
  studentId,
  version,
  refresh,
}: {
  today: string
  studentId: number | null
  version: number
  refresh: () => void
}) {
  const [navigation, setNavigation] = useState({ key: '', offset: 0 })
  const key = `${today}:${studentId}`
  const offset = navigation.key === key ? navigation.offset : 0
  const read = useDashboardRead<DashboardPreparation>(
    '/dashboard/teacher/preparation',
    { today, student_id: studentId, offset, limit: 5 },
    version,
  )
  const data = read.data
  return (
    <DashboardSection title="Prepare for the next teaching day" {...read}>
      {data && (
        <>
          {data.date ? (
            <>
              <p className="text-sm text-muted mb-3">
                {formatDateOnly(data.date, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · {data.materials_remaining} materials remaining
              </p>
              <LessonRows items={data.items} refresh={refresh} preparation />
              <OffsetNavigation
                offset={data.offset}
                total={data.total}
                hasMore={data.has_more}
                limit={5}
                onChange={(value) => setNavigation({ key, offset: value })}
              />
            </>
          ) : (
            <p className="text-sm text-muted">No upcoming lessons scheduled.</p>
          )}
        </>
      )}
    </DashboardSection>
  )
}

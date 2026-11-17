import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePointsStatus } from '../contexts/PointsStatusContext'
import { useSchoolToday, useStudentDay } from '../hooks/useStudentPlan'
import { dayProgress, lessonProgress } from '../utils/studentPlan'
import { formatDateOnly } from '../utils/formatters'
import { getErrorMessage } from '../services/api'
import { pointsApi, StudentPoints } from '../services/points'
import StudentActivityRow from '../components/student/StudentActivityRow'
import StudentLessonCard from '../components/student/StudentLessonCard'
import LearnerWins from '../components/dashboard/LearnerWins'
import RewardChoices from '../components/shop/RewardChoices'
import { Button } from '../components/ui'
import { useStudentScroll } from '../hooks/useStudentScroll'

export default function StudentToday() {
  const { user } = useAuth()
  const today = useSchoolToday()
  const plan = useStudentDay(today)
  const location = useLocation()
  const from = location.pathname + location.search
  const { enabled, ready } = usePointsStatus()
  const showPoints = ready && enabled && user?.show_points !== false
  const [points, setPoints] = useState<StudentPoints | null>(null)
  useEffect(() => {
    if (!showPoints) return
    let active = true
    pointsApi.getMyBalance().then(value => { if (active) setPoints(value) }).catch(() => {})
    return () => { active = false }
  }, [showPoints])
  const simple = user?.student_ui_mode === 'simple'
  const data = plan.data
  const progress = data ? dayProgress(data) : null
  const firstOpenLesson = data?.lessons.find(lesson => !lessonProgress(lesson).complete)?.id
  useStudentScroll(!!data)
  return <div className={`student-workspace space-y-6 ${simple ? 'student-simple' : ''}`}>
    <header><p className="text-sm text-muted">{formatDateOnly(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 className="mt-1 text-[27px] font-bold text-ink">Today{user?.first_name ? `, ${user.first_name}` : ''}</h1></header>
    {plan.isPending && <p role="status">Loading your plan…</p>}
    {plan.isError && <div role="alert" className="rounded-card border border-danger-line bg-neg-bg p-4 text-neg-fg"><p>{getErrorMessage(plan.error, 'Could not load your plan.')}</p>{data && <p>Your last loaded plan is shown below. Progress may have changed.</p>}<Button variant="secondary" onClick={() => void plan.refetch()}>Try again</Button></div>}
    {data && progress && <>
      <section aria-label="Today's progress" className="space-y-3">
        <p className="font-semibold" role="status">{progress.total > 0 ? `${progress.finished} of ${progress.total} activities finished today` : progress.waiting > 0 ? 'Your activities are waiting to be assigned' : 'No activities scheduled today'}{progress.waiting > 0 ? ` · ${progress.waiting} waiting for your teacher` : ''}</p>
        {progress.total > 0 && <div role="progressbar" aria-label="Today's activities finished" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.finished} className="h-2 overflow-hidden rounded-full bg-track"><div className="h-full bg-accent" style={{ width: `${progress.finished / progress.total * 100}%` }} /></div>}
      </section>
      {!plan.isError && progress.complete && <section className="rounded-card border border-line bg-accent-soft p-4" role="status"><h2 className="text-lg font-semibold">{user?.celebrate_completion === false ? "Today's plan is finished." : "You finished today's plan!"}</h2><p>Your teacher can review the work you handed in.{data.earlier.total > 0 ? ` ${data.earlier.total} older unfinished activities are listed below.` : ''}</p><Link to="/my-lessons" className="inline-flex min-h-11 items-center font-semibold text-accent underline">See upcoming lessons</Link></section>}
      {progress.next && <section className="space-y-2" aria-label="Your next activity"><h2 className="text-lg font-semibold">Your next activity</h2><StudentActivityRow activity={progress.next} from={from} day={today} recommended /></section>}
      {data.lessons.length > 0 && <section className="space-y-3" aria-label="Today's lessons"><h2 className="text-lg font-semibold">Today's lessons</h2>{data.lessons.map(lesson => <StudentLessonCard key={lesson.id} lesson={lesson} from={from} day={today} expanded={!lessonProgress(lesson).complete && (!simple || lesson.id === firstOpenLesson)} />)}</section>}
      {data.standalone.length > 0 && <section className="rounded-card border border-line bg-panel p-4" aria-label="Other activities for today"><h2 className="text-lg font-semibold">Other activities for today</h2><p className="text-sm text-muted">Work without a scheduled lesson that is due today, or was assigned today without a deadline.</p>{data.standalone.map(activity => <StudentActivityRow key={activity.id} activity={activity} from={from} day={today} />)}</section>}
      {data.lessons.length === 0 && data.standalone.length === 0 && !plan.isError && <div className="rounded-card border border-line bg-panel p-4"><p>Your teacher hasn't scheduled a plan for today.</p><Link to="/my-lessons" className="inline-flex min-h-11 items-center font-semibold text-accent">See your lessons</Link></div>}
      {([{ name: 'Earlier unfinished work', section: data.earlier }, { name: 'Other work and projects', section: data.other }]).filter(({section}) => section.total > 0).map(({name,section}) => <details key={name} className="rounded-card border border-line bg-panel p-4" open={!simple && name === 'Other work and projects'}><summary className="min-h-11 cursor-pointer font-semibold">{name} · {section.total}</summary><p className="py-2 text-sm text-muted">These activities are outside today's plan. Check with your teacher about when to work on them.</p>{section.items.map(activity => <StudentActivityRow key={activity.id} activity={activity} from={from} day={today} />)}<Link to="/assignments" className="inline-flex min-h-11 items-center font-semibold text-accent underline">See all unfinished work</Link></details>)}
      <details className="rounded-card border border-line bg-panel p-4"><summary className="min-h-11 cursor-pointer font-semibold">Your recent work, journal{showPoints ? ', and rewards' : ', and progress'}</summary><div className="mt-3 space-y-4"><LearnerWins /><div className="flex flex-wrap gap-4"><Link to="/journal" className="inline-flex min-h-11 items-center text-accent underline">Write in your journal</Link><Link to="/reports" className="inline-flex min-h-11 items-center text-accent underline">See your progress</Link><Link to="/my-lessons" className="inline-flex min-h-11 items-center text-accent underline">See upcoming lessons</Link></div>{showPoints && points && <div className="space-y-3"><p className="font-semibold">Your reward points: {points.current_balance.toLocaleString()}</p><RewardChoices points={points} onChanged={setPoints} /><Link to="/shop" className="inline-flex min-h-11 items-center text-accent underline">Visit the Points Shop</Link></div>}</div></details>
    </>}
  </div>
}

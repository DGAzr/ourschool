import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCalendarDateParam } from '../hooks/useCalendarDateParam'
import { useSchoolToday, useStudentLesson } from '../hooks/useStudentPlan'
import { lessonsApi } from '../services/lessons'
import { addDays } from '../utils/dates'
import { formatDateOnly } from '../utils/formatters'
import { safeReturnPath } from '../utils/returnPath'
import { lessonProgress } from '../utils/studentPlan'
import { getErrorMessage } from '../services/api'
import StudentLessonCard from '../components/student/StudentLessonCard'
import { Button } from '../components/ui'
import { useStudentScroll } from '../hooks/useStudentScroll'

export default function MyLessons() {
  const { user } = useAuth()
  const { lessonId } = useParams()
  const id = lessonId && /^[1-9]\d*$/.test(lessonId) && Number.isSafeInteger(Number(lessonId)) ? Number(lessonId) : undefined
  const detail = useStudentLesson(id)
  const location = useLocation()
  const from = location.pathname + location.search
  const today = useSchoolToday()
  const [selectedDate, setSelectedDate] = useCalendarDateParam()
  const end = addDays(selectedDate, 6)
  const schedule = useQuery({
    queryKey: ['student-lessons', user?.id, selectedDate, end],
    queryFn: ({ signal }) => lessonsApi.myLessons({ start_date: selectedDate, end_date: end }, signal),
    enabled: !lessonId && user?.role === 'student',
    throwOnError: false,
  })
  const simple = user?.student_ui_mode === 'simple'
  const query = lessonId ? detail : schedule
  const lessons = lessonId ? (detail.data ? [detail.data] : []) : schedule.data ?? []
  const back = safeReturnPath(new URLSearchParams(location.search).get('from'), '/my-lessons')
  useStudentScroll(!!(lessonId ? detail.data : schedule.data))
  return <div className={`student-workspace space-y-5 ${simple ? 'student-simple' : ''}`}>
    {lessonId && <Link to={back} className="inline-flex min-h-11 items-center font-semibold text-accent">← Back to your plan</Link>}
    <h1 className="text-[27px] font-bold text-ink">{lessonId ? 'Your lesson' : 'Lessons'}</h1>
    {!lessonId && <div className="flex flex-wrap items-end gap-2"><Button variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>Previous week</Button><label className="space-y-1"><span className="block text-sm font-semibold">Week starting</span><input type="date" aria-label="Week starting" value={selectedDate} onChange={e => { if (e.target.value) setSelectedDate(e.target.value) }} className="min-h-11 max-w-full rounded-field border border-line bg-field-bg px-3 text-ink" /></label><Button variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>Next week</Button><Button variant="outline" onClick={() => setSelectedDate(today)}>Today</Button></div>}
    {lessonId && !id ? <p role="alert">Lesson not found.</p> : query.isPending ? <p role="status">Loading your lessons…</p> : <>
      {query.isError && <div role="alert" className="rounded-card bg-neg-bg p-4 text-neg-fg"><p>{getErrorMessage(query.error, 'Could not load your lessons.')}</p>{lessons.length > 0 && <p>Your last loaded lessons are shown below.</p>}<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button></div>}
      {!query.isError && lessons.length === 0 && <p>No lessons on the schedule for these dates. Try another week or check with your teacher.</p>}
      {lessons.map((lesson, index) => <section key={lesson.id} className="space-y-2">{lesson.date && <h2 className="font-semibold text-muted">{lesson.date === today ? 'Today' : formatDateOnly(lesson.date, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>}<StudentLessonCard lesson={lesson} from={from} standalone={!!lessonId} expanded={lesson.date === today && !lessonProgress(lesson).complete && (!simple || index === 0)} /></section>)}
    </>}
    {!lessonId && <Link to="/assignments" className="inline-flex min-h-11 items-center font-semibold text-accent underline">Find unfinished work from any date</Link>}
  </div>
}

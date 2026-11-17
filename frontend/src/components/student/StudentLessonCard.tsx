import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { StudentLessonDetail } from '../../types/lesson'
import { lessonProgress } from '../../utils/studentPlan'
import { useAuth } from '../../contexts/AuthContext'
import MarkdownRenderer from '../common/MarkdownRenderer'
import { Icon } from '../ui'
import StudentActivityRow from './StudentActivityRow'
import StudentResources from './StudentResources'
import ReadAloud from './ReadAloud'

export default function StudentLessonCard({ lesson, from, day, expanded = false, standalone = false }: {
  lesson: StudentLessonDetail; from: string; day?: string; expanded?: boolean; standalone?: boolean
}) {
  const { user } = useAuth()
  const simple = user?.student_ui_mode === 'simple'
  const location = useLocation()
  const openKey = `ourschool.lesson-open.${user?.id}.${lesson.id}.${from}`
  const [open, setOpen] = useState(() => {
    if (standalone || location.hash === `#lesson-${lesson.id}`) return true
    try { const saved = sessionStorage.getItem(openKey); if (saved !== null) return saved === 'true' } catch { /* Default layout. */ }
    return expanded
  })
  const progress = lessonProgress(lesson)
  const lessonHref = `/my-lessons/${lesson.id}?from=${encodeURIComponent(from)}`
  const contents = <div className="space-y-4 p-4 sm:p-5">
    {lesson.objective && <div className="space-y-2"><MarkdownRenderer content={lesson.objective} className="text-base leading-relaxed" />{simple && <ReadAloud text={`${lesson.title}. ${lesson.objective}`} />}</div>}
    {progress.instructionOnly && <p className="rounded-field bg-panel-2 p-3">{lesson.status === 'taught' ? 'Your teacher marked this lesson taught.' : 'Work with your teacher. They will mark this lesson taught when your time together is finished.'}</p>}
    <div>{progress.activities.map(activity => <StudentActivityRow key={activity.id} activity={activity} from={standalone ? location.pathname + location.search : `${from.split('#')[0]}#lesson-${lesson.id}`} day={day ?? lesson.date ?? undefined} />)}</div>
    {progress.waiting.map(link => <p key={link.id} className="rounded-field bg-panel-2 p-3">{link.template?.name ?? 'Activity'} · Waiting for your teacher to assign this</p>)}
    {(lesson.resources.length > 0 || lesson.paperless_materials.length > 0) && <section aria-label="Shared lesson materials" className="space-y-3"><h3 className="font-semibold">Shared lesson materials</h3><StudentResources materials={lesson.paperless_materials} resources={lesson.resources} /></section>}
  </div>
  const heading = <div className="min-w-0">
    <div className="flex items-center gap-2"><Icon name={lesson.subject?.icon ?? 'BookOpen'} size={simple ? 26 : 20} /><span className="font-semibold break-words">{lesson.title}</span></div>
    <p className="mt-1 text-sm text-muted">{lesson.subject?.name}{lesson.duration_minutes ? ` · About ${lesson.duration_minutes} min` : ''}</p>
    <p className="mt-1 text-sm font-semibold text-accent">{progress.instructionOnly ? (progress.complete ? 'Time with teacher finished' : 'Time with your teacher') : `${progress.finished} of ${progress.activities.length} activities finished`}{progress.waiting.length > 0 ? ` · ${progress.waiting.length} waiting for teacher` : ''}</p>
  </div>
  if (standalone) return <section className="overflow-hidden rounded-card-lg border border-line bg-panel"><div className="border-b border-line p-4 sm:p-5">{heading}</div>{contents}</section>
  return <details id={`lesson-${lesson.id}`} open={open} onToggle={event => { setOpen(event.currentTarget.open); try { sessionStorage.setItem(openKey, String(event.currentTarget.open)) } catch { /* Optional UI state. */ } }} className="overflow-hidden rounded-card-lg border border-line bg-panel">
    <summary className="flex min-h-11 cursor-pointer items-start justify-between gap-3 p-4 sm:p-5">{heading}<span className="shrink-0 text-sm text-accent">{open ? 'Hide' : 'Show'}</span></summary>
    {open && <><div className="px-4 sm:px-5"><Link to={lessonHref} className="inline-flex min-h-11 items-center font-semibold text-accent underline">Open lesson</Link></div>{contents}</>}
  </details>
}

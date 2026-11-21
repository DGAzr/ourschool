import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'
import { getErrorMessage } from '../services/api'
import { StudentAssignment } from '../types'
import { useSchoolToday, useStudentDay, useStudentLesson } from '../hooks/useStudentPlan'
import { useStudentNotes } from '../hooks/useStudentNotes'
import { assignmentProgress, effectiveDueDate, isOverdue } from '../utils/studentAssignments'
import { activityOpen, dayProgress, nextAvailableActivity, orderedActivities, workStateLabel } from '../utils/studentPlan'
import { safeReturnPath } from '../utils/returnPath'
import { isValidISODate } from '../utils/dates'
import { formatDateOnly } from '../utils/formatters'
import MarkdownRenderer from '../components/common/MarkdownRenderer'
import StudentResources from '../components/student/StudentResources'
import StudentActivityRow from '../components/student/StudentActivityRow'
import ReadAloud from '../components/student/ReadAloud'
import TaskHelp from '../components/assignments/TaskHelp'
import AssignmentTimeLog from '../components/assignments/AssignmentTimeLog'
import SubmissionDialog from '../components/assignments/SubmissionDialog'
import { Button } from '../components/ui'
import Modal from '../components/ui/Modal'
import { useStudentScroll } from '../hooks/useStudentScroll'

export default function StudentActivityWorkspace({ id }: { id: number }) {
  const { user } = useAuth()
  const query = useQuery({
    queryKey: ['student-assignment', user?.id, id],
    queryFn: () => assignmentsApi.getStudentAssignment(id),
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  })
  // Initialize the editor from a fresh server read on each visit, rather
  // than an older cached copy from before the last autosave.
  if (query.isPending || !query.isFetchedAfterMount) return <p role="status">Loading your activity…</p>
  if (query.isError || !query.data?.template) return <div role="alert" className="space-y-3"><p>{getErrorMessage(query.error, 'This activity could not be loaded.')}</p><Button onClick={() => void query.refetch()}>Try again</Button><Link to="/assignments" className="inline-flex min-h-11 items-center text-accent">Back to My Work</Link></div>
  return <ActivityContent key={`${user?.id}:${id}`} assignment={query.data} />
}

function ActivityContent({ assignment }: { assignment: StudentAssignment }) {
  useStudentScroll(true)
  const { user } = useAuth()
  const client = useQueryClient()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const lesson = useStudentLesson(assignment.lesson_id ?? undefined)
  const today = useSchoolToday()
  const explicitDay = params.get('day')
  const day = isValidISODate(explicitDay) ? explicitDay : lesson.data?.date ?? today
  const plan = useStudentDay(day, !!explicitDay || !assignment.lesson_id || lesson.isSuccess)
  const fallback = assignment.lesson_id ? `/my-lessons/${assignment.lesson_id}` : '/assignments'
  const from = safeReturnPath(params.get('from'), fallback)
  const progress = assignmentProgress(assignment)
  const workOpen = activityOpen(assignment)
  const canWork = user?.id === assignment.student_id
  const notes = useStudentNotes(assignment.id, user!.id, assignment.student_notes ?? '', canWork && workOpen)
  const [submitting, setSubmitting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const template = assignment.template!
  const simple = user?.student_ui_mode === 'simple'
  const update = (value: StudentAssignment) => client.setQueryData(['student-assignment', user?.id, assignment.id], value)
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['student-day'] })
    void client.invalidateQueries({ queryKey: ['student-lesson'] })
    void client.invalidateQueries({ queryKey: ['student-lessons'] })
  }
  const start = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try { await notes.flush(); update(await assignmentsApi.startAssignment(assignment.id)); refresh() }
    catch (err) { setError(getErrorMessage(err, 'Could not start this activity.')) }
    finally { setBusy(false) }
  }
  const finish = async () => {
    try { await notes.flush(); setSubmitting(true) }
    catch { /* Autosave displays the error and retains the draft. */ }
  }
  const submit = async (data: { submission_method?: 'online' | 'paper'; submission_notes?: string; submission_artifacts?: string[] }) => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      await notes.flush()
      update(await assignmentsApi.updateStudentAssignment(assignment.id, { status: 'submitted', student_notes: notes.notes, ...data }))
      setSubmitting(false); setReceipt(true); refresh()
    } catch (err) { setError(getErrorMessage(err, 'Could not submit your work. Please try again.')) }
    finally { setBusy(false) }
  }
  const materials = [...new Map([
    ...(template.paperless_materials ?? []), ...(assignment.paperless_materials ?? []), ...(lesson.data?.paperless_materials ?? []),
  ].map(material => [material.document_id, material])).values()]
  const planProgress = plan.data ? dayProgress(plan.data) : null
  const canDoNext = (activity: NonNullable<typeof planProgress>['activities'][number]) =>
    activity.id !== assignment.id && activityOpen(activity) && !activity.help_requested
  const next = planProgress?.activities.find(canDoNext)
    ?? (lesson.data ? orderedActivities(lesson.data).find(canDoNext) : undefined)
  const awaitingHelp = assignment.help_requests?.some(request => !request.resolved_at)
  const alternative = awaitingHelp
    ? nextAvailableActivity(planProgress?.activities ?? [], assignment.id) ?? next
    : undefined
  const due = effectiveDueDate(assignment)
  const spoken = [template.name, template.instructions, assignment.custom_instructions, template.description, template.prerequisites, template.materials_needed].filter(Boolean).join('. ')
  const blocked = notes.blocker.state === 'blocked'
  return <div className={`student-workspace mx-auto max-w-4xl space-y-5 ${simple ? 'student-simple' : ''}`}>
    <Link to={from} className="inline-flex min-h-11 items-center font-semibold text-accent">← {from === '/' || from.startsWith('/#') ? 'Back to Today' : from.startsWith('/my-lessons/') ? 'Back to your lesson' : from.startsWith('/my-lessons') ? 'Back to your lessons' : 'Back to My Work'}</Link>
    <header className="space-y-2">
      <nav aria-label="Activity location" className="flex flex-wrap items-center gap-2 text-sm text-muted"><Link to="/" className="text-accent underline">Today</Link>{lesson.data && <><span aria-hidden="true">→</span><Link to={`/my-lessons/${lesson.data.id}`} className="text-accent underline break-words">{lesson.data.title}</Link></>}</nav>
      <h1 className="text-2xl font-bold text-ink break-words [overflow-wrap:anywhere]">{template.name}</h1>
      <p className="font-semibold text-accent" role="status">{workStateLabel(assignment)}{progress === 'submitted' ? ' · Waiting for your teacher' : ''}</p>
      <p className="text-sm text-muted">{lesson.data?.date ? `Planned ${formatDateOnly(lesson.data.date)} · ` : ''}{due ? `Due ${formatDateOnly(due)}` : 'No deadline'}{template.estimated_duration_minutes ? ` · About ${template.estimated_duration_minutes} min` : ''}</p>
      {isOverdue(assignment) && <p className="text-sm text-neg-fg">Overdue · You can still finish this work.</p>}
    </header>
    {error && <p role="alert" className="rounded-field bg-neg-bg p-3 text-neg-fg">{error}</p>}
    {(receipt || (!workOpen && next)) && <section role="status" className="space-y-3 rounded-card border border-line bg-accent-soft p-4"><h2 className="text-lg font-semibold">{receipt ? "Saved — ready for your teacher." : "What comes next"}</h2>{plan.isFetching ? <p>Updating your plan…</p> : plan.isError ? <p>Your work was saved. Your plan could not be refreshed. <button onClick={() => void plan.refetch()} className="text-accent underline">Try again</button></p> : planProgress && <p>{planProgress.finished} of {planProgress.total} activities finished for {day === today ? 'today' : formatDateOnly(day)}.</p>}{next && !plan.isFetching && !plan.isError && <div><h3 className="font-semibold">Next activity</h3><StudentActivityRow activity={next} from={from} day={day} /></div>}<Link to={from} className="inline-flex min-h-11 items-center font-semibold text-accent underline">Return to your plan</Link></section>}
    {assignment.teacher_feedback && <section className="space-y-2 rounded-card border border-accent-line bg-accent-soft p-4" aria-label="Teacher feedback"><h2 className="text-lg font-semibold">Your teacher's feedback</h2><MarkdownRenderer content={assignment.teacher_feedback} /></section>}
    <section className="space-y-4 rounded-card border border-line bg-panel p-4 sm:p-5" aria-label="What to do"><h2 className="text-lg font-semibold">What to do</h2>
      {!template.instructions && !assignment.custom_instructions && !template.description && <p>Check with your teacher about this activity.</p>}
      {template.instructions && <MarkdownRenderer content={template.instructions} className="text-base leading-relaxed" />}
      {assignment.custom_instructions && <div className="space-y-2"><h3 className="font-semibold">For this activity</h3><MarkdownRenderer content={assignment.custom_instructions} className="text-base leading-relaxed" /></div>}
      {template.description && (template.instructions || assignment.custom_instructions ? <details><summary className="min-h-11 cursor-pointer font-semibold">About this activity</summary><MarkdownRenderer content={template.description} className="text-base leading-relaxed" /></details> : <MarkdownRenderer content={template.description} className="text-base leading-relaxed" />)}
      {simple && <ReadAloud text={spoken} />}
    </section>
    <section className="space-y-3 rounded-card border border-line bg-panel p-4 sm:p-5" aria-label="What you need"><h2 className="text-lg font-semibold">What you need</h2>
      {template.prerequisites && <div><h3 className="font-semibold">Before you start</h3><MarkdownRenderer content={template.prerequisites} /></div>}
      {template.materials_needed && <MarkdownRenderer content={template.materials_needed} />}
      {!!assignment.lesson_id && lesson.isPending && <p role="status">Loading shared lesson materials…</p>}
      {!!assignment.lesson_id && lesson.isError && <p role="alert">Shared lesson materials could not be loaded. <button onClick={() => void lesson.refetch()} className="text-accent underline">Try again</button> or ask your teacher.</p>}
      {!template.materials_needed && materials.length === 0 && !lesson.data?.resources.length && !assignment.lesson_id && <p>No special materials listed. Check with your teacher if you need something.</p>}
      {lesson.data && (lesson.data.resources.length > 0 || lesson.data.paperless_materials.length > 0) && <p className="text-sm text-muted">Includes shared materials from {lesson.data.title}.</p>}
      <StudentResources materials={materials} resources={lesson.data?.resources} />
    </section>
    {canWork && workOpen && <>
      <details className="rounded-card border border-line bg-panel p-4" open={!simple || !!notes.error || !!notes.conflict}><summary className="min-h-11 cursor-pointer font-semibold">My working notes · Optional</summary>
        {notes.conflict && <div role="alert" className="my-3 space-y-2"><p>You have a draft from an earlier visit. The saved notes changed since then.</p><p className="whitespace-pre-wrap">{notes.conflict.text}</p><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={notes.recover}>Use my draft</Button><Button variant="secondary" onClick={notes.dismissDraft}>Keep saved notes</Button></div></div>}
        <label htmlFor="student-work-notes" className="block py-2">Your notes</label><textarea id="student-work-notes" rows={4} value={notes.notes} onChange={e => notes.change(e.target.value)} className="w-full rounded-field border border-line bg-field-bg p-3 text-base text-ink" placeholder="Save your thinking or where you stopped…" />
        <p role="status" className="text-sm text-muted">{notes.saving ? 'Saving notes…' : notes.dirty ? 'Notes not saved yet' : 'Notes saved'}</p>
        {notes.error && <div role="alert"><p className="text-neg-fg">{notes.error}</p><Button variant="secondary" onClick={() => void notes.flush().catch(() => {})}>Retry saving notes</Button></div>}
      </details>
      <TaskHelp assignmentId={assignment.id} requests={assignment.help_requests ?? []} onRequested={request => { update({...assignment, help_requests: [...(assignment.help_requests ?? []), request]}); refresh() }} />
      {awaitingHelp && !plan.isError && (alternative
        ? <section className="rounded-card border border-line bg-panel p-4" aria-label="Work on something else">
            <h2 className="font-semibold">Work on something else while you wait</h2>
            <StudentActivityRow activity={alternative} from={from} day={day} />
          </section>
        : plan.isSuccess && <p className="text-sm text-muted">You can return to your plan while your teacher helps with this activity.</p>)}
      <div className="flex flex-wrap gap-3 rounded-card border border-line bg-panel p-4">{progress === 'not_started' ? <Button loading={busy} onClick={() => void start()}>Start activity</Button> : <Button loading={busy} onClick={() => void finish()}>I’m finished</Button>}<Link to={from} className="inline-flex min-h-11 items-center px-3 font-semibold text-accent">Back to your plan</Link></div>
    </>}
    <details className="rounded-card border border-line bg-panel p-4"><summary className="min-h-11 cursor-pointer font-semibold">{simple ? 'More details' : 'Work sessions, grade, and history'}</summary><div className="space-y-4 pt-3">
      <p>Grade: {assignment.is_graded ? `${assignment.points_earned ?? '—'} / ${assignment.custom_max_points ?? template.max_points}${assignment.letter_grade ? ` · ${assignment.letter_grade}` : ''}` : 'Not reviewed yet'}</p>
      <AssignmentTimeLog assignment={assignment} onTotalChanged={minutes => update({...assignment, time_spent_minutes: minutes})} />
      <p className="text-sm text-muted">Assigned {formatDateOnly(assignment.assigned_date)}{assignment.extended_due_date && assignment.due_date ? ` · Original deadline ${formatDateOnly(assignment.due_date)} · Extended to ${formatDateOnly(assignment.extended_due_date)}` : ''}</p>
      {assignment.submission_notes && <div><h3 className="font-semibold">Your note to your teacher</h3><p className="whitespace-pre-wrap">{assignment.submission_notes}</p></div>}
      {assignment.submission_artifacts?.map((link, index) => <a key={index} href={link} target="_blank" rel="noopener noreferrer" className="block min-h-11 text-accent underline break-words">{link}</a>)}
      {!workOpen && assignment.student_notes && <div><h3 className="font-semibold">Your working notes</h3><p className="whitespace-pre-wrap">{assignment.student_notes}</p></div>}
    </div></details>
    {submitting && <SubmissionDialog assignment={assignment} isOpen onClose={() => { if (!busy) setSubmitting(false) }} loading={busy} onSubmit={data => void submit(data)} error={error} />}
    {blocked && <Modal isOpen onClose={() => notes.blocker.state === 'blocked' && notes.blocker.reset()} title="Saving your working notes" footer={<><Button variant="secondary" onClick={() => notes.blocker.state === 'blocked' && notes.blocker.reset()}>Stay here</Button><Button disabled={notes.saving} onClick={() => void notes.flush().catch(() => {})}>Retry save and continue</Button>{notes.recoverable && !notes.saving && <Button variant="secondary" onClick={() => { if (notes.blocker.state === 'blocked') notes.blocker.proceed() }}>Leave with recovery draft</Button>}</>}><p>{notes.saving ? 'Please wait while your notes are saved.' : notes.error ?? 'Your notes must be saved before leaving.'}</p>{notes.recoverable && <p className="mt-2 text-sm">These notes are not saved to OurSchool yet. A recovery draft is kept in this browser tab for your account; return to this activity to finish saving it.</p>}</Modal>}
  </div>
}

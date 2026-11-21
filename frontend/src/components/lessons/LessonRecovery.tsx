import { useState } from 'react'

import { Button, Input, Select, useToast } from '../ui'
import Modal from '../ui/Modal/Modal'
import { getErrorMessage } from '../../services/api'
import { lessonsApi } from '../../services/lessons'
import {
  Lesson, LessonRecoverySettings, LessonReschedulePreview, LessonRolloverResponse,
} from '../../types/lesson'
import { addDays, isValidISODate, parseISO, todayISO } from '../../utils/dates'
import { formatDateOnly } from '../../utils/formatters'

interface Props {
  data?: LessonRolloverResponse
  drawerLessons?: Lesson[]
  error: string
  showSettings?: boolean
  onRefresh: () => Promise<unknown>
  onChanged: () => Promise<unknown>
}

interface Schedule {
  lesson: Lesson
  date: string
  shift: boolean
  preview?: LessonReschedulePreview
}

const MODES = [
  { value: 'review', label: 'Review untaught lessons' },
  { value: 'drawer', label: 'Move to drawer automatically' },
  { value: 'carry', label: 'Carry forward automatically' },
]

export default function LessonRecovery({
  data, drawerLessons, error, showSettings, onRefresh, onChanged,
}: Props) {
  const { toast } = useToast()
  const [schedule, setSchedule] = useState<Schedule>()
  const [settings, setSettings] = useState<{mode: LessonRecoverySettings['mode']; breaks: string}>()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const today = todayISO()
  const pending = data?.pending ?? []
  const moved = (drawerLessons ?? data?.lessons ?? []).filter(
    lesson => lesson.last_scheduled_date && lesson.status !== 'taught',
  )

  let nextDay = addDays(today, 1)
  while (
    data?.settings?.break_dates.includes(nextDay) ||
    (data?.skip_weekends && [0, 6].includes(parseISO(nextDay).getDay()))
  ) {
    nextDay = addDays(nextDay, 1)
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setActionError('')
    try {
      await action()
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not apply the lesson change.'))
    } finally {
      setBusy(false)
    }
  }

  function renderLesson(lesson: Lesson) {
    const formerDay = lesson.date ?? lesson.last_scheduled_date
    return (
      <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2">
        <div>
          <p className="font-medium">{lesson.title}</p>
          <p className="text-xs text-muted">
            {[formerDay && formatDateOnly(formerDay), lesson.subject?.name,
              ...lesson.students.map(student => student.first_name)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
            if (lesson.date) {
              await lessonsApi.setStatus(lesson.id, 'taught')
            } else {
              const result = await lessonsApi.update(lesson.id, { date: formerDay, status: 'taught' })
              result.warnings.forEach(warning => toast(warning, 'danger'))
            }
            await onChanged()
          })}>
            Mark taught {formerDay && formatDateOnly(formerDay, { month: 'short', day: 'numeric' })}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => {
            setActionError('')
            setSchedule({ lesson, date: today, shift: false })
          }}>Reschedule</Button>
          {lesson.date && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
            const result = await lessonsApi.update(lesson.id, { date: null })
            result.warnings.forEach(warning => toast(warning, 'danger'))
            await onChanged()
          })}>Move to drawer</Button>}
        </div>
      </li>
    )
  }

  function submitSchedule() {
    if (!schedule) return
    const { lesson, date, shift, preview } = schedule
    void run(async () => {
      try {
        const result = await lessonsApi.reschedule(lesson.id, today, date, shift, preview)
        if (preview) {
          setSchedule(undefined)
          result.warnings.forEach(warning => toast(warning, 'danger'))
          await onChanged()
        } else {
          setSchedule({ ...schedule, preview: result })
        }
      } catch (err) {
        setSchedule({ ...schedule, preview: undefined })
        throw err
      }
    })
  }

  const closeModal = () => {
    if (busy) return
    setSchedule(undefined)
    setSettings(undefined)
    setActionError('')
  }

  return (
    <section className="my-3 space-y-2" aria-label="Untaught lessons">
      {error && <p role="alert">{error} <Button size="sm" variant="outline" onClick={() => void onRefresh()}>Retry</Button></p>}
      {pending.length > 0 && <details className="rounded-lg border border-line bg-panel px-3 py-2">
        <summary className="cursor-pointer font-semibold">
          {pending.length} untaught {pending.length === 1 ? 'lesson needs' : 'lessons need'} review
        </summary>
        <ul className="mt-2">{pending.map(renderLesson)}</ul>
      </details>}
      {moved.length > 0 && <details className="rounded-lg border border-line bg-panel px-3 py-2">
        <summary className="cursor-pointer font-semibold">Review lessons in the drawer ({moved.length})</summary>
        <ul className="mt-2">{moved.map(renderLesson)}</ul>
      </details>}
      {showSettings && data?.settings && <Button size="sm" variant="outline" disabled={busy} onClick={() => {
        setActionError('')
        setSettings({ mode: data.settings!.mode, breaks: [...data.settings!.break_dates].sort().join('\n') })
      }}>Untaught lesson settings</Button>}
      {!schedule && !settings && actionError && <p role="alert" className="text-neg-fg">{actionError}</p>}

      {settings && <Modal isOpen title="Untaught lesson settings" onClose={closeModal} footer={
        <Button disabled={busy} onClick={() => void run(async () => {
          const breakDates = settings.breaks.split(/[\s,]+/).filter(Boolean)
          if (!breakDates.every(isValidISODate)) throw new Error('Enter each break date as YYYY-MM-DD.')
          await lessonsApi.saveRecoverySettings({ mode: settings.mode, break_dates: [...new Set(breakDates)] })
          setSettings(undefined)
          await onRefresh()
        })}>Save settings</Button>
      }>
        <div className="space-y-3">
          <Select label="When a lesson is still untaught" options={MODES} value={settings.mode}
            onChange={event => setSettings({ ...settings, mode: event.target.value as LessonRecoverySettings['mode'] })} />
          <p className="text-sm text-muted">Automatic moves run the next time you open Planner or Teach. Carry-forward sends same-subject conflicts to review.</p>
          <label className="block text-sm">
            School break dates (YYYY-MM-DD, one per line)
            <textarea className="mt-1 block w-full rounded-field border border-field-border bg-field-bg p-2"
              rows={4} value={settings.breaks} onChange={event => setSettings({ ...settings, breaks: event.target.value })} />
          </label>
          {actionError && <p role="alert" className="text-neg-fg">{actionError}</p>}
        </div>
      </Modal>}

      {schedule && <Modal isOpen title={schedule.lesson.title} onClose={closeModal} footer={<>
        <Button variant="outline" disabled={busy} onClick={() => schedule.preview
          ? setSchedule({ ...schedule, preview: undefined }) : closeModal()}>
          {schedule.preview ? 'Back' : 'Cancel'}
        </Button>
        <Button disabled={busy || !isValidISODate(schedule.date) || schedule.date < today || schedule.preview?.moves.length === 0}
          onClick={submitSchedule}>{schedule.preview ? 'Apply changes' : 'Review move'}</Button>
      </>}>
        {schedule.preview ? <div className="space-y-3">
          {schedule.preview.conflicts.length > 0 && <p className="text-sm">
            Already scheduled in this subject on {formatDateOnly(schedule.date)} — {schedule.preview.conflicts.join(', ')}
          </p>}
          {schedule.preview.moves.length === 0 && <p>No dates would change.</p>}
          <ul className="space-y-2">
            {schedule.preview.moves.map(move => <li key={move.lesson_id} className="rounded-field border border-line p-2 text-sm">
              <p className="font-semibold">{move.title}</p>
              <p>{formatDateOnly(move.from_date)} → {formatDateOnly(move.to_date)} · {move.students.join(', ')}</p>
              {move.impacts.map((impact, index) => <p key={index} className="mt-1 text-xs text-muted">
                {impact.student_name} · {impact.template_name} · {impact.due_date ? `Due ${formatDateOnly(impact.due_date)}` : 'No deadline'} · {impact.explanation}
              </p>)}
            </li>)}
          </ul>
        </div> : <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSchedule({ ...schedule, date: today })}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => setSchedule({ ...schedule, date: nextDay })}>Next school day</Button>
          </div>
          <Input label="New lesson date" type="date" min={today} value={schedule.date}
            onChange={event => setSchedule({ ...schedule, date: event.target.value })} />
          {schedule.lesson.subject_id && schedule.lesson.students.length > 0 && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={schedule.shift}
              onChange={event => setSchedule({ ...schedule, shift: event.target.checked })} />
            Shift upcoming lessons in this subject for the same students
          </label>}
        </div>}
        {actionError && <p role="alert" className="mt-2 text-neg-fg">{actionError}</p>}
      </Modal>}
    </section>
  )
}

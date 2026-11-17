import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StudentActivity } from '../../types/lesson'
import { assignmentsApi } from '../../services/assignments'
import { getErrorMessage } from '../../services/api'
import { assignmentHref, assignmentProgress } from '../../utils/studentAssignments'
import { activityReturnPath, workStateLabel } from '../../utils/studentPlan'
import { formatDateOnly } from '../../utils/formatters'
import { todayISO } from '../../utils/dates'
import { Button } from '../ui'

export default function StudentActivityRow({ activity, from, day, recommended = false }: {
  activity: StudentActivity; from: string; day?: string; recommended?: boolean
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const href = assignmentHref(activity.id, { from: activityReturnPath(activity, from), day })
  const progress = assignmentProgress(activity)
  const due = activity.extended_due_date ?? activity.due_date
  const label = progress === 'in_progress' ? 'Continue' : progress === 'graded' ? 'View feedback' : 'View work'
  const start = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try { await assignmentsApi.startAssignment(activity.id); navigate(href) }
    catch (err) { setError(getErrorMessage(err, 'Could not start this activity. Try again.')); setBusy(false) }
  }
  return <div className={`rounded-field ${recommended ? 'bg-accent-soft p-4' : 'border-t border-line py-3'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-44">
        <Link to={href} className="font-semibold text-ink hover:text-accent break-words [overflow-wrap:anywhere]">{activity.name}</Link>
        <p className="mt-1 text-sm text-muted">{workStateLabel(activity)}{activity.estimated_duration_minutes ? ` · About ${activity.estimated_duration_minutes} min` : ''}</p>
        {due && <p className="text-sm text-muted">Due {formatDateOnly(due)}{due < todayISO() && ['not_started', 'in_progress'].includes(progress) ? ' · Overdue — you can still finish' : ''}</p>}
        {activity.help_requested && <p className="text-sm font-semibold text-accent">Help requested · Your teacher has your request</p>}
      </div>
      {progress === 'not_started' ? <Button onClick={() => void start()} loading={busy}>Start</Button> : <Link to={href} className={`inline-flex min-h-11 items-center justify-center rounded-field px-4 py-2 font-semibold ${progress === 'in_progress' ? 'bg-btn-primary-bg text-btn-primary-fg' : 'border border-line text-accent'}`}>{label}</Link>}
    </div>
    {error && <p role="alert" className="mt-2 text-neg-fg">{error}</p>}
  </div>
}

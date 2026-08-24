import React, { useEffect, useState } from 'react'
import { AssignmentTimeEntry, StudentAssignment } from '../../types'
import { assignmentsApi, assignmentUtils } from '../../services/assignments'
import { getErrorMessage } from '../../services/api'
import { formatDateOnly } from '../../utils/formatters'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  assignment: StudentAssignment
  onTotalChanged: (minutes: number) => void
}

const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent'

const localDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const AssignmentTimeLog: React.FC<Props> = ({ assignment, onTotalChanged }) => {
  const { user } = useAuth()
  const [entries, setEntries] = useState<AssignmentTimeEntry[]>([])
  const [form, setForm] = useState({ work_date: localDate(), hours: 0, minutes: 30, note: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = user?.role === 'admin'
  const locked = !isAdmin && (assignment.is_graded || ['submitted', 'graded', 'excused'].includes(assignment.status))

  useEffect(() => {
    assignmentsApi.getTimeEntries(assignment.id)
      .then(setEntries)
      .catch(err => setError(getErrorMessage(err, 'Could not load time log')))
  }, [assignment.id])

  const reset = () => {
    setEditingId(null)
    setForm({ work_date: localDate(), hours: 0, minutes: 30, note: '' })
  }
  const save = async () => {
    const total = form.hours * 60 + form.minutes
    if (total < 1 || total > 1440) { setError('Enter between 1 minute and 24 hours.'); return }
    setBusy(true)
    setError(null)
    try {
      const payload = { work_date: form.work_date, minutes: total, note: form.note.trim() || undefined }
      if (editingId) await assignmentsApi.updateTimeEntry(editingId, payload)
      else await assignmentsApi.createTimeEntry(assignment.id, payload)
      const next = await assignmentsApi.getTimeEntries(assignment.id)
      setEntries(next)
      onTotalChanged(next.reduce((sum, entry) => sum + entry.minutes, 0))
      reset()
    } catch (err) { setError(getErrorMessage(err, 'Could not save time')) }
    finally { setBusy(false) }
  }
  const edit = (entry: AssignmentTimeEntry) => {
    setEditingId(entry.id)
    setForm({ work_date: entry.work_date, hours: Math.floor(entry.minutes / 60), minutes: entry.minutes % 60, note: entry.note ?? '' })
  }
  const remove = async (entry: AssignmentTimeEntry) => {
    setBusy(true)
    try {
      await assignmentsApi.deleteTimeEntry(entry.id)
      const next = entries.filter(item => item.id !== entry.id)
      setEntries(next)
      onTotalChanged(next.reduce((sum, item) => sum + item.minutes, 0))
    } catch (err) { setError(getErrorMessage(err, 'Could not delete time entry')) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><span className="text-[12.5px] text-muted">Total logged</span><strong className="text-[14px] text-ink">{assignmentUtils.formatDuration(entries.reduce((sum, entry) => sum + entry.minutes, 0))}</strong></div>
      {error && <div className="text-[12.5px] text-neg-fg">{error}</div>}
      {!locked && (
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_70px_70px_2fr_auto] gap-2 items-end">
          <label className="text-[11.5px] text-muted">Date<input className={`${FIELD} w-full mt-1`} type="date" max={localDate()} value={form.work_date} onChange={e => setForm(p => ({ ...p, work_date: e.target.value }))} /></label>
          <label className="text-[11.5px] text-muted">Hours<input className={`${FIELD} w-full mt-1`} type="number" min={0} max={24} value={form.hours} onChange={e => setForm(p => ({ ...p, hours: Number(e.target.value) }))} /></label>
          <label className="text-[11.5px] text-muted">Minutes<input className={`${FIELD} w-full mt-1`} type="number" min={0} max={59} value={form.minutes} onChange={e => setForm(p => ({ ...p, minutes: Number(e.target.value) }))} /></label>
          <label className="text-[11.5px] text-muted">Note<input className={`${FIELD} w-full mt-1`} maxLength={500} value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} /></label>
          <button disabled={busy} onClick={save} className="h-[35px] px-3 rounded-field bg-btn-primary-bg text-btn-primary-fg text-[12.5px] font-semibold disabled:opacity-50">{editingId ? 'Update' : 'Log time'}</button>
        </div>
      )}
      {locked && <p className="text-[12px] text-faint">Time logs are locked after submission.</p>}
      <div className="divide-y divide-line border border-line rounded-field overflow-hidden">
        {entries.length === 0 ? <p className="px-3 py-4 text-[12.5px] text-faint">No time logged yet.</p> : entries.map(entry => {
          const canChange = isAdmin || (!locked && entry.logged_by === user?.id)
          return <div key={entry.id} className="px-3 py-2.5 flex items-center gap-3 text-[12.5px]"><span className="font-mono text-faint">{formatDateOnly(entry.work_date, { month: 'short', day: 'numeric' })}</span><strong className="text-ink">{assignmentUtils.formatDuration(entry.minutes)}</strong><span className="flex-1 text-muted truncate">{entry.note || '—'} · {entry.logged_by_name}</span>{canChange && <><button onClick={() => edit(entry)} className="text-accent font-semibold">Edit</button><button onClick={() => remove(entry)} className="text-danger font-semibold">Delete</button></>}</div>
        })}
      </div>
    </div>
  )
}

export default AssignmentTimeLog

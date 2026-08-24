import React, { useState } from 'react'
import { JournalEntryWithAuthor, JournalGoal } from '../../types'
import { journalApi } from '../../services/journal'
import { getErrorMessage } from '../../services/api'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface Props {
  entry: JournalEntryWithAuthor
  onClose: () => void
  onSaved: (entry: JournalEntryWithAuthor) => void
}

const FIELD = 'w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent'
const LABEL = 'block text-[12px] font-semibold text-muted mb-1.5'

const JournalEditDialog: React.FC<Props> = ({ entry, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title: entry.title,
    content: entry.content,
    entry_date: entry.entry_date.slice(0, 10),
    mood: entry.mood ?? '',
    icon: entry.icon ?? '',
    tags: (entry.tags ?? []).join(', '),
    win: entry.win ?? '',
    goals: (entry.goals ?? []).map(goal => goal.text).join('\n'),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and entry content are required.')
      return
    }
    setSaving(true)
    setError(null)
    const priorGoals = new Map((entry.goals ?? []).map(goal => [goal.text, goal]))
    const goals: JournalGoal[] = form.goals.split('\n').map(line => line.trim()).filter(Boolean).map((text, index) => {
      const previous = priorGoals.get(text)
      return previous ?? { id: Date.now() + index, text, done: false }
    })
    try {
      const updated = await journalApi.update(entry.id, {
        title: form.title.trim(),
        content: form.content,
        entry_date: form.entry_date,
        mood: form.mood || null,
        icon: form.icon || null,
        tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        win: form.win.trim() || null,
        goals,
      })
      onSaved(updated)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update journal entry'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Edit journal entry" subtitle="The entry will be marked as edited." size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save changes</Button></>}>
      <div className="space-y-4">
        {error && <div className="px-3 py-2 rounded-field bg-neg-bg text-neg-fg text-[13px]">{error}</div>}
        <div><label className={LABEL}>Title</label><input className={FIELD} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
        <div><label className={LABEL}>Entry</label><textarea className={FIELD} rows={8} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={LABEL}>Date</label><input className={FIELD} type="date" value={form.entry_date} onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))} /></div>
          <div><label className={LABEL}>Mood</label><select className={FIELD} value={form.mood} onChange={e => setForm(p => ({ ...p, mood: e.target.value }))}><option value="">No mood</option><option value="great">Great</option><option value="good">Good</option><option value="okay">Okay</option><option value="low">Low</option><option value="hard">Hard</option></select></div>
          <div><label className={LABEL}>Icon name</label><input className={FIELD} value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} /></div>
        </div>
        <div><label className={LABEL}>Tags, comma separated</label><input className={FIELD} value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} /></div>
        <div><label className={LABEL}>Win of the day</label><input className={FIELD} value={form.win} onChange={e => setForm(p => ({ ...p, win: e.target.value }))} /></div>
        <div><label className={LABEL}>Goals, one per line</label><textarea className={FIELD} rows={4} value={form.goals} onChange={e => setForm(p => ({ ...p, goals: e.target.value }))} /></div>
      </div>
    </Modal>
  )
}

export default JournalEditDialog

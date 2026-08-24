import React, { useState } from 'react'
import { StudentAssignment } from '../../types'
import { assignmentsApi } from '../../services/assignments'
import { getErrorMessage } from '../../services/api'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface Props {
  assignment: StudentAssignment
  onClose: () => void
  onSaved: (assignment: StudentAssignment) => void
}

const FIELD = 'w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent'
const LABEL = 'block text-[12px] font-semibold text-muted mb-1.5'

const AssignedAssignmentEditor: React.FC<Props> = ({ assignment, onClose, onSaved }) => {
  const [form, setForm] = useState({
    assigned_date: assignment.assigned_date,
    due_date: assignment.due_date ?? '',
    extended_due_date: assignment.extended_due_date ?? '',
    custom_instructions: assignment.custom_instructions ?? '',
    custom_max_points: assignment.custom_max_points == null ? '' : String(assignment.custom_max_points),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await assignmentsApi.updateStudentAssignment(assignment.id, {
        assigned_date: form.assigned_date,
        due_date: form.due_date || null,
        extended_due_date: form.extended_due_date || null,
        custom_instructions: form.custom_instructions,
        custom_max_points: form.custom_max_points ? Number(form.custom_max_points) : null,
      })
      onSaved(updated)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update assigned work'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Edit assigned work" subtitle={assignment.template?.name} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save changes</Button></>}>
      <div className="space-y-4">
        {error && <div className="px-3 py-2 rounded-field bg-neg-bg text-neg-fg text-[13px]">{error}</div>}
        {assignment.is_graded && <div className="px-3 py-2 rounded-field bg-accent-soft text-accent text-[12.5px]">Changing dates or points will recalculate this grade and affected term totals.</div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={LABEL}>Assigned</label><input className={FIELD} type="date" value={form.assigned_date} onChange={e => setForm(p => ({ ...p, assigned_date: e.target.value }))} /></div>
          <div><label className={LABEL}>Due</label><input className={FIELD} type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
          <div><label className={LABEL}>Extended due</label><input className={FIELD} type="date" value={form.extended_due_date} onChange={e => setForm(p => ({ ...p, extended_due_date: e.target.value }))} /></div>
        </div>
        <div><label className={LABEL}>Individual instructions</label><textarea className={FIELD} rows={4} value={form.custom_instructions} onChange={e => setForm(p => ({ ...p, custom_instructions: e.target.value }))} /></div>
        <div><label className={LABEL}>Point override</label><input className={FIELD} type="number" min={1} max={1000} placeholder={`Template default: ${assignment.template?.max_points ?? 100}`} value={form.custom_max_points} onChange={e => setForm(p => ({ ...p, custom_max_points: e.target.value }))} /></div>
      </div>
    </Modal>
  )
}

export default AssignedAssignmentEditor

import React, { useState } from 'react'
import { AssignmentTypeConfig, StudentAssignment, Subject } from '../../types'
import { assignmentsApi } from '../../services/assignments'
import { getErrorMessage } from '../../services/api'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface Props {
  assignment?: StudentAssignment | null
  subjects: Subject[]
  assignmentTypes: AssignmentTypeConfig[]
  onClose: () => void
  onSaved: () => void
}

const FIELD = 'w-full bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent'
const LABEL = 'block text-[12px] font-semibold text-muted mb-1.5'

const today = () => {
  const value = new Date()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

const StudentCreatedAssignmentEditor: React.FC<Props> = ({
  assignment,
  subjects,
  assignmentTypes,
  onClose,
  onSaved,
}) => {
  const template = assignment?.template
  const [form, setForm] = useState({
    name: template?.name ?? '',
    subject_id: template?.subject_id ?? subjects[0]?.id ?? 0,
    assignment_type: template?.assignment_type ?? assignmentTypes[0]?.key ?? 'homework',
    description: template?.description ?? '',
    instructions: template?.instructions ?? '',
    max_points: template?.max_points ?? 100,
    estimated_duration_minutes: template?.estimated_duration_minutes ?? 30,
    assigned_date: assignment?.assigned_date ?? today(),
    due_date: assignment?.due_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!form.name.trim() || !form.subject_id) {
      setError('Title and subject are required.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      instructions: form.instructions.trim() || undefined,
      due_date: form.due_date || undefined,
      estimated_duration_minutes: form.estimated_duration_minutes || undefined,
    }
    try {
      if (assignment) await assignmentsApi.updateMyAssignment(assignment.id, { ...payload, due_date: form.due_date || null })
      else await assignmentsApi.createMyAssignment(payload)
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save assignment'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={assignment ? 'Edit your assignment' : 'Add your own assignment'}
      subtitle="Student-created work can be reviewed and graded by an administrator."
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save assignment</Button></>}
    >
      <div className="space-y-4">
        {error && <div className="px-3 py-2 rounded-field bg-neg-bg text-neg-fg text-[13px]">{error}</div>}
        <div><label className={LABEL}>Title</label><input className={FIELD} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={LABEL}>Subject</label><select className={FIELD} value={form.subject_id} onChange={e => setForm(p => ({ ...p, subject_id: Number(e.target.value) }))}>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
          <div><label className={LABEL}>Type</label><select className={FIELD} value={form.assignment_type} onChange={e => setForm(p => ({ ...p, assignment_type: e.target.value }))}>{assignmentTypes.filter(type => type.is_active).map(type => <option key={type.key} value={type.key}>{type.name}</option>)}</select></div>
        </div>
        <div><label className={LABEL}>Description</label><textarea className={FIELD} rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
        <div><label className={LABEL}>Instructions</label><textarea className={FIELD} rows={3} value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={LABEL}>Max points</label><input className={FIELD} type="number" min={1} max={1000} value={form.max_points} onChange={e => setForm(p => ({ ...p, max_points: Number(e.target.value) }))} /></div>
          <div><label className={LABEL}>Est. minutes</label><input className={FIELD} type="number" min={1} value={form.estimated_duration_minutes} onChange={e => setForm(p => ({ ...p, estimated_duration_minutes: Number(e.target.value) }))} /></div>
          <div><label className={LABEL}>Assigned</label><input className={FIELD} type="date" value={form.assigned_date} onChange={e => setForm(p => ({ ...p, assigned_date: e.target.value }))} /></div>
          <div><label className={LABEL}>Due</label><input className={FIELD} type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
        </div>
      </div>
    </Modal>
  )
}

export default StudentCreatedAssignmentEditor

import { useState } from 'react'
import { StudentAssignment } from '../../types'
import { effectiveDueDate } from '../../utils/studentAssignments'
import { formatDateOnly } from '../../utils/formatters'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface SubmissionDialogProps {
  assignment: StudentAssignment
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { submission_method?: 'online' | 'paper'; submission_notes?: string; submission_artifacts?: string[] }) => void
  loading?: boolean
  error?: string | null
}

export default function SubmissionDialog({ assignment, isOpen, onClose, onSubmit, loading = false, error }: SubmissionDialogProps) {
  const [method, setMethod] = useState<'online' | 'paper'>(assignment.submitted_date ? assignment.submission_method ?? 'paper' : 'paper')
  const [note, setNote] = useState('')
  const [links, setLinks] = useState([''])
  const [invalid, setInvalid] = useState(false)
  const due = effectiveDueDate(assignment)
  const submit = () => {
    if (loading) return
    const artifacts = links.map(link => link.trim()).filter(Boolean)
    if (artifacts.some(link => {
      try { const url = new URL(link); return !['https:', 'http:'].includes(url.protocol) }
      catch { return true }
    })) { setInvalid(true); return }
    setInvalid(false)
    onSubmit({ submission_method: method, ...(note.trim() ? { submission_notes: note.trim() } : {}), ...(artifacts.length ? { submission_artifacts: artifacts } : {}) })
  }
  return <Modal isOpen={isOpen} onClose={() => { if (!loading) onClose() }} title="I’m finished" subtitle={assignment.template?.name} size="md" showCloseButton={!loading} closeOnOverlayClick={!loading} footer={<>
    <Button className="min-h-11" variant="secondary" onClick={onClose} disabled={loading}>Keep working</Button>
    <Button className="min-h-11" loading={loading} onClick={submit}>Ready for my teacher</Button>
  </>}>
    <div className="student-workspace space-y-4">
      {error && <p role="alert" className="rounded-field bg-neg-bg p-3 text-neg-fg">{error}</p>}
      <fieldset className="space-y-2"><legend className="mb-2 font-semibold">How did you finish?</legend>
        <label className="flex min-h-11 items-center gap-3"><input type="radio" name="submission-method" checked={method === 'paper'} disabled={loading} onChange={() => setMethod('paper')} />Finished on paper — I’ll show my teacher</label>
        <label className="flex min-h-11 items-center gap-3"><input type="radio" name="submission-method" checked={method === 'online'} disabled={loading} onChange={() => setMethod('online')} />Finished online</label>
      </fieldset>
      <p className="text-sm text-muted">{due ? `Due ${formatDateOnly(due)}` : 'No deadline'} · Your teacher will review your work.</p>
      <details><summary className="min-h-11 cursor-pointer font-semibold">Add a note to your teacher · Optional</summary><label htmlFor="submission-note" className="block py-2">Notes to teacher</label><textarea id="submission-note" value={note} onChange={e => setNote(e.target.value)} disabled={loading} rows={3} className="w-full rounded-field border border-line bg-field-bg p-3 text-base text-ink" /></details>
      <details open={method === 'online' || invalid}><summary className="min-h-11 cursor-pointer font-semibold">Add work links · Optional</summary><p className="mb-2 text-sm text-muted">Link to existing online work.</p>
        {links.map((link, index) => <div key={index} className="mb-2 flex flex-wrap gap-2"><label className="min-w-0 flex-1 basis-40"><span className="block text-sm">Work link {index + 1}</span><input type="url" value={link} disabled={loading} onChange={e => { setLinks(values => values.map((value, i) => i === index ? e.target.value : value)); setInvalid(false) }} className="min-h-11 w-full rounded-field border border-line bg-field-bg px-3 text-base text-ink" placeholder="https://…" /></label>{links.length > 1 && <Button variant="secondary" disabled={loading} onClick={() => setLinks(values => values.filter((_, i) => i !== index))} aria-label={`Remove work link ${index + 1}`}>Remove</Button>}</div>)}
        {invalid && <p role="alert" className="text-neg-fg">Enter valid work links starting with https:// or http://.</p>}
        <Button variant="secondary" disabled={loading} onClick={() => setLinks(values => [...values, ''])}>Add another link</Button>
      </details>
    </div>
  </Modal>
}

import { useState } from 'react'
import { useDashboardRead } from '../../hooks/useDashboardRead'
import { JournalEntryWithAuthor } from '../../types'
import { journalApi } from '../../services/journal'
import { getErrorMessage } from '../../services/api'
import MarkdownRenderer from '../common/MarkdownRenderer'
import Modal from '../ui/Modal'
import { Button, TextArea } from '../ui'

export default function JournalReviewDialog({
  id,
  onClose,
  onChanged,
}: {
  id: number
  onClose: () => void
  onChanged: () => void
}) {
  const read = useDashboardRead<JournalEntryWithAuthor>(
    `/journal/entries/${id}`,
    {},
    0,
  )
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (reply: boolean) => {
    if (busy || (reply && !draft.trim())) return
    setBusy(true)
    setError('')
    try {
      if (reply) await journalApi.addReply(id, draft.trim())
      else await journalApi.markRead(id)
      onChanged()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save this review.'))
    } finally {
      setBusy(false)
    }
  }
  const entry = read.data
  return (
    <Modal
      isOpen
      title={entry?.title ?? 'Journal review'}
      subtitle={entry?.student_name}
      onClose={() => {
        if (!busy) onClose()
      }}
      closeOnOverlayClick={!busy}
      size="lg"
    >
      {read.loading && <p role="status">Loading entry…</p>}
      {read.error && (
        <div role="alert">
          {read.error}
          <Button onClick={read.retry}>Try again</Button>
        </div>
      )}
      {entry && (
        <div className="space-y-4 break-words">
          <p className="text-sm text-muted">
            {new Date(entry.entry_date).toLocaleDateString()}{' '}
            {entry.mood ? `· ${entry.mood}` : ''}
          </p>
          <MarkdownRenderer content={entry.content} />
          {entry.win && (
            <p>
              <strong>Win:</strong> {entry.win}
            </p>
          )}
          {!!entry.goals?.length && (
            <ul>
              {entry.goals.map((goal) => (
                <li key={goal.id}>
                  {goal.done ? '✓ ' : ''}
                  {goal.text}
                </li>
              ))}
            </ul>
          )}
          {entry.replies.map((reply) => (
            <div key={reply.id} className="bg-panel-2 p-3 rounded-field">
              <p className="text-sm font-semibold">{reply.author_name}</p>
              <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
            </div>
          ))}
          <TextArea
            label="Reply to journal entry"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
          />
          {error && (
            <p role="alert" className="text-neg-fg">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy}
              disabled={!draft.trim()}
              onClick={() => void save(true)}
            >
              Send reply
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void save(false)}
            >
              Mark reviewed
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

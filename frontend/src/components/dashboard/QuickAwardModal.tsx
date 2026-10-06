import React, { useState, useEffect } from 'react'
import { pointsApi, StudentPoints, AwardPreset } from '../../services/points'
import { getErrorMessage } from '../../services/api'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
// Quick Award Points Modal Component
interface QuickAwardModalProps {
  onClose: () => void
  onSuccess: () => void
}

const QuickAwardModal: React.FC<QuickAwardModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [students, setStudents] = useState<StudentPoints[]>([])
  const [presets, setPresets] = useState<AwardPreset[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // `loadingStudents` starts true; state updates happen in the promise callbacks.
    pointsApi
      .getAdminOverview()
      .then((overview) => setStudents(overview.student_points))
      .catch(() => setError('Failed to load students'))
      .finally(() => setLoadingStudents(false))
    pointsApi
      .getPresets()
      .then(setPresets)
      .catch(() => {})
  }, [])

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStudentId || !amount || !notes.trim()) {
      setError('Please fill in all fields')
      return
    }

    const pointAmount = parseInt(amount)
    if (isNaN(pointAmount) || pointAmount <= 0) {
      setError('Please enter a valid positive point amount')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await pointsApi.adjustPoints({
        student_id: parseInt(selectedStudentId),
        amount: pointAmount,
        notes: notes.trim(),
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to award points'))
    } finally {
      setLoading(false)
    }
  }

  const FIELD =
    'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
  const LABEL =
    'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Quick Award Points"
      subtitle="Manually award points to a student"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={loading || loadingStudents}
            onClick={() => {
              const form = document.getElementById(
                'quick-award-form',
              ) as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            Award Points
          </Button>
        </>
      }
    >
      <form id="quick-award-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-neg-bg text-neg-fg px-4 py-3 rounded-field text-[13px]">
            {error}
          </div>
        )}

        <div>
          <label className={LABEL}>
            Student <span className="text-neg-fg normal-case">*</span>
          </label>
          {loadingStudents ? (
            <div className="h-[38px] bg-track rounded-field animate-pulse" />
          ) : (
            <select
              aria-label="Student receiving points"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className={FIELD}
              required
            >
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.student_id} value={s.student_id}>
                  {s.student_name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className={LABEL}>
            Points to Award <span className="text-neg-fg normal-case">*</span>
          </label>
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {presets.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setAmount(String(p.amount))
                    setNotes(p.label)
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-[12px] font-medium text-accent hover:bg-accent/20 transition-colors"
                >
                  <span>{p.label}</span>
                  <span className="font-semibold">+{p.amount}</span>
                </button>
              ))}
            </div>
          )}
          <input
            aria-label="Points to award"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 10"
            className={FIELD}
            required
          />
        </div>

        <div>
          <label className={LABEL}>
            Reason <span className="text-neg-fg normal-case">*</span>
          </label>
          <textarea
            aria-label="Reason for award"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain why you're awarding these points…"
            rows={3}
            className={FIELD}
            required
          />
        </div>
      </form>
    </Modal>
  )
}

export default QuickAwardModal

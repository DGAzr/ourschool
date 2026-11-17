import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { assignmentsApi } from '../services/assignments'
import { getErrorMessage } from '../services/api'

interface Draft { text: string; base: string }
const loadDraft = (key: string): Draft | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    return typeof value?.text === 'string' && typeof value?.base === 'string' ? value : null
  } catch { return null }
}

/** Serialized autosaves plus a per-student recovery draft, never canonical storage. */
export function useStudentNotes(assignmentId: number, studentId: number, initial: string, enabled: boolean) {
  const key = `ourschool.work-draft.${studentId}.${assignmentId}`
  const [draft, setDraft] = useState(() => loadDraft(key))
  const [notes, setNotes] = useState(() => draft?.base === initial ? draft.text : initial)
  const [saved, setSaved] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoverable, setRecoverable] = useState(() => !!draft)
  const latest = useRef(notes)
  const stored = useRef(initial)
  const inFlight = useRef<Promise<void> | null>(null)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const persist = useCallback((text: string, base: string) => {
    try {
      if (text === base) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, JSON.stringify({ text, base }))
      setRecoverable(true)
    } catch { setRecoverable(false) }
  }, [key])

  const change = (text: string) => {
    latest.current = text
    setNotes(text)
    persist(text, stored.current)
  }

  const flush = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current
    if (!enabled || latest.current === stored.current) return Promise.resolve()
    setSaving(true); setError(null)
    const save = async () => {
      while (latest.current !== stored.current) {
        const text = latest.current
        await assignmentsApi.updateStudentAssignment(assignmentId, { student_notes: text })
        stored.current = text
        // Preserve edits made during the request, with the newly saved base.
        try {
          if (text === latest.current) sessionStorage.removeItem(key)
          else sessionStorage.setItem(key, JSON.stringify({ text: latest.current, base: text }))
        } catch { /* Server-saved text remains canonical. */ }
        if (mounted.current) { setSaved(text); setDraft(null) }
      }
    }
    const pending = save().catch(err => {
      if (mounted.current) setError(getErrorMessage(err, 'Could not save your notes. Try again before leaving.'))
      throw err
    }).finally(() => {
      inFlight.current = null
      if (mounted.current) setSaving(false)
    })
    inFlight.current = pending
    return pending
  }, [assignmentId, enabled, key])

  useEffect(() => {
    if (!enabled || notes === saved) return
    const timer = window.setTimeout(() => { void flush().catch(() => {}) }, 600)
    return () => window.clearTimeout(timer)
  }, [enabled, notes, saved, flush])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current !== stored.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const blocker = useBlocker(enabled && notes !== saved)
  const blocked = blocker.state === 'blocked'
  const proceed = blocked ? blocker.proceed : undefined
  useEffect(() => {
    if (!proceed) return
    if (notes === saved) proceed()
    else void flush().catch(() => {})
  }, [proceed, flush, notes, saved])

  return {
    notes, change, saving, error, flush, blocker, recoverable,
    dirty: notes !== saved,
    conflict: draft && draft.base !== initial && draft.text !== initial ? draft : null,
    recover: () => { if (draft) change(draft.text); setDraft(null) },
    dismissDraft: () => { setDraft(null); persist(notes, stored.current) },
  }
}

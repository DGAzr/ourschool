import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api, ApiError, getErrorMessage } from '../services/api'
import { User } from '../types'
import Modal from './ui/Modal'

const field = 'w-full rounded-field border border-field-border bg-field-bg px-3 py-2.5 text-ink focus:ring-2 focus:ring-accent/30'
const button = 'min-h-[44px] rounded-field px-4 py-2 font-semibold text-sm bg-btn-primary-bg text-btn-primary-fg disabled:opacity-50'

export default function StudentSessionDialog({ returning, onClose }: { returning: boolean; onClose: () => void }) {
  const { switchToStudent, returnToAdmin, session, isTransitioning } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(!returning)
  const [selected, setSelected] = useState('')
  const [pinStep, setPinStep] = useState(returning)
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [blockedUntil, setBlockedUntil] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const firstPin = useRef<HTMLInputElement>(null)
  const student = students.find(candidate => candidate.id === Number(selected))
  useEffect(() => {
    if (returning) return
    let active = true
    const controller = new AbortController()
    api.get('/users/students', controller.signal).then((data: User[]) => {
      if (active) setStudents(data.filter(candidate => candidate.is_active))
    }).catch(error => {
      if (active) setError(getErrorMessage(error, 'Students could not be loaded.'))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [returning])
  useEffect(() => {
    if (pinStep) firstPin.current?.focus()
  }, [pinStep])
  useEffect(() => {
    if (!blockedUntil) return
    const update = () => setRemaining(Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [blockedUntil])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!pinStep) { setPinStep(true); return }
    if (!/^[0-9]{6}$/.test(pin)) { setError('Enter a six-digit PIN.'); return }
    if (!returning && pin !== confirmation) { setError('The PINs do not match.'); return }
    try {
      if (returning) await returnToAdmin(pin)
      else await switchToStudent(Number(selected), pin)
      navigate('/', { replace: true })
      onClose()
    } catch (error) {
      setError(getErrorMessage(error, 'The account could not be switched.'))
      setPin('')
      setConfirmation('')
      if (error instanceof ApiError && error.retryAfter > 0) {
        setBlockedUntil(Date.now() + error.retryAfter * 1000)
        setRemaining(error.retryAfter)
      }
      firstPin.current?.focus()
    }
  }
  const close = () => { if (!isTransitioning) onClose() }
  return <Modal isOpen onClose={close} size="sm"
    title={returning ? 'Return to Parent/Teacher' : 'Switch to Student'}
    subtitle={returning ? `Enter the PIN to return to ${session?.return_account_name ?? 'your account'}.` : 'Choose a student and set a PIN for returning to your account.'}
    showCloseButton={!isTransitioning} closeOnOverlayClick={!isTransitioning}>
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-field bg-neg-bg text-neg-fg p-3 text-sm">{error}</p>}
      {loading ? <p role="status">Loading students…</p> : !returning && !students.length ?
        !error && <p>Add an active student account before switching to a student.</p> : <>
        {!pinStep && <div>
          <label htmlFor="switch-student" className="block text-sm font-semibold mb-2">Student</label>
          <select id="switch-student" required value={selected} onChange={event => setSelected(event.target.value)} className={field}>
            <option value="">Choose a student</option>
            {students.map(student => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} ({student.username})</option>)}
          </select>
        </div>}
        {pinStep && <>
          {!returning && <p className="text-sm">Switching to <strong>{student?.first_name} {student?.last_name}</strong>. Their work will be saved to their account.</p>}
          <div>
            <label htmlFor="session-pin" className="block text-sm font-semibold mb-2">{returning ? 'PIN' : 'Set a six-digit PIN'}</label>
            <input ref={firstPin} id="session-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} required
              disabled={isTransitioning || remaining > 0} value={pin} onChange={event => setPin(event.target.value.replace(/[^0-9]/g, ''))} className={field} />
          </div>
          {!returning && <div>
            <label htmlFor="session-pin-confirm" className="block text-sm font-semibold mb-2">Confirm PIN</label>
            <input id="session-pin-confirm" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} required
              disabled={isTransitioning} value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/[^0-9]/g, ''))} className={field} />
          </div>}
          <p className="text-xs text-muted">{returning ? 'Forgot the PIN? Sign out, then log in to your account.' : 'This PIN is only used for this switch. All OurSchool tabs in this browser will switch together.'}</p>
          {remaining > 0 && <p role="status" className="text-sm">Try again in {Math.ceil(remaining / 60)} minute(s).</p>}
        </>}
        <div className="flex justify-end gap-2">
          {!returning && pinStep && <button type="button" disabled={isTransitioning} onClick={() => { setPinStep(false); setPin(''); setConfirmation(''); setError('') }} className="px-3 min-h-[44px] text-sm">Back</button>}
          <button className={button} disabled={isTransitioning || remaining > 0 || (!returning && !student)}>
            {isTransitioning ? 'Switching…' : returning ? 'Return to my account' : pinStep ? 'Switch' : 'Continue'}
          </button>
        </div>
      </>}
    </form>
  </Modal>
}

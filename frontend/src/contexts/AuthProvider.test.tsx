import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import { SessionState } from '../types/session'
import { User } from '../types'
import { STORAGE_KEYS } from '../constants/auth'
import { clearProtectedRequests, endSessionTransition } from '../services/api'

const parent = { id: 1, first_name: 'Parent', last_name: 'Teacher', role: 'admin', username: 'parent' } as User
const student = { ...parent, id: 2, first_name: 'Learner', role: 'student' } as User
const state = (guided = false): SessionState => ({ user: guided ? student : parent, is_guided: guided, return_account_name: guided ? 'Parent Teacher' : null, generation: guided ? 1 : 0, expires_at: null })
const token = (generation = 0) => `header.${btoa(JSON.stringify({ sid: 'browser-one', gen: generation, exp: Date.now() / 1000 + 3600, iat: Date.now() / 1000 }))}.signature`
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn()

function Probe() {
  const auth = useAuth()
  return <>
    <ProtectedRoute><p>{auth.user?.first_name}</p><textarea aria-label="Draft" defaultValue="Keep this draft" /></ProtectedRoute>
    <button onClick={() => void auth.extendSession()}>Renew</button>
    <button onClick={() => void auth.switchToStudent(2, '012345').catch(() => undefined)}>Switch</button>
    <button onClick={() => void auth.returnToAdmin('012345').catch(() => undefined)}>Return</button>
    <button onClick={() => auth.logout()}>Sign out</button>
  </>
}
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>
</QueryClientProvider>)

beforeEach(() => { localStorage.clear(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { endSessionTransition(); clearProtectedRequests(); vi.unstubAllGlobals() })

it('does not render a cached parent identity before server validation', async () => {
  const credential = token()
  localStorage.setItem(STORAGE_KEYS.TOKEN, credential)
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(parent))
  let respond!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(resolve => { respond = resolve }))
  show()
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  await act(async () => { respond(json(state())) })
  expect(await screen.findByText('Parent')).toBeVisible()
})

it('revalidates cross-tab identity changes and shows only the selected student', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token())
  fetchMock.mockResolvedValueOnce(json(state()))
  show()
  await screen.findByText('Parent')
  let respond!: (response: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { respond = resolve }))
  const next = token(1)
  localStorage.setItem(STORAGE_KEYS.TOKEN, next)
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.TOKEN, newValue: next })))
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
  await act(async () => { respond(json(state(true))) })
  expect(await screen.findByText('Learner')).toBeVisible()
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
})

it('keeps same-account drafts mounted during focus validation', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token())
  fetchMock.mockResolvedValueOnce(json(state())).mockResolvedValueOnce(json(state()))
  show()
  await screen.findByText('Parent')
  const draft = screen.getByLabelText('Draft')
  await userEvent.type(draft, ' updated')
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(screen.getByText('Parent')).toBeVisible())
  expect(screen.getByLabelText('Draft')).toBe(draft)
  expect(draft).toHaveValue('Keep this draft updated')
})

it('ignores a late parent renewal after switching to a student', async () => {
  const original = token()
  const next = token(1)
  localStorage.setItem(STORAGE_KEYS.TOKEN, original)
  let renew!: (response: Response) => void
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith('/auth/session')) return Promise.resolve(json(state()))
    if (url.endsWith('/auth/extend-session')) return new Promise<Response>(resolve => { renew = resolve })
    if (url.endsWith('/auth/switch-to-student')) return Promise.resolve(json({ access_token: next, session: state(true) }))
    return Promise.resolve(new Response(null, { status: 204 }))
  })
  show()
  await screen.findByText('Parent')
  await userEvent.click(screen.getByText('Renew'))
  await userEvent.click(screen.getByText('Switch'))
  expect(await screen.findByText('Learner')).toBeVisible()
  await act(async () => { renew(json({ access_token: original, session: state() })) })
  expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(next)
  expect(screen.getByText('Learner')).toBeVisible()
})

it('signs out if a switch response is lost instead of restoring the parent', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token())
  fetchMock.mockImplementation((url: string) => url.endsWith('/auth/session') ? Promise.resolve(json(state()))
    : url.endsWith('/auth/switch-to-student') ? Promise.reject(new TypeError('Network failure'))
      : Promise.resolve(new Response(null, { status: 204 })))
  show()
  await screen.findByText('Parent')
  await userEvent.click(screen.getByText('Switch'))
  await waitFor(() => expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull())
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
  expect(localStorage.getItem(STORAGE_KEYS.USER)).toBeNull()
})

it('pauses protected pages while another tab rotates credentials', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token())
  fetchMock.mockResolvedValueOnce(json(state())).mockResolvedValueOnce(json(state(true)))
  show()
  await screen.findByText('Parent')
  const marker = JSON.stringify({ started: Date.now(), owner: 'another-tab' })
  localStorage.setItem(STORAGE_KEYS.TRANSITION, marker)
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.TRANSITION, newValue: marker })))
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  localStorage.setItem(STORAGE_KEYS.TOKEN, token(1))
  localStorage.removeItem(STORAGE_KEYS.TRANSITION)
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.TRANSITION, newValue: null })))
  expect(await screen.findByText('Learner')).toBeVisible()
})

it('revalidates a restored history page without revealing a cached parent', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token(1))
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(parent))
  fetchMock.mockResolvedValueOnce(json(state(true)))
  show()
  expect(await screen.findByText('Learner')).toBeVisible()
  let respond!: (response: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { respond = resolve }))
  act(() => window.dispatchEvent(new Event('pageshow')))
  expect(screen.getByText('Learner')).not.toBeVisible()
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
  await act(async () => { respond(json(state(true))) })
  expect(screen.getByText('Learner')).toBeVisible()
})

it('returns with replacement credentials and clears the student view', async () => {
  const next = token(2)
  localStorage.setItem(STORAGE_KEYS.TOKEN, token(1))
  fetchMock.mockImplementation((url: string) => url.endsWith('/auth/session')
    ? Promise.resolve(json(state(true)))
    : Promise.resolve(json({ access_token: next, session: { ...state(), generation: 2 } })))
  show()
  await screen.findByText('Learner')
  await userEvent.click(screen.getByText('Return'))
  expect(await screen.findByText('Parent')).toBeVisible()
  expect(screen.queryByText('Learner')).not.toBeInTheDocument()
  expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(next)
})

it('clears protected pages when another tab signs out', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token())
  fetchMock.mockResolvedValueOnce(json(state()))
  show()
  await screen.findByText('Parent')
  localStorage.removeItem(STORAGE_KEYS.TOKEN)
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.TOKEN, newValue: null })))
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
  expect(localStorage.getItem(STORAGE_KEYS.USER)).toBeNull()
})

it('requires login after an abandoned cross-tab transition', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token())
  localStorage.setItem(STORAGE_KEYS.TRANSITION, JSON.stringify({ started: Date.now() - 31_000, owner: 'closed-tab' }))
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  show()
  await waitFor(() => expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull())
  expect(screen.queryByText('Parent')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), expect.anything())
})

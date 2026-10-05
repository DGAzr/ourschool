import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, UNAUTHORIZED_EVENT, beginSessionTransition, endSessionTransition, clearProtectedRequests } from './api'
import { STORAGE_KEYS } from '../constants/auth'

const fetchMock = vi.fn()

const jsonResponse = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})

afterEach(() => {
  endSessionTransition()
  clearProtectedRequests()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

it('does not let a stale 401 erase replacement credentials', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, 'old')
  let respond!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(resolve => { respond = resolve }))
  const pending = api.get('/users/me')
  localStorage.setItem(STORAGE_KEYS.TOKEN, 'new')
  respond(jsonResponse(401, { detail: 'old token' }))
  await expect(pending).rejects.toThrow(/account changed/i)
  expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe('new')
})

it('waits for pending writes and blocks new writes during switching', async () => {
  let respond!: (response: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(resolve => { respond = resolve }))
  const write = api.put('/users/me', { first_name: 'Saved' })
  let ready = false
  const transition = beginSessionTransition().then(() => { ready = true })
  await Promise.resolve()
  expect(ready).toBe(false)
  await expect(api.post('/assignments', {})).rejects.toThrow(/switch is in progress/i)
  respond(jsonResponse(200, { saved: true }))
  await write
  await transition
  expect(ready).toBe(true)
})

it('discards a late streamed response after an identity change', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, 'parent')
  let output!: ReadableStreamDefaultController<Uint8Array>
  fetchMock.mockResolvedValue(new Response(new ReadableStream({ start(controller) { output = controller } })))
  const pending = api.getBlob('/private-document')
  // Let fetch return its headers before changing identities.
  await Promise.resolve()
  localStorage.setItem(STORAGE_KEYS.TOKEN, 'student')
  clearProtectedRequests()
  output.enqueue(new TextEncoder().encode('private'))
  await expect(pending).rejects.toThrow(/account changed/i)
})

describe('api request wrapper', () => {
  it('attaches the stored bearer token to requests', async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, 'tok123')
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    await api.get('/users/me')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/users/me')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok123')
  })

  it('sends JSON Content-Type on normal requests', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))

    await api.post('/things', { a: 1 })

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    )
  })

  it('omits the JSON Content-Type for FormData uploads (postForm)', async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, 'tok123')
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'img1', url: '/api/shop/images/img1' }))

    const form = new FormData()
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'p.png')
    await api.postForm('/shop/images', form)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/shop/images')
    const headers = init.headers as Record<string, string>
    // Browser must set the multipart boundary itself.
    expect(headers['Content-Type']).toBeUndefined()
    // Auth still travels.
    expect(headers.Authorization).toBe('Bearer tok123')
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('returns parsed JSON on success and null on 204', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 7 }))
    await expect(api.get('/things/7')).resolves.toEqual({ id: 7 })

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(api.delete('/things/7')).resolves.toBeNull()
  })

  it('clears the session and dispatches an event on 401', async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, 'stale')
    localStorage.setItem(STORAGE_KEYS.USER, '{"id":1}')
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'expired' }))
    const listener = vi.fn()
    window.addEventListener(UNAUTHORIZED_EVENT, listener)

    await expect(api.get('/users/me')).rejects.toThrow(/session has expired/i)

    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.USER)).toBeNull()
    expect(listener).toHaveBeenCalled()
    window.removeEventListener(UNAUTHORIZED_EVENT, listener)
  })

  it('surfaces the backend detail message on non-401 errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { detail: 'Password change required' }))

    await expect(api.post('/journal', { title: 'x' })).rejects.toThrow(
      'Password change required'
    )
  })

  it('falls back to a status message for non-JSON error bodies', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>boom</html>', { status: 502, statusText: 'Bad Gateway' })
    )

    await expect(api.get('/health')).rejects.toThrow('API Error: 502 Bad Gateway')
  })
})

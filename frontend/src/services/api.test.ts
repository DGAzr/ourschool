import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, UNAUTHORIZED_EVENT } from './api'
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
  vi.unstubAllGlobals()
  fetchMock.mockReset()
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

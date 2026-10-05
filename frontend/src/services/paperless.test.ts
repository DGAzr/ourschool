import { afterEach, expect, it, vi } from 'vitest'
import { paperlessApi } from './paperless'
import { STORAGE_KEYS } from '../constants/auth'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('downloads with authorization, progress, and the original filename', async () => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, 'test-token')
  const controller = new AbortController()
  const progress = vi.fn()
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response('PDF', {
        headers: {
          'content-type': 'application/pdf',
          'content-length': '3',
          'content-disposition':
            "attachment; filename*=UTF-8''original%20name.pdf",
        },
      })
    )
  vi.stubGlobal('fetch', fetchMock)
  const result = await paperlessApi.download(42, controller.signal, progress)
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/42/content?disposition=attachment'),
    {
      cache: 'no-store',
      headers: { Authorization: 'Bearer test-token' },
      signal: expect.any(AbortSignal),
    }
  )
  expect(result.filename).toBe('original name.pdf')
  expect(result.blob.size).toBe(3)
  expect(progress).toHaveBeenCalledWith(3, 3)
})

it('propagates cancellation without completing a download', async () => {
  const controller = new AbortController()
  controller.abort()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
  )
  await expect(
    paperlessApi.download(42, controller.signal, vi.fn())
  ).rejects.toMatchObject({ name: 'AbortError' })
})

it('reports actionable download errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Library disconnected' }), {
          status: 409,
        })
      )
  )
  await expect(
    paperlessApi.download(42, new AbortController().signal, vi.fn())
  ).rejects.toThrow('Library disconnected')
})

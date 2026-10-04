import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import DocumentThumb from './DocumentThumb'
import { paperlessApi } from '../../services/paperless'

const state = vi.hoisted(() => ({ user: { id: 1 } as { id: number } | null }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: state.user }),
}))
vi.mock('../../services/paperless', () => ({
  paperlessApi: { fetchThumbnail: vi.fn() },
}))

beforeEach(() => {
  state.user = { id: 1 }
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:protected-thumb'),
    revokeObjectURL: vi.fn(),
  })
  vi.mocked(paperlessApi.fetchThumbnail).mockResolvedValue(new Blob(['image']))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it('fetches with cancellation and releases protected images on logout', async () => {
  const { rerender } = render(
    <DocumentThumb externalId="doc" title="Material" />
  )
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce())
  const signal = vi.mocked(paperlessApi.fetchThumbnail).mock.calls[0][1]!
  expect(signal.aborted).toBe(false)
  state.user = null
  rerender(<DocumentThumb externalId="doc" title="Material" />)
  expect(signal.aborted).toBe(true)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:protected-thumb')
})

it('reloads revised thumbnails and releases the replaced image', async () => {
  const { rerender, unmount } = render(
    <DocumentThumb externalId="doc" revision="one" title="Material" />
  )
  await waitFor(() =>
    expect(paperlessApi.fetchThumbnail).toHaveBeenCalledTimes(1)
  )
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1))
  rerender(<DocumentThumb externalId="doc" revision="two" title="Material" />)
  await waitFor(() =>
    expect(paperlessApi.fetchThumbnail).toHaveBeenCalledTimes(2)
  )
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  unmount()
  expect(vi.mocked(paperlessApi.fetchThumbnail).mock.calls[1][1]?.aborted).toBe(
    true
  )
})

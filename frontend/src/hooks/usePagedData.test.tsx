import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Page, usePagedData } from './usePagedData'

const page = (id: number, next: string | null = null): Page<number> => ({ items: [id], total: 151, next_cursor: next, counts: { all: 151 } })

describe('usePagedData', () => {
  it('navigates with cursors and resets on a new filter, keeping full counts', async () => {
    const load = vi.fn().mockResolvedValueOnce(page(1, 'second')).mockResolvedValueOnce(page(2)).mockResolvedValueOnce(page(150))
    const { result, rerender } = renderHook(({ search }) => usePagedData<number>({ search }, load), { initialProps: { search: '' } })
    await waitFor(() => expect(result.current.items).toEqual([1]))
    expect(result.current.counts.all).toBe(151)
    act(() => result.current.pagination.next())
    await waitFor(() => expect(result.current.items).toEqual([2]))
    expect(load.mock.calls[1][0].cursor).toBe('second')
    rerender({ search: '150' })
    await waitFor(() => expect(result.current.items).toEqual([150]))
    expect(load.mock.calls[2][0]).toEqual({ search: '150', cursor: undefined })
    expect(result.current.pagination.page).toBe(1)
  })

  it('aborts superseded requests and ignores late responses', async () => {
    let finish: (value: Page<number>) => void = () => {}
    const load = vi.fn().mockImplementationOnce(() => new Promise<Page<number>>(resolve => { finish = resolve }))
      .mockResolvedValueOnce(page(2))
    const { result, rerender } = renderHook(({ search }) => usePagedData<number>({ search }, load), { initialProps: { search: 'old' } })
    rerender({ search: 'new' })
    await waitFor(() => expect(result.current.items).toEqual([2]))
    expect(load.mock.calls[0][1].aborted).toBe(true)
    await act(async () => finish(page(1)))
    expect(result.current.items).toEqual([2])
  })

  it('moves back when a mutation empties the last page', async () => {
    const load = vi.fn().mockResolvedValueOnce(page(1, 'second')).mockResolvedValueOnce(page(2))
      .mockResolvedValueOnce({ items: [], total: 1, next_cursor: null }).mockResolvedValueOnce(page(1))
    const { result } = renderHook(() => usePagedData<number>({}, load))
    await waitFor(() => expect(result.current.items).toEqual([1]))
    act(() => result.current.pagination.next())
    await waitFor(() => expect(result.current.items).toEqual([2]))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.items).toEqual([1]))
    expect(result.current.pagination.page).toBe(1)
  })

  it('surfaces a failed request rather than showing an empty success', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Database unavailable'))
    const { result } = renderHook(() => usePagedData<number>({}, load))
    await waitFor(() => expect(result.current.error).toBe('Database unavailable'))
    expect(result.current.loading).toBe(false)
  })
})

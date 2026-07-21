/*
 * OurSchool - Homeschool Management System
 * Copyright (C) 2025 Dustan Ashley
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import { usePaperlessDocuments } from './usePaperlessDocuments'
import { paperlessApi, DocumentListParams } from '../services/paperless'
import { MaterialKind, PaperlessDocument } from '../types/paperless'

vi.mock('../services/paperless', () => ({
  paperlessApi: {
    listDocuments: vi.fn(),
  },
}))

const listDocuments = vi.mocked(paperlessApi.listDocuments)

const doc = (id: number): PaperlessDocument => ({
  id,
  external_id: `ext-${id}`,
  paperless_id: id,
  title: `Doc ${id}`,
  material_kind: 'worksheet' as MaterialKind,
  used_in_count: 0,
})

/** Serve a canned library: each call answers the requested window. */
const serveLibrary = (total: number) => {
  listDocuments.mockImplementation((params: DocumentListParams = {}) => {
    const offset = params.offset ?? 0
    const limit = params.limit ?? total
    const ids = Array.from(
      { length: Math.max(Math.min(total - offset, limit), 0) },
      (_, i) => offset + i + 1
    )
    return Promise.resolve({
      total,
      items: ids.map(doc),
      facets: { kinds: {}, subjects: {} },
    })
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('usePaperlessDocuments paging', () => {
  it('fetches the first page and reports hasMore', async () => {
    serveLibrary(150)
    const { result } = renderHook(() => usePaperlessDocuments({}))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(listDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 60, offset: 0 })
    )
    expect(result.current.documents).toHaveLength(60)
    expect(result.current.total).toBe(150)
    expect(result.current.hasMore).toBe(true)
  })

  it('loadMore appends the next window until the library is exhausted', async () => {
    serveLibrary(90)
    const { result } = renderHook(() => usePaperlessDocuments({}))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.loadMore())
    expect(listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 60, offset: 60 })
    )
    expect(result.current.documents.map((d) => d.id)).toEqual(
      Array.from({ length: 90 }, (_, i) => i + 1)
    )
    expect(result.current.hasMore).toBe(false)
  })

  it('a filter change resets to the first page', async () => {
    serveLibrary(90)
    const { result, rerender } = renderHook(
      (props: { kinds: MaterialKind[] }) => usePaperlessDocuments(props),
      { initialProps: { kinds: [] as MaterialKind[] } }
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.loadMore())
    expect(result.current.documents).toHaveLength(90)

    serveLibrary(40)
    rerender({ kinds: ['worksheet' as MaterialKind] })
    await waitFor(() => expect(result.current.documents).toHaveLength(40))
    expect(listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ kinds: ['worksheet'], limit: 60, offset: 0 })
    )
    expect(result.current.hasMore).toBe(false)
  })

  it('refresh re-fetches the whole shown window, not just one page', async () => {
    serveLibrary(150)
    const { result } = renderHook(() => usePaperlessDocuments({}))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.loadMore())
    expect(result.current.documents).toHaveLength(120)

    await act(() => result.current.refresh())
    expect(listDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 120, offset: 0 })
    )
    expect(result.current.documents).toHaveLength(120)
  })
})

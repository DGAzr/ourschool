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

import { useCallback, useEffect, useRef, useState } from 'react'

import { DocumentListParams, paperlessApi } from '../services/paperless'
import { getErrorMessage } from '../services/api'
import {
  MaterialKind,
  PaperlessDocument,
  PaperlessDocumentFacets,
} from '../types/paperless'

const SEARCH_DEBOUNCE_MS = 250
const DEFAULT_PAGE_SIZE = 60
// The backend clamps `limit` to 500; never ask for a bigger window.
const MAX_WINDOW = 500

interface UsePaperlessDocumentsParams {
  subjectIds?: number[]
  kinds?: MaterialKind[]
  query?: string
  lessonId?: number
  /** Page size; documents load a page at a time via loadMore(). */
  limit?: number
  /** Skip fetching entirely (e.g. while the connection status is unknown). */
  enabled?: boolean
}

/**
 * Fetch cached Paperless documents with facets, a page at a time. The
 * free-text query is debounced; facet/lesson changes fetch immediately and
 * reset to the first page, while loadMore() appends the next page. A
 * monotonically increasing request id drops stale responses so a slow
 * earlier request can't clobber (or append onto) a newer one.
 */
export const usePaperlessDocuments = ({
  subjectIds = [],
  kinds = [],
  query = '',
  lessonId,
  limit,
  enabled = true,
}: UsePaperlessDocumentsParams) => {
  const pageSize = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_WINDOW)
  const [documents, setDocuments] = useState<PaperlessDocument[]>([])
  const [facets, setFacets] = useState<PaperlessDocumentFacets>({
    kinds: {},
    subjects: {},
  })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  // Stable dependency keys for the array params.
  const subjectKey = subjectIds.join(',')
  const kindKey = kinds.join(',')

  const fetchWindow = useCallback(
    (offset: number, windowLimit: number) => {
      if (!enabled) return Promise.resolve()
      const append = offset > 0
      if (append) setLoadingMore(true)
      else setLoading(true)
      const seq = ++requestSeq.current
      const params: DocumentListParams = {
        subject_ids: subjectKey ? subjectKey.split(',').map(Number) : [],
        kinds: kindKey ? (kindKey.split(',') as MaterialKind[]) : [],
        q: query || undefined,
        lesson_id: lessonId,
        limit: windowLimit,
        offset,
      }
      return paperlessApi
        .listDocuments(params)
        .then((data) => {
          if (seq !== requestSeq.current) return
          setDocuments((prev) => (append ? [...prev, ...data.items] : data.items))
          setFacets(data.facets)
          setTotal(data.total)
          setError(null)
        })
        .catch((err) => {
          if (seq !== requestSeq.current) return
          setError(getErrorMessage(err, 'Failed to load documents.'))
          if (!append) {
            setDocuments([])
            setTotal(0)
          }
        })
        .finally(() => {
          if (seq === requestSeq.current) {
            setLoading(false)
            setLoadingMore(false)
          }
        })
    },
    [enabled, subjectKey, kindKey, query, lessonId]
  )

  const fetchFirstPage = useCallback(
    () => fetchWindow(0, pageSize),
    [fetchWindow, pageSize]
  )

  useEffect(() => {
    if (!enabled) return
    // Debounce only the free-text query; other param changes are immediate
    // (a single code path keeps request-ordering simple, and 250ms on facet
    // clicks is imperceptible). fetchWindow flips `loading` itself — inside
    // the timeout callback, per the set-state-in-effect rule.
    const timer = setTimeout(fetchFirstPage, query ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(timer)
  }, [enabled, fetchFirstPage, query])

  const loadMore = useCallback(
    () => fetchWindow(documents.length, pageSize),
    [fetchWindow, documents.length, pageSize]
  )

  const refresh = useCallback(async () => {
    // Re-fetch everything currently shown (not just the first page) so an
    // attach or sync doesn't collapse a grid the user has loaded out.
    await fetchWindow(0, Math.min(Math.max(documents.length, pageSize), MAX_WINDOW))
  }, [fetchWindow, documents.length, pageSize])

  return {
    documents,
    facets,
    total,
    loading,
    loadingMore,
    hasMore: documents.length < total,
    error,
    refresh,
    loadMore,
  }
}

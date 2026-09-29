import { useEffect, useState } from 'react'

export interface Page<T> {
  items: T[]
  total: number
  next_cursor: string | null
  counts?: Record<string, number>
}

/** Reset navigation on filter changes and discard superseded responses. */
export function usePagedData<T, R extends Page<T> = Page<T>>(
  filters: object,
  fetchPage: (params: Record<string, unknown>, signal: AbortSignal) => Promise<R>,
  enabled = true,
) {
  const key = JSON.stringify(filters)
  const [navigation, setNavigation] = useState<{ key: string; cursors: (string | undefined)[] }>({ key, cursors: [undefined] })
  const cursors = navigation.key === key ? navigation.cursors : [undefined]
  const cursor = cursors[cursors.length - 1]
  const [revision, setRevision] = useState(0)
  const requestKey = JSON.stringify([key, cursor, revision, enabled])
  const [result, setResult] = useState<{ key: string; data?: R; error?: string }>()

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchPage({ ...JSON.parse(key), cursor }, controller.signal).then(data => {
      if (!controller.signal.aborted) {
        // A mutation can empty the final page. Return to the preceding page.
        if (!data.items.length && cursor) {
          setNavigation(prev => ({ key, cursors: prev.key === key ? prev.cursors.slice(0, -1) : [undefined] }))
        } else setResult({ key: requestKey, data })
      }
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key: requestKey, error: error instanceof Error ? error.message : 'Unable to load this page' })
    })
    return () => controller.abort()
  }, [key, cursor, revision, requestKey, enabled, fetchPage])

  const current = result?.key === requestKey ? result : undefined
  const data = current?.data
  return {
    data, items: data?.items ?? [], total: data?.total ?? 0, counts: data?.counts ?? {},
    error: current?.error ?? null, loading: enabled && !current,
    refetch: () => setRevision(value => value + 1),
    pageKey: requestKey,
    pagination: {
      total: data?.total ?? 0, page: cursors.length,
      hasNext: !!data?.next_cursor, hasPrevious: cursors.length > 1,
      next: () => { if (data?.next_cursor) setNavigation({ key, cursors: [...cursors, data.next_cursor] }) },
      previous: () => { if (cursors.length > 1) setNavigation({ key, cursors: cursors.slice(0, -1) }) },
    },
  }
}

export function useDebouncedSearch(value: string) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), 250)
    return () => clearTimeout(timer)
  }, [value])
  return settled
}

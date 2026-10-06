import { useEffect, useState } from 'react'
import { api, getErrorMessage } from '../services/api'
import { dashboardHref } from '../utils/dashboard'

/** Keep a section mounted during refresh so unrelated actions never lose drafts. */
export function useDashboardRead<T>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
  version: number,
  enabled = true,
) {
  const key = dashboardHref(path, params)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: T
    error?: string
  }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    api
      .get(key, controller.signal)
      .then((data: T) => {
        if (!controller.signal.aborted) setResult({ key, data })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error: getErrorMessage(error, 'Could not load this section.'),
          })
      })
    return () => controller.abort()
  }, [key, version, retry, enabled])
  const current = enabled && result?.key === key ? result : undefined
  return {
    data: current?.data,
    error: current?.error,
    loading: enabled && !current,
    retry: () => setRetry((v) => v + 1),
  }
}

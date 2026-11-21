import { useCallback, useEffect, useRef, useState } from 'react'

import { useToast } from '../components/ui'
import { getErrorMessage } from '../services/api'
import { lessonsApi } from '../services/lessons'
import { LessonRolloverResponse } from '../types/lesson'
import { todayISO } from '../utils/dates'

export function useLessonRecovery(enabled: boolean, onMoved: () => void) {
  const { toast } = useToast()
  const callbacks = useRef({ onMoved, toast })
  const started = useRef(false)
  const requestId = useRef(0)
  const [data, setData] = useState<LessonRolloverResponse>()
  const [error, setError] = useState('')

  useEffect(() => {
    callbacks.current = { onMoved, toast }
  }, [onMoved, toast])

  const load = useCallback(async (apply: boolean) => {
    const id = ++requestId.current
    try {
      const result = await lessonsApi.rollover(todayISO(), apply)
      if (id === requestId.current) {
        setData(result)
        setError('')
      }
      const { onMoved, toast } = callbacks.current
      result.warnings.forEach(warning => toast(warning, 'danger'))
      if (result.moved_count > 0) {
        const destination = result.settings?.mode === 'carry' ? 'carried forward' : 'moved to the drawer'
        toast(`${result.moved_count} untaught ${result.moved_count === 1 ? 'lesson' : 'lessons'} ${destination}.`)
        onMoved()
      }
      return result
    } catch (err) {
      if (id === requestId.current) setError(getErrorMessage(err, 'Could not load untaught lessons.'))
    }
  }, [])

  useEffect(() => {
    if (!enabled || started.current) return
    started.current = true
    void load(true)
  }, [enabled, load])

  return { data, error, load }
}

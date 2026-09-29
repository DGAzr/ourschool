import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { StudentAssignment } from '../types'

/** A selected row is only editable after the full detail has loaded. */
export function useAssignmentDetail(id: number | null | undefined, revision = '') {
  const key = `${id ?? ''}:${revision}`
  const [state, setState] = useState<{ key: string; data?: StudentAssignment; error?: string }>()
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    api.get(`/assignments/student-assignments/${id}`, controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ key, data }) })
      .catch(error => { if (!controller.signal.aborted) setState({ key, error: error.message }) })
    return () => controller.abort()
  }, [id, key])
  return { data: state?.key === key ? state.data : undefined,
    error: state?.key === key ? state.error : undefined,
    loading: !!id && state?.key !== key }
}

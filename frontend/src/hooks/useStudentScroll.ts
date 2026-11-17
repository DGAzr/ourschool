import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Restore the app's scrolling pane after asynchronous student content is ready. */
export function useStudentScroll(ready: boolean) {
  const { user } = useAuth()
  const location = useLocation()
  const path = location.pathname + location.search
  const hash = location.hash
  useLayoutEffect(() => {
    if (!ready || user?.role !== 'student') return
    const pane = document.getElementById('school-main-content')
    if (!pane) return
    const key = `ourschool.scroll.${user.id}.${path}`
    let restored = false
    try {
      const saved = sessionStorage.getItem(key)
      if (saved !== null) { pane.scrollTop = Number(saved) || 0; restored = true }
    } catch { /* Optional UI state. */ }
    if (!restored) {
      const target = hash.startsWith('#lesson-') ? document.getElementById(hash.slice(1)) : null
      if (target) target.scrollIntoView({ block: 'start' })
      else pane.scrollTop = 0
    }
    const save = () => { try { sessionStorage.setItem(key, String(pane.scrollTop)) } catch { /* Optional UI state. */ } }
    pane.addEventListener('scroll', save, { passive: true })
    return () => { save(); pane.removeEventListener('scroll', save) }
  }, [ready, user?.id, user?.role, path, hash])
}

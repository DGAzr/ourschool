import { useContext, useEffect, useRef, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'

/** Account-scoped local recovery. Server saves remain explicit. */
export function useRecoverableDraft<T>(name: string, value: T, restore: (value: T) => void) {
  const auth = useContext(AuthContext)
  const key = auth?.user ? `ourschool.draft.${auth.user.id}.${name}` : null
  const [baseline] = useState(() => JSON.stringify(value))
  const serialized = JSON.stringify(value)
  const committed = useRef(false)
  const [recovery, setRecovery] = useState<T | null>(() => {
    if (!key) return null
    try { const raw = localStorage.getItem(key); const parsed=raw ? JSON.parse(raw).value : null; if(!parsed || typeof parsed!==typeof value || (typeof value==='object' && Object.keys(value as object).some(k=>!(k in parsed))))return null; return parsed as T } catch { return null }
  })
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null)
  const [storageError, setStorageError] = useState(false)
  const dirty = serialized !== baseline
  useEffect(() => {
    if (!key || committed.current || recovery !== null) return
    let active = true
    let failed = false
    try {
      if (dirty) localStorage.setItem(key, JSON.stringify({value, savedAt: new Date().toISOString()}))
      else localStorage.removeItem(key)
    } catch { failed = true }
    queueMicrotask(() => { if (active) setStorageError(failed) })
    return () => { active = false }
  }, [key, serialized, dirty, recovery, value])
  useEffect(() => {
    if (!dirty || committed.current) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank' || link.pathname === window.location.pathname || event.defaultPrevented) return
      event.preventDefault(); event.stopPropagation()
      setPendingClose(() => () => { committed.current = true; window.location.assign(link.href) })
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', navigate, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', navigate, true) }
  }, [dirty, storageError])
  return {
    recovery, dirty, storageError, pendingClose,
    cancelClose: () => setPendingClose(null),
    confirmClose: () => { const action = pendingClose; setPendingClose(null); action?.() },
    resume: () => { if (recovery !== null) { restore(recovery); setRecovery(null) } },
    discard: () => { if (key) {try{localStorage.removeItem(key)}catch{setStorageError(true)}}; setRecovery(null) },
    clear: () => { committed.current = true; if (key) {try{localStorage.removeItem(key)}catch{setStorageError(true)}} },
    close: (onClose: () => void) => {
      if (!dirty || committed.current) onClose()
      else setPendingClose(() => onClose)
    },
  }
}

import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext } from './AuthContext'
import { User } from '../types'
import { SessionState, SessionToken } from '../types/session'
import {
  isTokenExpired, isValidTokenFormat, isTokenNearExpiry, getTokenTimeRemaining,
  getTokenLifetime, formatTimeRemaining,
} from '../utils/auth'
import { config } from '../config/env'
import {
  api, ApiError, UNAUTHORIZED_EVENT, credentialIdentity,
  clearProtectedRequests, beginSessionTransition, endSessionTransition,
} from '../services/api'
import { AUTH_TIMEOUTS, STORAGE_KEYS } from '../constants'

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Stored user data is a convenience cache, never proof of authenticated identity.
  const [session, setSession] = useState<SessionState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)
  const queryClient = useQueryClient()
  const lastActivity = useRef(0)
  const transition = useRef(false)
  const renewing = useRef(false)
  const identity = useRef<string | null>(null)
  const verification = useRef(0)

  const clearViews = useCallback(() => {
    clearProtectedRequests()
    void queryClient.cancelQueries()
    queryClient.clear()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [queryClient])

  const clearLocal = useCallback(() => {
    verification.current += 1
    identity.current = null
    clearViews()
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER)
    localStorage.removeItem(STORAGE_KEYS.TRANSITION)
    setSession(null)
    setIsLoading(false)
    setTimeRemaining('')
    setShowExpiryWarning(false)
  }, [clearViews])

  const logout = useCallback((_reason?: string) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    // Use captured credentials; logout's late response must not affect a new login.
    if (token) void fetch(`${config.api.baseUrl}/auth/logout`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined)
    clearLocal()
  }, [clearLocal])

  const accept = useCallback((token: string, next: SessionState) => {
    if (!isValidTokenFormat(token) || isTokenExpired(token)) throw new Error('Invalid or expired session returned.')
    const nextIdentity = credentialIdentity(token)
    if (identity.current !== nextIdentity) clearViews()
    identity.current = nextIdentity
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(next.user))
    // Write credentials last so other tabs see a complete identity change.
    localStorage.setItem(STORAGE_KEYS.TOKEN, token)
    setSession(next)
    setIsLoading(false)
    setTimeRemaining(formatTimeRemaining(getTokenTimeRemaining(token)))
    setShowExpiryWarning(isTokenNearExpiry(token))
  }, [clearViews])

  const verifySession = useCallback(async () => {
    if (transition.current) return
    if (localStorage.getItem(STORAGE_KEYS.TRANSITION)) { setIsLoading(true); return }
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    const sequence = ++verification.current
    setIsLoading(true)
    if (!token || isTokenExpired(token)) {
      logout()
      return
    }
    if (identity.current !== credentialIdentity(token)) { clearViews(); setSession(null) }
    try {
      const next: SessionState = await api.get('/auth/session')
      if (sequence === verification.current && localStorage.getItem(STORAGE_KEYS.TOKEN) === token) accept(token, next)
    } catch {
      if (sequence !== verification.current || localStorage.getItem(STORAGE_KEYS.TOKEN) !== token) return
      // Validation failure cannot reveal cached pages. Keep transient failures
      // recoverable through login, without pretending that the old role is valid.
      setSession(null)
      setIsLoading(false)
      clearViews()
    }
  }, [accept, logout, clearViews])

  useEffect(() => {
    const bootstrap = window.setTimeout(() => { lastActivity.current = Date.now(); pauseOrValidate() }, 0)
    let recovery: number | undefined
    const pauseOrValidate = () => {
      window.clearTimeout(recovery)
      const marker = localStorage.getItem(STORAGE_KEYS.TRANSITION)
      if (marker) {
        clearViews()
        setSession(null)
        setIsLoading(true)
        let started = 0
        try { started = JSON.parse(marker).started } catch { /* Fail closed. */ }
        recovery = window.setTimeout(() => {
          if (localStorage.getItem(STORAGE_KEYS.TRANSITION) === marker) logout('Interrupted account switch')
        }, Math.max(0, Math.min(30_000, Number(started) + 30_000 - Date.now()) || 0))
      } else void verifySession()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.TOKEN && event.key !== STORAGE_KEYS.TRANSITION && event.key !== null) return
      if (event.key === STORAGE_KEYS.TRANSITION || localStorage.getItem(STORAGE_KEYS.TRANSITION)) { pauseOrValidate(); return }
      if (identity.current !== credentialIdentity(localStorage.getItem(STORAGE_KEYS.TOKEN))) clearViews()
      void verifySession()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') pauseOrValidate()
    }
    const onUnauthorized = () => clearLocal()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', pauseOrValidate)
    window.addEventListener('pageshow', pauseOrValidate)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      window.clearTimeout(bootstrap)
      window.clearTimeout(recovery)
      verification.current += 1
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', pauseOrValidate)
      window.removeEventListener('pageshow', pauseOrValidate)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [verifySession, clearLocal, clearViews, logout])

  const extendSession = useCallback(async () => {
    if (transition.current || renewing.current) return
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    if (!token) return
    renewing.current = true
    try {
      const result: SessionToken = await api.extendSession()
      if (localStorage.getItem(STORAGE_KEYS.TOKEN) === token && !transition.current) accept(result.access_token, result.session)
    } catch (error) {
      if (localStorage.getItem(STORAGE_KEYS.TOKEN) === token && error instanceof ApiError && error.status === 401) clearLocal()
    } finally { renewing.current = false }
  }, [accept, clearLocal])

  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
      if (!token || !session || transition.current) return
      if (isTokenExpired(token)) { logout(); return }
      setTimeRemaining(formatTimeRemaining(getTokenTimeRemaining(token)))
      setShowExpiryWarning(isTokenNearExpiry(token))
      const lifetime = getTokenLifetime(token)
      const remaining = getTokenTimeRemaining(token)
      if (Date.now() - lastActivity.current < Math.min(AUTH_TIMEOUTS.INACTIVITY_WARNING / 2, lifetime)
          && remaining <= Math.min(AUTH_TIMEOUTS.INACTIVITY_WARNING, lifetime / 2)) void extendSession()
    }
    const timer = window.setInterval(check, 5_000)
    return () => window.clearInterval(timer)
  }, [session, logout, extendSession])

  const changeIdentity = useCallback(async (endpoint: string, data: unknown) => {
    if (transition.current) throw new Error('An account switch is already in progress.')
    transition.current = true
    verification.current += 1
    setIsTransitioning(true)
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    try {
      await beginSessionTransition()
      if (token !== localStorage.getItem(STORAGE_KEYS.TOKEN)) throw new Error('The account changed. Sign in again.')
      const result: SessionToken = await api.post(endpoint, data, AbortSignal.timeout(30_000))
      if (token !== localStorage.getItem(STORAGE_KEYS.TOKEN)) throw new Error('The account changed. Sign in again.')
      accept(result.access_token, result.session)
      lastActivity.current = Date.now()
    } catch (error) {
      // A transport failure leaves the transition outcome unknown. Never recover
      // parent authority using an earlier token or a cached user record.
      if (!(error instanceof ApiError) && token === localStorage.getItem(STORAGE_KEYS.TOKEN)) {
        logout()
        throw new Error('The account switch could not be confirmed. Please sign in again.')
      }
      throw error
    } finally {
      endSessionTransition()
      transition.current = false
      setIsTransitioning(false)
    }
  }, [accept, logout])

  const login = useCallback((token: string, _user: User, next?: SessionState) => {
    verification.current += 1
    if (next) accept(token, next)
    else {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token)
      void verifySession()
    }
    lastActivity.current = Date.now()
  }, [accept, verifySession])
  const updateUser = useCallback((user: User) => {
    setSession(current => current ? { ...current, user } : null)
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  }, [])

  return <AuthContext.Provider value={{
    user: session?.user ?? null, session, login, logout, updateUser,
    isLoading, isTransitioning, isTokenValid: !!session && !isLoading,
    timeRemaining, showExpiryWarning, extendSession,
    refreshTokenCheck: () => { void verifySession() },
    trackActivity: () => { lastActivity.current = Date.now() },
    switchToStudent: (studentId, pin) => changeIdentity('/auth/switch-to-student', { student_id: studentId, pin }),
    returnToAdmin: pin => changeIdentity('/auth/return-to-admin', { pin }),
  }}>{children}</AuthContext.Provider>
}

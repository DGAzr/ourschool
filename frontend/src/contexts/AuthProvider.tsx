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

import React, { useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { AuthContext } from './AuthContext'
import { User } from '../types'
import {
  isTokenExpired,
  isTokenNearExpiry,
  isValidTokenFormat,
  getTokenTimeRemaining,
  formatTimeRemaining
} from '../utils/auth'
import { config } from '../config/env'
import { api, UNAUTHORIZED_EVENT } from '../services/api'
import { AUTH_TIMEOUTS, STORAGE_KEYS } from '../constants'

interface AuthProviderProps {
  children: ReactNode
}

/** Hydrate the stored session synchronously; returns null on any problem. */
const readStoredUser = (): User | null => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
  const userData = localStorage.getItem(STORAGE_KEYS.USER)
  if (!token || !userData) return null
  if (!isValidTokenFormat(token) || isTokenExpired(token)) return null
  try {
    return JSON.parse(userData) as User
  } catch {
    return null
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => readStoredUser())
  // Hydration happens synchronously in the useState initializer above, so
  // auth state is never "loading"; kept in the context API for consumers.
  const isLoading = false
  const [isTokenValid, setIsTokenValid] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)

  // Use refs to avoid stale closures in intervals
  const tokenCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningShown = useRef(false)
  const lastActivity = useRef<number>(0)
  const activityCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // Token validation function
  const validateToken = useCallback((token: string): boolean => {
    if (!isValidTokenFormat(token)) {
      return false
    }

    if (isTokenExpired(token)) {
      return false
    }

    return true
  }, [])

  // Forward declare startTokenMonitoring for use in extendSession
  const startTokenMonitoringRef = useRef<((token: string) => void) | null>(null)

  // Logout function with reason tracking
  const logout = useCallback((reason?: string) => {
    // Clear intervals
    if (tokenCheckInterval.current) {
      clearInterval(tokenCheckInterval.current)
      tokenCheckInterval.current = null
    }
    if (activityCheckInterval.current) {
      clearInterval(activityCheckInterval.current)
      activityCheckInterval.current = null
    }

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER)

    // Reset state
    setUser(null)
    setIsTokenValid(false)
    setTimeRemaining('')
    setShowExpiryWarning(false)
    warningShown.current = false

    // Log the logout reason for debugging (only in development)
    if (config.dev.debugMode && reason) {
      console.log(`User logged out: ${reason}`)
    }
  }, [])

  // Extend session function
  const extendSession = useCallback(async () => {
    try {
      const result = await api.extendSession()
      const newToken = result.access_token

      // Validate the returned token before trusting/storing it.
      if (!newToken || !isValidTokenFormat(newToken)) {
        logout('Invalid token returned from session extension')
        return
      }

      // Update token in localStorage
      localStorage.setItem(STORAGE_KEYS.TOKEN, newToken)

      // Reset warning state
      setShowExpiryWarning(false)
      warningShown.current = false

      // Restart token monitoring with new token
      if (startTokenMonitoringRef.current) {
        startTokenMonitoringRef.current(newToken)
      }

      if (config.dev.debugMode) {
        console.log('Session extended successfully')
      }
    } catch (error) {
      console.error('Failed to extend session:', error)
      // If extension fails, log the user out
      logout('Session extension failed')
    }
  }, [logout])

  // Track user activity
  const trackActivity = useCallback(() => {
    lastActivity.current = Date.now()
  }, [])

  // Start token monitoring
  const startTokenMonitoring = useCallback((token: string) => {
    // Starting (or restarting) monitoring counts as user activity.
    lastActivity.current = Date.now()

    // Clear any existing intervals
    if (tokenCheckInterval.current) {
      clearInterval(tokenCheckInterval.current)
    }
    if (activityCheckInterval.current) {
      clearInterval(activityCheckInterval.current)
    }

    const checkToken = () => {
      const currentToken = localStorage.getItem(STORAGE_KEYS.TOKEN)

      if (!currentToken || currentToken !== token) {
        logout('Token removed from storage')
        return
      }

      if (isTokenExpired(currentToken)) {
        logout('Token expired')
        return
      }

      const remaining = getTokenTimeRemaining(currentToken)
      setTimeRemaining(formatTimeRemaining(remaining))
      setIsTokenValid(true)

      // Check if we should show expiry warning
      const shouldShowWarning = isTokenNearExpiry(currentToken)
      setShowExpiryWarning(shouldShowWarning)

      // Show warning once when token is near expiry
      if (shouldShowWarning && !warningShown.current) {
        warningShown.current = true
        if (config.dev.debugMode) {
          console.warn('Token expiring soon!')
        }
      }
    }

    // Auto-extend session based on activity
    const checkActivity = async () => {
      const currentToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
      if (!currentToken) return

      const timeSinceActivity = Date.now() - lastActivity.current
      const remaining = getTokenTimeRemaining(currentToken)

      // If user has been active in the last 5 minutes and token expires in less than 10 minutes, extend it
      if (timeSinceActivity < AUTH_TIMEOUTS.INACTIVITY_WARNING / 2 && remaining < AUTH_TIMEOUTS.INACTIVITY_WARNING && remaining > 0) {
        try {
          await extendSession()
        } catch (error) {
          // Error handling is done in extendSession
          console.error('Auto-extend failed:', error)
        }
      }
    }

    // Check immediately
    checkToken()

    // Set up interval to check token every 30 seconds
    tokenCheckInterval.current = setInterval(checkToken, AUTH_TIMEOUTS.REFRESH_INTERVAL)

    // Set up interval to check activity every 2 minutes
    activityCheckInterval.current = setInterval(checkActivity, AUTH_TIMEOUTS.REFRESH_INTERVAL * 4) // Check every 2 minutes
  }, [logout, extendSession])

  // Keep the ref pointing at the latest startTokenMonitoring (latest-ref
  // pattern; refs must not be written during render).
  useEffect(() => {
    startTokenMonitoringRef.current = startTokenMonitoring
  })

  // Refresh token check function
  const refreshTokenCheck = useCallback(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    if (token) {
      startTokenMonitoring(token)
    }
  }, [startTokenMonitoring])

  // Bootstrap side effects for the session hydrated in the useState
  // initializer: start monitoring a valid session (deferred so the initial
  // token check's state updates don't run synchronously inside the effect),
  // or clear stale storage. State is already null for invalid sessions.
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    const userData = localStorage.getItem(STORAGE_KEYS.USER)
    if (!token && !userData) return

    if (token && userData && validateToken(token) && readStoredUser() !== null) {
      const timer = setTimeout(() => startTokenMonitoring(token), 0)
      return () => clearTimeout(timer)
    }

    // Invalid or expired session left in storage — remove it.
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.USER)
    if (config.dev.debugMode) {
      console.log('Cleared invalid or expired session on startup')
    }
  }, [validateToken, startTokenMonitoring])

  // React to a server-side 401 surfaced by the API layer: clear local state.
  useEffect(() => {
    const onUnauthorized = () => logout('Server rejected the session (401)')
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [logout])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tokenCheckInterval.current) {
        clearInterval(tokenCheckInterval.current)
      }
    }
  }, [])

  const updateUser = useCallback((userData: User) => {
    setUser(userData)
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData))
  }, [])

  // Enhanced login function with token validation
  const login = useCallback((token: string, userData: User) => {
    // Validate token before storing
    if (!isValidTokenFormat(token)) {
      throw new Error('Invalid token format provided')
    }

    // Store token and user data
    localStorage.setItem(STORAGE_KEYS.TOKEN, token)
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData))

    // Update state
    setUser(userData)

    // Start monitoring the new token
    startTokenMonitoring(token)

    // Reset warning state
    warningShown.current = false
  }, [startTokenMonitoring])

  const value = {
    user,
    login,
    logout,
    updateUser,
    isLoading,
    isTokenValid,
    timeRemaining,
    showExpiryWarning,
    refreshTokenCheck,
    extendSession,
    trackActivity
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

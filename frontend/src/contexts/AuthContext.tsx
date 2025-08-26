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

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { User } from '../types'
import { 
  isTokenExpired, 
  isTokenNearExpiry, 
  isValidTokenFormat,
  getTokenTimeRemaining,
  formatTimeRemaining
} from '../utils/auth'
import { config } from '../config/env'
import { api } from '../services/api'
import { AUTH_TIMEOUTS, STORAGE_KEYS } from '../constants'

interface AuthContextType {
  user: User | null
  login: (token: string, userData: User) => void
  logout: (reason?: string) => void
  isLoading: boolean
  isTokenValid: boolean
  timeRemaining: string
  showExpiryWarning: boolean
  refreshTokenCheck: () => void
  extendSession: () => Promise<void>
  trackActivity: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTokenValid, setIsTokenValid] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')
  const [showExpiryWarning, setShowExpiryWarning] = useState(false)
  
  // Use refs to avoid stale closures in intervals
  const tokenCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningShown = useRef(false)
  const lastActivity = useRef<number>(Date.now())
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

  // Assign the startTokenMonitoring function to the ref
  startTokenMonitoringRef.current = startTokenMonitoring

  // Refresh token check function
  const refreshTokenCheck = useCallback(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    if (token) {
      startTokenMonitoring(token)
    }
  }, [startTokenMonitoring])

  // Initial load effect
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    const userData = localStorage.getItem(STORAGE_KEYS.USER)
    
    if (token && userData) {
      try {
        // Validate token format and expiration
        if (validateToken(token)) {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
          startTokenMonitoring(token)
        } else {
          // Token is invalid or expired
          logout('Invalid or expired token on startup')
        }
      } catch (error) {
        // Invalid user data
        logout('Invalid user data in storage')
      }
    }
    
    setIsLoading(false)
  }, [validateToken, startTokenMonitoring, logout])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tokenCheckInterval.current) {
        clearInterval(tokenCheckInterval.current)
      }
    }
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
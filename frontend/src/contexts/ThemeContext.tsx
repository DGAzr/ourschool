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

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './AuthContext'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  systemPrefersDark: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { user } = useAuth()
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)

  // Detect system preference
  const detectSystemPreference = useCallback(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setSystemPrefersDark(mediaQuery.matches)
      return mediaQuery.matches
    }
    return false
  }, [])

  // Calculate effective theme (what actually gets applied)
  const effectiveTheme: 'light' | 'dark' = theme === 'system' 
    ? (systemPrefersDark ? 'dark' : 'light')
    : theme

  // Load theme preference from localStorage or user profile
  useEffect(() => {
    // First try to get from user profile if available
    if (user?.theme_preference) {
      setThemeState(user.theme_preference as ThemeMode)
    } else {
      // Fall back to localStorage
      const savedTheme = localStorage.getItem('theme') as ThemeMode
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme)
      } else {
        setThemeState('system')
      }
    }
  }, [user])

  // Set up system preference listener
  useEffect(() => {
    detectSystemPreference()
    
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        setSystemPrefersDark(e.matches)
      }
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [detectSystemPreference])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    
    if (effectiveTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [effectiveTheme])

  // Update theme preference
  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    
    // If user is logged in, try to save to profile
    if (user) {
      try {
        // This would be an API call to update user preferences
        // For now we'll just save to localStorage
        const response = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ theme_preference: newTheme })
        })
        
        if (!response.ok) {
          console.warn('Failed to save theme preference to server')
        }
      } catch (error) {
        console.warn('Error saving theme preference:', error)
      }
    }
  }, [user])

  // Toggle between light and dark (smart toggle)
  const toggleTheme = useCallback(() => {
    if (theme === 'system') {
      // If currently system, switch to opposite of current effective theme
      setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')
    } else {
      // If manual theme, cycle through: light -> dark -> system
      if (theme === 'light') {
        setTheme('dark')
      } else if (theme === 'dark') {
        setTheme('system')
      } else {
        setTheme('light')
      }
    }
  }, [theme, effectiveTheme, setTheme])

  const value = {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme,
    systemPrefersDark
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
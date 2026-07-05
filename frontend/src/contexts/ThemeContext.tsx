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

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useSyncExternalStore,
  ReactNode,
  useCallback,
} from 'react'
import { useAuth } from './AuthContext'
import { usersApi } from '../services/users'

type ThemeMode = 'light' | 'dark' | 'system'

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

const readValidTheme = (value: string | null): ThemeMode | null =>
  value === 'light' || value === 'dark' || value === 'system' ? value : null

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

const subscribeToSystemTheme = (onChange: () => void) => {
  const mediaQuery = darkQuery()
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

const getSystemPrefersDark = () => darkQuery().matches

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { user, updateUser } = useAuth()

  // Local (device) preference; hydrated once from localStorage.
  const [localTheme, setLocalTheme] = useState<ThemeMode | null>(() =>
    readValidTheme(localStorage.getItem('theme'))
  )

  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemPrefersDark,
    () => false
  )

  // Server-stored preference wins when logged in; localStorage covers the
  // login screen and logged-out state.
  const theme: ThemeMode = user?.theme_preference ?? localTheme ?? 'system'

  // Calculate effective theme (what actually gets applied)
  const effectiveTheme: 'light' | 'dark' = theme === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : theme

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement

    if (effectiveTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [effectiveTheme])

  // Update theme preference: always persisted locally; when logged in, also
  // persisted server-side so it follows the user across devices.
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setLocalTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    if (user) {
      // Optimistic: the cached user drives the derived theme immediately;
      // losing the server write is benign (local persistence still holds).
      updateUser({ ...user, theme_preference: newTheme })
      usersApi.updateMe({ theme_preference: newTheme }).catch((err) => {
        console.warn('Failed to save theme preference to server:', err)
      })
    }
  }, [user, updateUser])

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

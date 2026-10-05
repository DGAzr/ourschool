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

import { createContext, useContext } from 'react'
import { User } from '../types'
import { SessionState } from '../types/session'

export interface AuthContextType {
  user: User | null
  login: (token: string, userData: User, session?: SessionState) => void
  logout: (reason?: string) => void
  updateUser: (userData: User) => void
  isLoading: boolean
  isTokenValid: boolean
  timeRemaining: string
  showExpiryWarning: boolean
  refreshTokenCheck: () => void
  extendSession: () => Promise<void>
  trackActivity: () => void
  session?: SessionState | null
  isTransitioning?: boolean
  switchToStudent: (studentId: number, pin: string) => Promise<void>
  returnToAdmin: (pin: string) => Promise<void>
}

/** Raw context — consumed by AuthProvider; use useAuth() everywhere else. */
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

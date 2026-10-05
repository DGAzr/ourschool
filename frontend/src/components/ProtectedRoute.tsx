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

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth()

  if (!user && !isLoading) return <Navigate to="/login" replace />

  // Keep drafts mounted during same-account focus validation, but hide and
  // isolate protected content until the server has confirmed the session.
  return <>
    {isLoading && <div role="status" aria-label="Validating session" className="flex min-h-screen items-center justify-center bg-bg">
      <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
    </div>}
    <div hidden={isLoading} inert={isLoading}>{user ? children : null}</div>
  </>
}

export default ProtectedRoute

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

import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import TokenExpiryWarning from './components/TokenExpiryWarning'
import ToastProvider from './components/ui/Toast'
import { useEffect, Suspense, lazy } from 'react'

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Users = lazy(() => import('./pages/Users'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Assignments = lazy(() => import('./pages/Assignments'))
const Subjects = lazy(() => import('./pages/Subjects'))
const Terms = lazy(() => import('./pages/Terms'))
const Profile = lazy(() => import('./pages/Profile'))
const Reports = lazy(() => import('./pages/Reports'))
const Journal = lazy(() => import('./pages/Journal'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminBackup = lazy(() => import('./pages/AdminBackup'))
const AdminPoints = lazy(() => import('./pages/AdminPoints'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))
const AdminAPIKeys = lazy(() => import('./pages/AdminAPIKeys'))
const MyPoints = lazy(() => import('./pages/MyPoints'))

const PageLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-bg">
    <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
  </div>
)

function AppContent() {
  const { extendSession, trackActivity } = useAuth()

  // Add global activity tracking
  useEffect(() => {
    const handleActivity = () => {
      trackActivity()
    }

    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [trackActivity])

  return (
    <ThemeProvider>
      <ToastProvider>
      <Suspense fallback={<PageLoadingSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="terms" element={<Terms />} />
            <Route path="reports" element={<Reports />} />
            <Route path="journal" element={<Journal />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<Admin />} />
            <Route path="admin/backup" element={<AdminBackup />} />
            <Route path="admin/points" element={<AdminPoints />} />
            <Route path="admin/settings" element={<AdminSettings />} />
            <Route path="admin/api-keys" element={<AdminAPIKeys />} />
            <Route path="my-points" element={<MyPoints />} />
          </Route>
        </Routes>
      </Suspense>
      <TokenExpiryWarning onExtendSession={extendSession} />
      </ToastProvider>
    </ThemeProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
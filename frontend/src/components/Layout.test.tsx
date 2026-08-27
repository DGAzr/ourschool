import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import Layout from './Layout'
import { AuthContext, AuthContextType } from '../contexts/AuthContext'
import { PointsStatusContext } from '../contexts/PointsStatusContext'
import { PaperlessStatusContext } from '../contexts/PaperlessStatusContext'
import { ThemeContext } from '../contexts/ThemeContext'
import { User } from '../types'

const admin: User = {
  id: 1,
  email: 'teacher@example.com',
  username: 'teacher',
  first_name: 'Teacher',
  last_name: 'One',
  role: 'admin',
  is_active: true,
  created_at: '',
  updated_at: '',
}

const authValue = (user: User): AuthContextType => ({
  user,
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  isLoading: false,
  isTokenValid: true,
  timeRemaining: '',
  showExpiryWarning: false,
  refreshTokenCheck: vi.fn(),
  extendSession: vi.fn(),
  trackActivity: vi.fn(),
})

const renderLayout = (user: User, entry: string) =>
  render(
    <AuthContext.Provider value={authValue(user)}>
      <PointsStatusContext.Provider
        value={{
          enabled: false,
          ready: true,
          balanceVersion: 0,
          notifyBalanceChanged: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <PaperlessStatusContext.Provider
          value={{
            status: null,
            connected: false,
            ready: true,
            error: null,
            refresh: vi.fn(),
            applyStatus: vi.fn(),
          }}
        >
          <ThemeContext.Provider
            value={{
              theme: 'light',
              effectiveTheme: 'light',
              setTheme: vi.fn(),
              toggleTheme: vi.fn(),
              systemPrefersDark: false,
            }}
          >
            <MemoryRouter initialEntries={[entry]}>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route path="teach" element={<div>Teach page</div>} />
                  <Route path="assignments" element={<div>Assignments page</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ThemeContext.Provider>
        </PaperlessStatusContext.Provider>
      </PointsStatusContext.Provider>
    </AuthContext.Provider>
  )

describe('Layout lesson navigation', () => {
  it('places Teach immediately after Dashboard and highlights its route for teachers', () => {
    renderLayout(admin, '/teach')
    const links = within(screen.getByRole('navigation')).getAllByRole('link')
    expect(links.slice(0, 4).map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Teach',
      'Attendance',
      'Lesson Planning',
    ])
    expect(screen.getByRole('link', { name: 'Teach' })).toHaveClass('bg-nav-active')
    expect(screen.getByRole('link', { name: 'Lesson Planning' })).not.toHaveClass(
      'bg-nav-active'
    )
  })

  it('does not expose Teach navigation to students', () => {
    renderLayout({ ...admin, id: 2, role: 'student' }, '/assignments')
    expect(screen.queryByRole('link', { name: 'Teach' })).toBeNull()
  })
})

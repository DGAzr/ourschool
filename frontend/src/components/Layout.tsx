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

import React, { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import PointsDisplay from './PointsDisplay'
import {
  Home,
  Calendar,
  ClipboardList,
  GraduationCap,
  LogOut,
  Menu,
  X,
  BarChart3,
  PenTool,
  Settings,
  Coins,
  Sun,
  Moon,
  Monitor,
  BookOpen,
} from 'lucide-react'

const OurSchoolMark: React.FC = () => (
  <div className="flex items-center gap-2.5 select-none">
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center text-btn-primary-fg"
      style={{ background: 'var(--btn-primary-bg)' }}
    >
      <GraduationCap size={16} />
    </div>
    <span className="text-[15px] font-semibold text-ink tracking-[-0.01em]">OurSchool</span>
  </div>
)

const ThemeCycler: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const cycle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <button
      onClick={cycle}
      title={`Theme: ${theme}`}
      aria-label={`Switch theme (current: ${theme})`}
      className="w-8 h-8 flex items-center justify-center rounded-field text-muted hover:text-ink hover:bg-track transition-colors duration-150"
    >
      <Icon size={15} />
    </button>
  )
}

const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    ...(isAdmin
      ? [
          { name: 'Attendance', href: '/attendance', icon: Calendar },
          { name: 'Assignments', href: '/assignments', icon: ClipboardList },
          { name: 'Templates', href: '/templates', icon: BookOpen },
          { name: 'Grading', href: '/grading', icon: GraduationCap },
          { name: 'Journal', href: '/journal', icon: PenTool },
          { name: 'Reports', href: '/reports', icon: BarChart3 },
          { name: 'Settings', href: '/admin', icon: Settings },
        ]
      : [
          { name: 'Assignments', href: '/assignments', icon: ClipboardList },
          { name: 'Journal', href: '/journal', icon: PenTool },
          { name: 'My Points', href: '/my-points', icon: Coins },
          { name: 'My Progress', href: '/reports', icon: BarChart3 },
        ]),
  ]

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="h-14 px-5 flex items-center border-b border-line flex-shrink-0">
        <OurSchoolMark />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`relative flex items-center gap-3 mx-2 px-3 py-2 rounded-[9px] text-[13.5px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-nav-active text-ink'
                  : 'text-muted hover:text-ink hover:bg-nav-active'
              }`}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon
                size={16}
                className={isActive ? 'text-accent' : 'text-faint'}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User chip */}
      <div className="px-3 py-3 border-t border-line flex-shrink-0 space-y-1">
        {!isAdmin && (
          <div className="px-2 pb-1">
            <PointsDisplay compact />
          </div>
        )}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Link to="/profile" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 flex-1 min-w-0 group">
            <div className="w-7 h-7 rounded-full bg-track flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-ink-2 font-mono">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink truncate leading-tight group-hover:text-accent transition-colors">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[11px] text-faint leading-tight">
                {isAdmin ? 'Teacher' : 'Student'}
              </p>
            </div>
          </Link>
          <ThemeCycler />
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="w-8 h-8 flex items-center justify-center rounded-field text-muted hover:text-danger hover:bg-neg-bg transition-colors duration-150"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'var(--overlay)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop fixed, mobile slide-in */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[208px] bg-panel border-r border-line flex-col
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:flex
          ${sidebarOpen ? 'flex translate-x-0' : '-translate-x-full'}`}
      >
        {/* Mobile close */}
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="absolute top-3 right-3 lg:hidden w-8 h-8 flex items-center justify-center rounded-field text-muted hover:text-ink"
        >
          <X size={16} />
        </button>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:pl-[208px] min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden h-12 px-4 bg-panel border-b border-line flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="w-8 h-8 flex items-center justify-center rounded-field text-muted hover:text-ink hover:bg-track"
          >
            <Menu size={16} />
          </button>
          <OurSchoolMark />
          <div className="flex items-center gap-1">
            {!isAdmin && <PointsDisplay compact />}
            <ThemeCycler />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-7 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout

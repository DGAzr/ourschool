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
import ThemeToggle from './ThemeToggle'
import PointsDisplay from './PointsDisplay'
import { 
  Home, 
  Calendar, 
  BookOpen, 
  ClipboardList, 
  LogOut,
  GraduationCap,
  Menu,
  X,
  BarChart3,
  PenTool,
  Shield,
  Coins,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    ...(isAdmin ? [
      { name: 'Admin Center', href: '/admin', icon: Shield },
      { name: 'Attendance', href: '/attendance', icon: Calendar },
      { name: 'Lessons', href: '/lessons', icon: BookOpen },
      { name: 'Assignments', href: '/assignments', icon: ClipboardList },
      { name: 'Journal', href: '/journal', icon: PenTool },
      { name: 'Reports', href: '/reports', icon: BarChart3 },
    ] : [
      { name: 'My Assignments', href: '/assignments', icon: ClipboardList },
      { name: 'My Journal', href: '/journal', icon: PenTool },
      { name: 'My Points', href: '/my-points', icon: Coins },
      { name: 'My Progress', href: '/reports', icon: BarChart3 },
    ])
  ]

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-800 shadow-lg transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:relative lg:flex lg:flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'} w-64`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center">
            <GraduationCap className="h-8 w-8 text-blue-500" />
            {!sidebarCollapsed && (
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">OurSchool</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:block p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <div className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  title={sidebarCollapsed ? item.name : undefined}
                  className={`group flex items-center text-sm font-medium rounded-md transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border-r-2 border-blue-700 dark:border-blue-400'
                      : 'text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  } ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2'}`}
                >
                  <Icon className={`${sidebarCollapsed ? 'h-8 w-8' : 'h-5 w-5'} ${
                    isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400'
                  } ${sidebarCollapsed ? '' : 'mr-3'}`} />
                  {!sidebarCollapsed && item.name}
                </Link>
              )
            })}
          </div>
        </nav>
        
        {/* User info and logout at bottom of sidebar */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          {sidebarCollapsed ? (
            /* Collapsed sidebar bottom section */
            <div className="flex flex-col items-center space-y-3">
              {/* User avatar */}
              <Link 
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                title={`${user?.first_name} ${user?.last_name}`}
                className="flex-shrink-0"
              >
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                  <span className="text-base font-medium text-blue-800 dark:text-blue-200">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
              </Link>
              
              {/* Points Display for Students - collapsed */}
              {!isAdmin && (
                <div title="My Points">
                  <PointsDisplay compact />
                </div>
              )}
              
              {/* Theme Toggle - collapsed */}
              <div title="Toggle theme">
                <ThemeToggle size="sm" />
              </div>
              
              {/* Logout - collapsed */}
              <button
                onClick={handleLogout}
                title="Logout"
                className="flex items-center justify-center p-2 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-md hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
              >
                <LogOut className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </button>
            </div>
          ) : (
            /* Expanded sidebar bottom section */
            <>
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <Link 
                    to="/profile"
                    onClick={() => setSidebarOpen(false)}
                    className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-150"
                  >
                    {user?.first_name} {user?.last_name}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.role === 'admin' ? 'Administrator' : 'Student'}
                  </p>
                </div>
              </div>
              
              {/* Points Display for Students */}
              {!isAdmin && (
                <div className="mb-3">
                  <PointsDisplay />
                </div>
              )}
              
              {/* Theme Toggle */}
              <div className="mb-3">
                <ThemeToggle showLabel size="sm" className="w-full justify-start" />
              </div>
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-md hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150"
              >
                <LogOut className="mr-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
                Logout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top bar for mobile */}
        <div className="lg:hidden bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              <GraduationCap className="h-6 w-6 text-blue-500" />
              <span className="ml-2 text-lg font-bold text-gray-900 dark:text-white">OurSchool</span>
            </div>
            <div className="flex items-center space-x-3">
              <PointsDisplay compact />
              <ThemeToggle size="sm" />
            </div>
          </div>
        </div>

        <main className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
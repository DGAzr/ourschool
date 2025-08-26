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

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { pointsApi, type PointsSystemStatus } from '../services/points'
import LicenseNotice from '../components/LicenseNotice'
import { 
  Users, 
  Calendar, 
  BookOpen, 
  ClipboardList, 
  Palette,
  CalendarDays,
  BarChart3,
  HardDrive,
  Settings,
  Shield,
  Coins
} from 'lucide-react'

interface AdminSection {
  id: string
  name: string
  description: string
  icon: React.ComponentType<any>
  path: string
  color: string
}

const Admin: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pointsStatus, setPointsStatus] = useState<PointsSystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPointsStatus = async () => {
      try {
        const status = await pointsApi.getSystemStatus()
        setPointsStatus(status)
      } catch (err) {
        // If points API fails, assume system is disabled
        setPointsStatus({ enabled: false, can_toggle: false })
      } finally {
        setLoading(false)
      }
    }
    
    if (user?.role === 'admin') {
      loadPointsStatus()
    } else {
      setLoading(false)
    }
  }, [user])

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can access this area.</p>
      </div>
    )
  }

  const adminSections: AdminSection[] = [
    {
      id: 'users',
      name: 'User Management',
      description: 'Manage administrators and students',
      icon: Users,
      path: '/users',
      color: 'bg-blue-500'
    },
    {
      id: 'attendance',
      name: 'Attendance Tracking',
      description: 'Record and manage student attendance',
      icon: Calendar,
      path: '/attendance',
      color: 'bg-purple-500'
    },
    {
      id: 'lessons',
      name: 'Lesson Management',
      description: 'Create and organize lesson plans',
      icon: BookOpen,
      path: '/lessons',
      color: 'bg-orange-500'
    },
    {
      id: 'subjects',
      name: 'Subject Configuration',
      description: 'Set up and manage academic subjects',
      icon: Palette,
      path: '/subjects',
      color: 'bg-pink-500'
    },
    {
      id: 'terms',
      name: 'Academic Terms',
      description: 'Configure semesters and grading periods',
      icon: CalendarDays,
      path: '/terms',
      color: 'bg-indigo-500'
    },
    {
      id: 'assignments',
      name: 'Assignment Center',
      description: 'Manage templates and grade assignments',
      icon: ClipboardList,
      path: '/assignments',
      color: 'bg-yellow-500'
    },
    {
      id: 'reports',
      name: 'Reports & Analytics',
      description: 'View comprehensive system reports',
      icon: BarChart3,
      path: '/reports',
      color: 'bg-red-500'
    }
  ]

  const allSystemSections: AdminSection[] = [
    {
      id: 'points',
      name: 'Points Management',
      description: 'Manage student points and gamification system',
      icon: Coins,
      path: '/admin/points',
      color: 'bg-yellow-500'
    },
    {
      id: 'backup',
      name: 'System Backup',
      description: 'Export and import system data',
      icon: HardDrive,
      path: '/admin/backup',
      color: 'bg-gray-500'
    },
    {
      id: 'settings',
      name: 'System Settings',
      description: 'Configure application preferences and API keys',
      icon: Settings,
      path: '/admin/settings',
      color: 'bg-cyan-500'
    }
  ]

  // Filter out points management if system is disabled
  const systemSections = allSystemSections.filter(section => {
    if (section.id === 'points') {
      return pointsStatus?.enabled === true
    }
    return true
  })

  const handleSectionClick = (section: AdminSection) => {
    // Use React Router navigation instead of full page reload
    navigate(section.path)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading admin center...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg">
        <div className="px-6 py-8">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-white mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-white">
                Administration Center
              </h1>
              <p className="text-blue-100 text-lg mt-1">
                Centralized management for your homeschool system
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Academic Management Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Academic Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {adminSections.map((section) => {
            const Icon = section.icon
            return (
              <div
                key={section.id}
                onClick={() => handleSectionClick(section)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500"
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className={`${section.color} p-3 rounded-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {section.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {section.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* System Administration Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          System Administration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systemSections.map((section) => {
            const Icon = section.icon
            return (
              <div
                key={section.id}
                onClick={() => handleSectionClick(section)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500"
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className={`${section.color} p-3 rounded-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {section.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {section.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Stats Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          System Overview
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 text-center">
            Quick system statistics and overview will be displayed here in future updates.
          </p>
        </div>
      </div>

      {/* License Information */}
      <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <LicenseNotice />
        </div>
      </div>

    </div>
  )
}

export default Admin
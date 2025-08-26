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
import { LucideIcon } from 'lucide-react'

interface PageLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  icon?: LucideIcon
  headerColor?: 'blue' | 'red' | 'purple' | 'green' | 'orange' | 'indigo' | 'gray'
  actions?: React.ReactNode
  loading?: boolean
  error?: string | null
  accessDenied?: boolean
  accessDeniedMessage?: string
}

const colorClasses = {
  blue: 'from-blue-600 via-blue-700 to-blue-800',
  red: 'from-red-600 via-red-700 to-red-800',
  purple: 'from-purple-600 via-purple-700 to-purple-800',
  green: 'from-green-600 via-green-700 to-green-800',
  orange: 'from-orange-600 via-orange-700 to-orange-800',
  indigo: 'from-indigo-600 via-indigo-700 to-indigo-800',
  gray: 'from-gray-600 via-gray-700 to-gray-800'
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  subtitle,
  icon: Icon,
  headerColor = 'blue',
  actions,
  loading = false,
  error = null,
  accessDenied = false,
  accessDeniedMessage = 'Access denied'
}) => {
  const gradientClass = colorClasses[headerColor]

  // Access denied state
  if (accessDenied) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{accessDeniedMessage}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium">Error</h3>
              <div className="mt-2 text-sm">
                {error}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header Section */}
        <div className={`bg-gradient-to-r ${gradientClass} rounded-xl shadow-lg`}>
          <div className="px-8 py-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {Icon && (
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold tracking-wide mb-1">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className={`text-${headerColor}-100 text-lg`}>
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {actions && (
                <div className="flex items-center space-x-3">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg min-h-96 flex items-center justify-center">
            <div className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600 dark:text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export default PageLayout
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

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAPIKeys } from '../hooks/useAPIKeys'
import { APIKeyTable, CreateAPIKeyModal } from '../components/api-keys'
import Breadcrumb, { type BreadcrumbItem } from '../components/Breadcrumb'
import ErrorBoundary from '../components/ErrorBoundary'
import { 
  Key, 
  Shield, 
  Plus, 
  AlertTriangle,
  TrendingUp,
  Clock,
  Settings
} from 'lucide-react'

/**
 * Admin page for managing API keys and external integrations.
 * 
 * Features:
 * - Create, view, and delete API keys
 * - Real-time usage statistics and monitoring
 * - Permission-based access control
 * - Auto-refresh functionality
 * - Security warnings and best practices guidance
 */
const AdminAPIKeys: React.FC = () => {
  const { user } = useAuth()
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  const {
    apiKeys,
    stats,
    loading,
    refreshing,
    error,
    expandedStats,
    autoRefresh,
    lastRefresh,
    refreshData,
    toggleAPIKeyActive,
    deleteAPIKey,
    toggleStatsExpanded,
    toggleAutoRefresh,
    setError
  } = useAPIKeys()

  // Check admin access
  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can manage API keys.</p>
      </div>
    )
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
  }

  // Keyboard shortcuts for the main page
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle shortcuts when no modal is open and user has focus on the page
    if (showCreateModal || document.activeElement?.tagName === 'INPUT') return

    switch (event.key) {
      case 'n':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          setShowCreateModal(true)
        }
        break
      case 'r':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          refreshData()
        }
        break
      case '?':
        if (event.shiftKey) {
          event.preventDefault()
          // Show keyboard shortcuts help (could be implemented as a tooltip or modal)
          alert('Keyboard Shortcuts:\n\nCtrl+N - Create new API key\nCtrl+R - Refresh data\n? - Show this help')
        }
        break
    }
  }, [showCreateModal, refreshData])

  // Add keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Breadcrumb items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Administration', href: '/admin' },
    { label: 'System Settings', href: '/admin/settings', icon: Settings },
    { label: 'API Key Management', current: true, icon: Key }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center space-x-2">
          <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-20"></div>
          <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-4"></div>
          <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-24"></div>
          <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-4"></div>
          <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-32"></div>
        </div>
        
        {/* Header Skeleton */}
        <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg h-32"></div>
        
        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg p-3 h-12 w-12"></div>
                <div className="ml-4 space-y-2">
                  <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-3 w-16"></div>
                  <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-6 w-8"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Table Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-5 w-24"></div>
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-3 w-48 mt-2"></div>
              </div>
              <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-8 w-32"></div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-12 w-48"></div>
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-6 w-20"></div>
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-16"></div>
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-24"></div>
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-4 w-20"></div>
                <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded h-8 w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Key className="h-8 w-8 text-white mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-white">
                  API Key Management
                </h1>
                <p className="text-blue-100 text-lg mt-1">
                  Manage secure access for external integrations
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-lg font-medium flex items-center"
              title="Create API Key (Ctrl+N)"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create API Key
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Key className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Keys</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.total_keys}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Keys</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.active_keys}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="bg-yellow-500 p-3 rounded-lg">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Recently Used</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.recently_used_keys}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Last 30 days</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="bg-red-500 p-3 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Expired Keys</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.expired_keys}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Table */}
      <ErrorBoundary
        onError={(error, errorInfo) => {
          if (process.env.NODE_ENV === 'development') {
            console.error('API Key Table Error:', error, errorInfo)
          }
        }}
        showDetails={process.env.NODE_ENV === 'development'}
      >
        <APIKeyTable
          apiKeys={apiKeys}
          expandedStats={expandedStats}
          onToggleStatsExpanded={toggleStatsExpanded}
          onToggleActive={toggleAPIKeyActive}
          onDelete={deleteAPIKey}
          refreshing={refreshing}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={toggleAutoRefresh}
          lastRefresh={lastRefresh}
          onRefresh={refreshData}
        />
      </ErrorBoundary>

      {/* Security Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">API Key Security</h3>
            <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
              <p>• API keys provide direct access to your OurSchool data - treat them like passwords</p>
              <p>• Only share API keys with trusted applications and developers</p>
              <p>• Regularly review and rotate API keys, especially for production integrations</p>
              <p>• Monitor usage and disable any suspicious or unused keys immediately</p>
              <p>• Use the minimum required permissions for each integration</p>
            </div>
          </div>
        </div>
      </div>


      {/* Create API Key Modal */}
      <ErrorBoundary
        onError={(error, errorInfo) => {
          if (process.env.NODE_ENV === 'development') {
            console.error('Create API Key Modal Error:', error, errorInfo)
          }
          setShowCreateModal(false) // Close modal on error
        }}
        showDetails={process.env.NODE_ENV === 'development'}
      >
        <CreateAPIKeyModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
          error={error}
          setError={setError}
        />
      </ErrorBoundary>
    </div>
  )
}

export default AdminAPIKeys
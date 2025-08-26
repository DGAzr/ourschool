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
import { apiKeysApi, formatLastUsed } from '../../services/apiKeys'
import { TrendingUp, Calendar, Clock, AlertTriangle } from 'lucide-react'

interface APIKeyDetailsPanelProps {
  /** The ID of the API key to display details for */
  apiKeyId: number
}

interface APIKeyStats {
  id: number
  name: string
  created_at: string
  last_used_at?: string
  is_active: boolean
  is_expired: boolean
  permissions_count: number
  permissions: string[]
}

/**
 * Displays detailed usage statistics and information for a specific API key.
 * 
 * Features:
 * - Usage statistics (permissions count, creation date, last used)
 * - Permission list with visual badges
 * - Security monitoring notice
 * - Loading and error states
 */
const APIKeyDetailsPanel: React.FC<APIKeyDetailsPanelProps> = ({ apiKeyId }) => {
  const [keyStats, setKeyStats] = useState<APIKeyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadKeyStats = async () => {
      try {
        setLoading(true)
        setError(null)
        const stats = await apiKeysApi.getAPIKeyStats(apiKeyId)
        setKeyStats(stats)
      } catch (err: any) {
        setError('Failed to load usage statistics')
      } finally {
        setLoading(false)
      }
    }

    loadKeyStats()
  }, [apiKeyId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading usage statistics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!keyStats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No statistics available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Usage Statistics for {keyStats.name}
      </h4>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center">
            <div className="bg-blue-500 p-2 rounded">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Permissions</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {keyStats.permissions_count || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center">
            <div className="bg-green-500 p-2 rounded">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {keyStats.created_at ? new Date(keyStats.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center">
            <div className="bg-purple-500 p-2 rounded">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Used</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatLastUsed(keyStats.last_used_at)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Permissions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
        <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Permissions</h5>
        <div className="flex flex-wrap gap-2">
          {keyStats.permissions?.map((permission: string) => (
            <span 
              key={permission} 
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {permission}
            </span>
          )) || []}
        </div>
        {(!keyStats.permissions || keyStats.permissions.length === 0) && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No permissions assigned</p>
        )}
      </div>
      
      {/* Security Monitoring Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200">Monitoring Note</h5>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Usage statistics are updated in real-time. Monitor for unusual activity patterns and disable keys immediately if suspicious behavior is detected.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default APIKeyDetailsPanel
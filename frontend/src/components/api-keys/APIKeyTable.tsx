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
import { 
  type APIKey, 
  formatLastUsed, 
  formatExpiration, 
  getStatusText 
} from '../../services/apiKeys'
import { 
  Key, 
  Eye, 
  AlertTriangle, 
  TrendingUp, 
  Trash2, 
  RotateCcw 
} from 'lucide-react'
import APIKeyDetailsPanel from './APIKeyDetailsPanel'

interface APIKeyTableProps {
  /** Array of API keys to display */
  apiKeys: APIKey[]
  /** Set of expanded API key IDs for stats view */
  expandedStats: Set<number>
  /** Function to toggle stats expansion for an API key */
  onToggleStatsExpanded: (apiKeyId: number) => void
  /** Function to handle enable/disable toggle */
  onToggleActive: (apiKey: APIKey) => void
  /** Function to handle API key deletion */
  onDelete: (apiKeyId: number) => void
  /** Whether data is currently refreshing */
  refreshing?: boolean
  /** Auto-refresh enabled state */
  autoRefresh?: boolean
  /** Function to toggle auto-refresh */
  onToggleAutoRefresh?: (enabled: boolean) => void
  /** Last refresh timestamp */
  lastRefresh?: Date
  /** Function to manually refresh data */
  onRefresh?: () => void
}

/**
 * Table component for displaying and managing API keys.
 * 
 * Features:
 * - Sortable columns for key information
 * - Expandable rows showing detailed statistics
 * - Action buttons for enable/disable and delete
 * - Auto-refresh controls
 * - Status indicators with color coding
 * - Responsive design for mobile devices
 */
const APIKeyTable: React.FC<APIKeyTableProps> = ({
  apiKeys,
  expandedStats,
  onToggleStatsExpanded,
  onToggleActive,
  onDelete,
  refreshing = false,
  autoRefresh = false,
  onToggleAutoRefresh,
  lastRefresh = new Date(),
  onRefresh
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              API Keys
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Manage API keys for external system integrations
            </p>
          </div>
          {/* Refresh Controls */}
          <div className="flex items-center space-x-3">
            {onToggleAutoRefresh && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-refresh"
                  checked={autoRefresh}
                  onChange={(e) => onToggleAutoRefresh(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="auto-refresh" className="text-sm text-gray-600 dark:text-gray-400">
                  Auto-refresh (30s)
                </label>
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
                title="Refresh data"
              >
                <RotateCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          {/* Table Header */}
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name & Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Last Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {apiKeys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No API keys created yet</p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                    Create your first API key to enable external integrations
                  </p>
                </td>
              </tr>
            ) : (
              apiKeys.map((apiKey) => (
                <React.Fragment key={apiKey.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    {/* Name & Key Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {apiKey.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {apiKey.key_prefix}...
                        </div>
                      </div>
                    </td>

                    {/* Status Column */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        apiKey.is_active && !apiKey.is_expired
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : apiKey.is_expired
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {getStatusText(apiKey)}
                      </span>
                    </td>

                    {/* Permissions Column */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {apiKey.permissions.length} permission{apiKey.permissions.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {apiKey.permissions.slice(0, 2).join(', ')}
                        {apiKey.permissions.length > 2 && ` +${apiKey.permissions.length - 2} more`}
                      </div>
                    </td>

                    {/* Last Used Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatLastUsed(apiKey.last_used_at)}
                    </td>

                    {/* Expires Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatExpiration(apiKey.expires_at)}
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {/* View Stats Button */}
                        <button
                          onClick={() => onToggleStatsExpanded(apiKey.id)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title={expandedStats.has(apiKey.id) ? 'Hide usage details' : 'Show usage details'}
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Enable/Disable Button */}
                        <button
                          onClick={() => onToggleActive(apiKey)}
                          className={`${
                            apiKey.is_active 
                              ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                              : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                          }`}
                          title={apiKey.is_active ? 'Disable API key' : 'Enable API key'}
                        >
                          {apiKey.is_active ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => onDelete(apiKey.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete API key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Stats Row */}
                  {expandedStats.has(apiKey.id) && (
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td colSpan={6} className="px-6 py-4">
                        <APIKeyDetailsPanel apiKeyId={apiKey.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default APIKeyTable
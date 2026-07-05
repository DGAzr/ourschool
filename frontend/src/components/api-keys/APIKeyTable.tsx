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
  apiKeys: APIKey[]
  expandedStats: Set<number>
  onToggleStatsExpanded: (apiKeyId: number) => void
  onToggleActive: (apiKey: APIKey) => void
  onDelete: (apiKeyId: number) => void
  refreshing?: boolean
  autoRefresh?: boolean
  onToggleAutoRefresh?: (enabled: boolean) => void
  lastRefresh?: Date
  onRefresh?: () => void
}

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
    <div className="bg-panel border border-line rounded-card-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">API Keys</h2>
          <p className="text-[12px] text-muted mt-0.5">Manage keys for external system integrations</p>
        </div>
        <div className="flex items-center gap-3">
          {onToggleAutoRefresh && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => onToggleAutoRefresh(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--accent)] rounded"
              />
              <span className="text-[12px] text-muted">Auto-refresh (30s)</span>
            </label>
          )}
          <span className="text-[11px] text-faint">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-field text-muted hover:text-ink hover:bg-panel-2 disabled:opacity-40 transition-colors"
              title="Refresh"
              aria-label="Refresh API keys"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-panel-2 border-b border-line">
            <tr>
              {['Name & Key', 'Status', 'Permissions', 'Last Used', 'Expires', 'Actions'].map((col) => (
                <th
                  key={col}
                  className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {apiKeys.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <Key className="h-10 w-10 text-faintest mx-auto mb-3" />
                  <p className="text-[13px] text-muted">No API keys created yet</p>
                  <p className="text-[12px] text-faint mt-1">Create your first API key to enable external integrations</p>
                </td>
              </tr>
            ) : (
              apiKeys.map((apiKey) => (
                <React.Fragment key={apiKey.id}>
                  <tr className="hover:bg-panel-2 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="text-[13px] font-medium text-ink">{apiKey.name}</div>
                      <div className="text-[12px] text-faint font-mono mt-0.5">{apiKey.key_prefix}...</div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        apiKey.is_active && !apiKey.is_expired
                          ? 'bg-pos-bg text-pos-fg'
                          : apiKey.is_expired
                          ? 'bg-neg-bg text-neg-fg'
                          : 'bg-panel-2 text-muted'
                      }`}>
                        {getStatusText(apiKey)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="text-[13px] text-ink">
                        {apiKey.permissions.length} permission{apiKey.permissions.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-[11px] text-faint mt-0.5">
                        {apiKey.permissions.slice(0, 2).join(', ')}
                        {apiKey.permissions.length > 2 && ` +${apiKey.permissions.length - 2} more`}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-[13px] text-muted whitespace-nowrap">
                      {formatLastUsed(apiKey.last_used_at)}
                    </td>

                    <td className="px-5 py-3.5 text-[13px] text-muted whitespace-nowrap">
                      {formatExpiration(apiKey.expires_at)}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onToggleStatsExpanded(apiKey.id)}
                          className="p-1.5 rounded-field text-muted hover:text-ink hover:bg-panel-2 transition-colors"
                          title={expandedStats.has(apiKey.id) ? 'Hide details' : 'Show details'}
                          aria-label={expandedStats.has(apiKey.id) ? 'Hide API key details' : 'Show API key details'}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => onToggleActive(apiKey)}
                          className={`p-1.5 rounded-field transition-colors ${
                            apiKey.is_active
                              ? 'text-neg-fg hover:bg-neg-bg'
                              : 'text-pos-fg hover:bg-pos-bg'
                          }`}
                          title={apiKey.is_active ? 'Disable API key' : 'Enable API key'}
                          aria-label={apiKey.is_active ? 'Disable API key' : 'Enable API key'}
                        >
                          {apiKey.is_active
                            ? <AlertTriangle className="h-3.5 w-3.5" />
                            : <TrendingUp className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          onClick={() => onDelete(apiKey.id)}
                          className="p-1.5 rounded-field text-neg-fg hover:bg-neg-bg transition-colors"
                          title="Delete API key"
                          aria-label="Delete API key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedStats.has(apiKey.id) && (
                    <tr className="bg-panel-2">
                      <td colSpan={6} className="px-5 py-5">
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

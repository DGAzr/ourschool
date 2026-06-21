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
        <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full animate-spin" />
        <span className="ml-2 text-[13px] text-muted">Loading usage statistics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-neg-fg">{error}</p>
      </div>
    )
  }

  if (!keyStats) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-faint">No statistics available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-[14px] font-semibold text-ink">
        Usage Statistics for {keyStats.name}
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-panel border border-line rounded-card p-4 flex items-center gap-3">
          <div className="bg-accent/10 p-2 rounded-field">
            <TrendingUp className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-[11px] text-muted uppercase tracking-wide font-medium">Permissions</p>
            <p className="text-[16px] font-semibold text-ink">{keyStats.permissions_count || 0}</p>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-card p-4 flex items-center gap-3">
          <div className="bg-pos-bg p-2 rounded-field">
            <Calendar className="h-4 w-4 text-pos-fg" />
          </div>
          <div>
            <p className="text-[11px] text-muted uppercase tracking-wide font-medium">Created</p>
            <p className="text-[16px] font-semibold text-ink">
              {keyStats.created_at ? new Date(keyStats.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-card p-4 flex items-center gap-3">
          <div className="bg-panel-2 p-2 rounded-field">
            <Clock className="h-4 w-4 text-muted" />
          </div>
          <div>
            <p className="text-[11px] text-muted uppercase tracking-wide font-medium">Last Used</p>
            <p className="text-[16px] font-semibold text-ink">{formatLastUsed(keyStats.last_used_at)}</p>
          </div>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-card p-4">
        <h5 className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-3">Permissions</h5>
        <div className="flex flex-wrap gap-2">
          {(keyStats.permissions ?? []).map((permission: string) => (
            <span
              key={permission}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent"
            >
              {permission}
            </span>
          ))}
        </div>
        {(!keyStats.permissions || keyStats.permissions.length === 0) && (
          <p className="text-[13px] text-faint">No permissions assigned</p>
        )}
      </div>

      <div className="flex items-start gap-2 bg-panel border border-line rounded-card p-4">
        <AlertTriangle className="h-4 w-4 text-muted flex-shrink-0 mt-0.5" />
        <div>
          <h5 className="text-[12px] font-semibold text-ink mb-1">Monitoring Note</h5>
          <p className="text-[12px] text-muted">
            Usage statistics are updated in real-time. Monitor for unusual activity patterns and disable keys immediately if suspicious behavior is detected.
          </p>
        </div>
      </div>
    </div>
  )
}

export default APIKeyDetailsPanel

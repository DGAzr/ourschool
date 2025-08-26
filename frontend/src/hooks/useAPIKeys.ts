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

import { useState, useEffect, useCallback } from 'react'
import { 
  apiKeysApi, 
  type APIKey, 
  type SystemAPIKeyStats 
} from '../services/apiKeys'

/**
 * Custom hook for managing API key state and operations.
 * 
 * Features:
 * - Centralized state management for API keys and statistics
 * - Auto-refresh functionality with configurable intervals
 * - Error handling and loading states
 * - CRUD operations with optimistic updates
 * - Statistics tracking and expandable details
 */
export const useAPIKeys = () => {
  // Data state
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [stats, setStats] = useState<SystemAPIKeyStats | null>(null)
  
  // Loading and error states
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // UI state
  const [expandedStats, setExpandedStats] = useState<Set<number>>(new Set())
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  /**
   * Load API keys and system statistics from the server.
   * 
   * @param showRefreshing - Whether to show refreshing state instead of loading
   */
  const loadData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      const [keysData, statsData] = await Promise.all([
        apiKeysApi.getAPIKeys(),
        apiKeysApi.getSystemStats()
      ])
      
      setApiKeys(keysData)
      setStats(statsData)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load API keys')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  /**
   * Refresh data with visual feedback.
   */
  const refreshData = useCallback(() => {
    loadData(true)
  }, [loadData])

  /**
   * Toggle the active state of an API key.
   * 
   * @param apiKey - The API key to toggle
   */
  const toggleAPIKeyActive = useCallback(async (apiKey: APIKey) => {
    try {
      setError(null)
      
      // Optimistic update
      setApiKeys(prevKeys => 
        prevKeys.map(key => 
          key.id === apiKey.id 
            ? { ...key, is_active: !key.is_active }
            : key
        )
      )
      
      await apiKeysApi.updateAPIKey(apiKey.id, { is_active: !apiKey.is_active })
      
      // Reload data to ensure consistency
      await loadData(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update API key')
      // Revert optimistic update on error
      await loadData(true)
    }
  }, [loadData])

  /**
   * Delete an API key after confirmation.
   * 
   * @param apiKeyId - The ID of the API key to delete
   * @returns Promise<boolean> - Whether the deletion was successful
   */
  const deleteAPIKey = useCallback(async (apiKeyId: number): Promise<boolean> => {
    const apiKey = apiKeys.find(key => key.id === apiKeyId)
    
    if (!apiKey) {
      setError('API key not found')
      return false
    }

    if (!confirm(`Are you sure you want to delete the API key "${apiKey.name}"? This action cannot be undone.`)) {
      return false
    }

    try {
      setError(null)
      
      // Optimistic update
      setApiKeys(prevKeys => prevKeys.filter(key => key.id !== apiKeyId))
      
      await apiKeysApi.deleteAPIKey(apiKeyId)
      
      // Reload data to update statistics
      await loadData(true)
      
      return true
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete API key')
      // Revert optimistic update on error
      await loadData(true)
      return false
    }
  }, [apiKeys, loadData])

  /**
   * Toggle the expanded stats view for an API key.
   * 
   * @param apiKeyId - The ID of the API key to toggle
   */
  const toggleStatsExpanded = useCallback((apiKeyId: number) => {
    setExpandedStats(prev => {
      const newSet = new Set(prev)
      if (newSet.has(apiKeyId)) {
        newSet.delete(apiKeyId)
      } else {
        newSet.add(apiKeyId)
      }
      return newSet
    })
  }, [])

  /**
   * Toggle auto-refresh functionality.
   * 
   * @param enabled - Whether auto-refresh should be enabled
   */
  const toggleAutoRefresh = useCallback((enabled: boolean) => {
    setAutoRefresh(enabled)
  }, [])

  /**
   * Clear any current error message.
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load initial data
  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      refreshData()
    }, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [autoRefresh, refreshData])

  // Return all state and functions
  return {
    // Data
    apiKeys,
    stats,
    
    // State
    loading,
    refreshing,
    error,
    expandedStats,
    autoRefresh,
    lastRefresh,
    
    // Actions
    loadData,
    refreshData,
    toggleAPIKeyActive,
    deleteAPIKey,
    toggleStatsExpanded,
    toggleAutoRefresh,
    clearError,
    setError
  }
}
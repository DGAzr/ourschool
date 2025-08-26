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

import { api } from './api'

// API Key interfaces
export interface APIKeyCreate {
  name: string
  permissions: string[]
  expires_at?: string // ISO date string
}

export interface APIKeyUpdate {
  name?: string
  permissions?: string[]
  is_active?: boolean
  expires_at?: string // ISO date string
}

export interface APIKey {
  id: number
  name: string
  key_prefix: string
  permissions: string[]
  is_active: boolean
  created_by: number
  last_used_at?: string
  expires_at?: string
  created_at: string
  updated_at: string
  is_expired: boolean
  is_valid: boolean
}

export interface APIKeyWithSecret extends APIKey {
  api_key: string // Full API key - only returned on creation/regeneration
}

export interface APIKeyStats {
  id: number
  name: string
  created_at: string
  last_used_at?: string
  is_active: boolean
  is_expired: boolean
  permissions_count: number
  permissions: string[]
}

export interface SystemAPIKeyStats {
  total_keys: number
  active_keys: number
  inactive_keys: number
  expired_keys: number
  recently_used_keys: number
}

export interface PermissionInfo {
  permission: string
  description: string
  category: string
}

export interface AvailablePermissions {
  permissions: PermissionInfo[]
  categories: string[]
}

// API service
export const apiKeysApi = {
  // Get available permissions
  getAvailablePermissions: async (): Promise<AvailablePermissions> => {
    return await api.get('/admin/api-keys/permissions')
  },

  // Create a new API key
  createAPIKey: async (data: APIKeyCreate): Promise<APIKeyWithSecret> => {
    return await api.post('/admin/api-keys/', data)
  },

  // List all API keys
  getAPIKeys: async (): Promise<APIKey[]> => {
    return await api.get('/admin/api-keys/')
  },

  // Get system-wide API key statistics
  getSystemStats: async (): Promise<SystemAPIKeyStats> => {
    return await api.get('/admin/api-keys/stats')
  },

  // Get specific API key
  getAPIKey: async (id: number): Promise<APIKey> => {
    return await api.get(`/admin/api-keys/${id}`)
  },

  // Get API key usage statistics
  getAPIKeyStats: async (id: number): Promise<APIKeyStats> => {
    return await api.get(`/admin/api-keys/${id}/stats`)
  },

  // Update API key
  updateAPIKey: async (id: number, data: APIKeyUpdate): Promise<APIKey> => {
    return await api.put(`/admin/api-keys/${id}`, data)
  },

  // Regenerate API key
  regenerateAPIKey: async (id: number): Promise<APIKeyWithSecret> => {
    return await api.post(`/admin/api-keys/${id}/regenerate`, {})
  },

  // Delete API key
  deleteAPIKey: async (id: number): Promise<void> => {
    await api.delete(`/admin/api-keys/${id}`)
  }
}

// Permission categories and descriptions
export const PERMISSION_CATEGORIES = {
  'Students': 'Access to student information and profiles',
  'Attendance': 'Access to attendance records and tracking',
  'Assignments': 'Access to assignment data and submissions',
  'Points': 'Access to student points and gamification system',
  'Reports': 'Access to reports and analytics',
  'Administration': 'Administrative system access'
}

// Helper functions
export const formatLastUsed = (lastUsedAt?: string): string => {
  if (!lastUsedAt) return 'Never'
  
  const date = new Date(lastUsedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60))
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  }
  
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`
  
  return date.toLocaleDateString()
}

export const formatExpiration = (expiresAt?: string): string => {
  if (!expiresAt) return 'Never'
  
  const date = new Date(expiresAt)
  const now = new Date()
  
  if (date < now) return 'Expired'
  
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays < 1) return 'Expires today'
  if (diffDays === 1) return 'Expires tomorrow'
  if (diffDays < 7) return `Expires in ${diffDays} days`
  if (diffDays < 30) return `Expires in ${Math.floor(diffDays / 7)} weeks`
  if (diffDays < 365) return `Expires in ${Math.floor(diffDays / 30)} months`
  
  return date.toLocaleDateString()
}

export const getStatusColor = (apiKey: APIKey): string => {
  if (!apiKey.is_active) return 'text-gray-500'
  if (apiKey.is_expired) return 'text-red-600'
  
  // Check if expiring soon (within 30 days)
  if (apiKey.expires_at) {
    const expiryDate = new Date(apiKey.expires_at)
    const thirtyDaysFromNow = new Date()
    // Use proper date arithmetic that handles month boundaries correctly
    thirtyDaysFromNow.setTime(thirtyDaysFromNow.getTime() + (30 * 24 * 60 * 60 * 1000))
    
    if (expiryDate < thirtyDaysFromNow) return 'text-yellow-600'
  }
  
  return 'text-green-600'
}

export const getStatusText = (apiKey: APIKey): string => {
  if (!apiKey.is_active) return 'Inactive'
  if (apiKey.is_expired) return 'Expired'
  
  // Check if expiring soon (within 30 days)
  if (apiKey.expires_at) {
    const expiryDate = new Date(apiKey.expires_at)
    const thirtyDaysFromNow = new Date()
    // Use proper date arithmetic that handles month boundaries correctly
    thirtyDaysFromNow.setTime(thirtyDaysFromNow.getTime() + (30 * 24 * 60 * 60 * 1000))
    
    if (expiryDate < thirtyDaysFromNow) return 'Expiring Soon'
  }
  
  return 'Active'
}
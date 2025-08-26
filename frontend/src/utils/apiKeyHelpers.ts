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

import { type APIKey } from '../services/apiKeys'

/**
 * Permission categories with descriptions for better organization.
 */
export const PERMISSION_CATEGORIES = {
  'Students': 'Access to student information and profiles',
  'Attendance': 'Access to attendance records and tracking',
  'Assignments': 'Access to assignment data and submissions',
  'Points': 'Access to student points and gamification system',
  'Reports': 'Access to reports and analytics',
  'Administration': 'Administrative system access'
} as const

export type PermissionCategory = keyof typeof PERMISSION_CATEGORIES

/**
 * Format a date string into a human-readable "time ago" format.
 * 
 * @param lastUsedAt - ISO date string or null/undefined
 * @returns Formatted string like "2 hours ago", "Never", etc.
 */
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

/**
 * Format an expiration date into a human-readable format.
 * 
 * @param expiresAt - ISO date string or null/undefined
 * @returns Formatted string like "Expires in 5 days", "Expired", "Never", etc.
 */
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

/**
 * Get the appropriate status color class for an API key.
 * 
 * @param apiKey - The API key object
 * @returns CSS color class string
 */
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

/**
 * Get the appropriate status text for an API key.
 * 
 * @param apiKey - The API key object
 * @returns Status text like "Active", "Expired", "Inactive", "Expiring Soon"
 */
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

/**
 * Group permissions by category for better organization in UI.
 * 
 * @param permissions - Array of permission strings
 * @returns Object with categories as keys and permission arrays as values
 */
export const groupPermissionsByCategory = (permissions: string[]): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {}
  
  permissions.forEach(permission => {
    const [category] = permission.split(':')
    const categoryKey = category.charAt(0).toUpperCase() + category.slice(1)
    
    if (!grouped[categoryKey]) {
      grouped[categoryKey] = []
    }
    grouped[categoryKey].push(permission)
  })
  
  return grouped
}

/**
 * Validate that a permission string follows the expected format.
 * 
 * @param permission - Permission string to validate
 * @returns Whether the permission is valid
 */
export const isValidPermission = (permission: string): boolean => {
  // Permissions should follow the format "resource:action"
  const parts = permission.split(':')
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
}

/**
 * Get a user-friendly description for a permission.
 * 
 * @param permission - Permission string like "students:read"
 * @returns Human-readable description
 */
export const getPermissionDescription = (permission: string): string => {
  const [resource, action] = permission.split(':')
  
  const resourceNames: Record<string, string> = {
    'students': 'student data',
    'attendance': 'attendance records',
    'assignments': 'assignments',
    'points': 'points system',
    'reports': 'reports',
    'admin': 'administrative functions'
  }
  
  const actionNames: Record<string, string> = {
    'read': 'view',
    'write': 'create and modify',
    'delete': 'delete',
    'grade': 'grade'
  }
  
  const resourceName = resourceNames[resource] || resource
  const actionName = actionNames[action] || action
  
  return `Can ${actionName} ${resourceName}`
}

/**
 * Calculate the security risk level of an API key based on its permissions.
 * 
 * @param permissions - Array of permission strings
 * @returns Risk level: "low", "medium", "high"
 */
export const calculateRiskLevel = (permissions: string[]): 'low' | 'medium' | 'high' => {
  const highRiskPermissions = ['admin:write', 'admin:read', 'students:write']
  const mediumRiskPermissions = ['points:write', 'assignments:write', 'attendance:write']
  
  const hasHighRisk = permissions.some(p => highRiskPermissions.includes(p))
  const hasMediumRisk = permissions.some(p => mediumRiskPermissions.includes(p))
  
  if (hasHighRisk) return 'high'
  if (hasMediumRisk) return 'medium'
  return 'low'
}

/**
 * Generate a secure, random API key name suggestion.
 * 
 * @param prefix - Optional prefix for the name
 * @returns Generated name suggestion
 */
export const generateAPIKeyNameSuggestion = (prefix?: string): string => {
  const adjectives = ['Secure', 'Primary', 'External', 'Integration', 'Service', 'Client']
  const nouns = ['API', 'System', 'Service', 'Integration', 'Client', 'Application']
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const timestamp = new Date().toISOString().slice(0, 10)
  
  if (prefix) {
    return `${prefix} ${adjective} ${noun} - ${timestamp}`
  }
  
  return `${adjective} ${noun} - ${timestamp}`
}
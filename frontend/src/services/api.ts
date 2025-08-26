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

import { config } from '../config/env'

// Base API configuration
const API_BASE = config.api.baseUrl

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

export const api = {
  // Generic API methods
  get: async (endpoint: string) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    return response.json()
  },

  post: async (endpoint: string, data: any) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    return response.json()
  },

  put: async (endpoint: string, data: any) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }
    return response.json()
  },

  delete: async (endpoint: string) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.detail) {
          errorMessage = errorData.detail
        }
      } catch {
        // If parsing fails, stick with the default message
      }
      
      
      throw new Error(errorMessage)
    }
    return response.ok
  },

  // Authentication-specific methods
  extendSession: async () => {
    const response = await fetch(`${API_BASE}/auth/extend-session`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      throw new Error(`Session extension failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }
}
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
import { STORAGE_KEYS } from '../constants/auth'

// Base API configuration
const API_BASE = config.api.baseUrl

// Event other parts of the app (AuthProvider) can listen for to react to a
// server-side session invalidation.
export const UNAUTHORIZED_EVENT = 'ourschool:unauthorized'

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

let redirecting = false

/**
 * Central handler for an authentication failure (401). Clears the stored
 * session and redirects to the login page so a stale/revoked token never
 * leaves the user in a half-logged-in state. Guarded so concurrent failed
 * requests trigger a single redirect.
 */
const handleUnauthorized = () => {
  localStorage.removeItem(STORAGE_KEYS.TOKEN)
  localStorage.removeItem(STORAGE_KEYS.USER)
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  if (!redirecting && window.location.pathname !== '/login') {
    redirecting = true
    window.location.assign('/login')
  }
}

const parseError = async (response: Response): Promise<string> => {
  let message = `API Error: ${response.status} ${response.statusText}`
  try {
    const text = await response.text()
    if (text) {
      const data = JSON.parse(text)
      if (data?.detail) {
        message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
      }
    }
  } catch {
    // Non-JSON body: keep the default status-based message.
  }
  return message
}

/** Single code path for every request: auth headers, 401 handling, errors. */
const request = async (endpoint: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers || {}) }
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Your session has expired. Please log in again.')
  }

  if (!response.ok) {
    throw new Error(await parseError(response))
  }

  if (response.status === 204) {
    return null
  }
  // Some endpoints (rare) return empty bodies on 200.
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  get: (endpoint: string) => request(endpoint, { method: 'GET' }),

  post: (endpoint: string, data?: unknown) =>
    request(endpoint, { method: 'POST', body: JSON.stringify(data ?? {}) }),

  put: (endpoint: string, data?: unknown) =>
    request(endpoint, { method: 'PUT', body: JSON.stringify(data ?? {}) }),

  delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),

  // Authentication-specific methods
  extendSession: async () => {
    const response = await fetch(`${API_BASE}/auth/extend-session`, {
      method: 'POST',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      // Don't force-redirect here; the caller (AuthProvider) decides.
      throw new Error(`Session extension failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }
}
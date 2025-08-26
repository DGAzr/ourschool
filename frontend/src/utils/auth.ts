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

/**
 * Token validation and management utilities
 */

export interface TokenPayload {
  exp?: number
  iat?: number
  user_id?: number
  email?: string
  [key: string]: any
}

/**
 * Decode JWT token payload without verification (for client-side use only)
 * Note: This is for reading token data, not for security validation
 */
export const decodeToken = (token: string): TokenPayload | null => {
  try {
    // Split the token and get the payload part
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode the base64 payload
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch (error) {
    return null
  }
}

/**
 * Check if a JWT token is expired
 * Uses configurable expiration time from environment variables
 */
export const isTokenExpired = (token: string): boolean => {
  if (!token) {
    return true
  }

  try {
    const payload = decodeToken(token)
    if (!payload) {
      return true
    }

    // If token has an exp claim, use it
    if (payload.exp) {
      return payload.exp * 1000 < Date.now()
    }

    // If no exp claim, check against our configured expiry time
    // This assumes the token was issued recently
    const tokenAge = Date.now() - (payload.iat ? payload.iat * 1000 : 0)
    return tokenAge > config.auth.tokenExpiryMs
  } catch {
    return true
  }
}

/**
 * Check if token is about to expire (within warning time)
 */
export const isTokenNearExpiry = (token: string): boolean => {
  if (!token) {
    return false
  }

  try {
    const payload = decodeToken(token)
    if (!payload) {
      return false
    }

    // If token has an exp claim, use it
    if (payload.exp) {
      const expiryTime = payload.exp * 1000
      const warningTime = expiryTime - config.auth.logoutWarningMs
      return Date.now() > warningTime && Date.now() < expiryTime
    }

    // If no exp claim, check against our configured times
    const tokenAge = Date.now() - (payload.iat ? payload.iat * 1000 : 0)
    const warningThreshold = config.auth.tokenExpiryMs - config.auth.logoutWarningMs
    return tokenAge > warningThreshold && tokenAge < config.auth.tokenExpiryMs
  } catch {
    return false
  }
}

/**
 * Get remaining time until token expires (in milliseconds)
 */
export const getTokenTimeRemaining = (token: string): number => {
  if (!token) {
    return 0
  }

  try {
    const payload = decodeToken(token)
    if (!payload) {
      return 0
    }

    // If token has an exp claim, use it
    if (payload.exp) {
      const expiryTime = payload.exp * 1000
      return Math.max(0, expiryTime - Date.now())
    }

    // If no exp claim, calculate based on our configured expiry time
    const tokenAge = Date.now() - (payload.iat ? payload.iat * 1000 : 0)
    return Math.max(0, config.auth.tokenExpiryMs - tokenAge)
  } catch {
    return 0
  }
}

/**
 * Format time remaining in human-readable format
 */
export const formatTimeRemaining = (milliseconds: number): string => {
  if (milliseconds <= 0) {
    return 'Expired'
  }

  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Validate token format and structure
 */
export const isValidTokenFormat = (token: string): boolean => {
  if (!token || typeof token !== 'string') {
    return false
  }

  // Check if it's a JWT format (3 parts separated by dots)
  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }

  // Try to decode the payload to ensure it's valid base64
  try {
    decodeToken(token)
    return true
  } catch {
    return false
  }
}
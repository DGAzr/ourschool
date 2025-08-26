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

/**
 * Authentication-related constants
 */

// Token expiration settings (in milliseconds)
export const AUTH_TIMEOUTS = {
  DEFAULT_TOKEN_EXPIRY: 8 * 60 * 60 * 1000, // 8 hours
  WARNING_THRESHOLD: 15 * 60 * 1000, // 15 minutes before expiry
  REFRESH_INTERVAL: 30 * 1000, // Check every 30 seconds
  SESSION_EXTENSION: 2 * 60 * 60 * 1000, // Extend by 2 hours
  INACTIVITY_WARNING: 10 * 60 * 1000, // Warn after 10 minutes inactive
  AUTO_LOGOUT_DELAY: 15 * 60 * 1000 // Auto logout after 15 minutes inactive
} as const

// Storage keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'ourschool_theme',
  LAST_ACTIVITY: 'ourschool_last_activity',
  SESSION_EXTENDED: 'ourschool_session_extended'
} as const

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student'
} as const

// Authentication messages
export const AUTH_MESSAGES = {
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  TOKEN_EXPIRING: 'Your session will expire soon. Would you like to extend it?',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
  SESSION_EXTENDED: 'Your session has been extended.',
  LOGGED_OUT: 'You have been logged out successfully.',
  INACTIVITY_WARNING: 'You\'ve been inactive. Your session will expire soon.'
} as const
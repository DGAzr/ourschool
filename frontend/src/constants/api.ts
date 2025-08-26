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
 * API-related constants and configuration
 */

// API timeouts
export const API_TIMEOUTS = {
  DEFAULT: 10000, // 10 seconds
  UPLOAD: 60000, // 60 seconds for file uploads
  BACKUP: 300000, // 5 minutes for backup operations
  EXPORT: 30000 // 30 seconds for exports
} as const

// API endpoints base paths
export const API_ENDPOINTS = {
  AUTH: '/auth',
  USERS: '/users',
  STUDENTS: '/students', 
  ASSIGNMENTS: '/assignments',
  LESSONS: '/lessons',
  SUBJECTS: '/subjects',
  TERMS: '/terms',
  ATTENDANCE: '/attendance',
  REPORTS: '/reports',
  ADMIN: '/admin',
  BACKUP: '/admin/backup',
  POINTS: '/points'
} as const

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
} as const

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1
} as const

// File upload limits
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_BACKUP_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/msword'],
  ALLOWED_BACKUP_TYPES: ['application/zip', 'application/x-zip-compressed']
} as const

// Error messages
export const API_ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  UPLOAD_TOO_LARGE: 'File is too large. Maximum size is 10MB.',
  INVALID_FILE_TYPE: 'Invalid file type. Please check allowed formats.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.'
} as const
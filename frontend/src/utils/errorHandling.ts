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
 * Standardized error handling utilities for the frontend application
 */

export interface ApiError {
  message: string
  code?: string
  details?: string
}

/**
 * Extracts a user-friendly error message from an error object
 */
export const getErrorMessage = (error: unknown, fallbackMessage = 'An unexpected error occurred'): string => {
  if (!error) {
    return fallbackMessage
  }

  // Handle axios errors with response data
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as any
    
    // Try to extract error message from response
    if (axiosError.response?.data?.detail) {
      return axiosError.response.data.detail
    }
    
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message
    }
    
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error
    }
    
    // Handle validation errors
    if (axiosError.response?.data?.errors && Array.isArray(axiosError.response.data.errors)) {
      return axiosError.response.data.errors.join(', ')
    }
    
    // Fallback to status text
    if (axiosError.response?.statusText) {
      return axiosError.response.statusText
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error
  }

  // Fallback
  return fallbackMessage
}

/**
 * Common error messages for consistent UX
 */
export const ERROR_MESSAGES = {
  // Network/API errors
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  
  // CRUD operations
  LOAD_FAILED: (resource: string) => `Failed to load ${resource}. Please try again.`,
  CREATE_FAILED: (resource: string) => `Failed to create ${resource}. Please try again.`,
  UPDATE_FAILED: (resource: string) => `Failed to update ${resource}. Please try again.`,
  DELETE_FAILED: (resource: string) => `Failed to delete ${resource}. Please try again.`,
  
  // Authentication
  LOGIN_FAILED: 'Login failed. Please check your credentials.',
  LOGOUT_FAILED: 'Logout failed. Please try again.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  
  // Validation
  REQUIRED_FIELD: (field: string) => `${field} is required.`,
  INVALID_FORMAT: (field: string) => `${field} format is invalid.`,
  PASSWORD_MISMATCH: 'Passwords do not match.',
  PASSWORD_TOO_SHORT: (minLength: number) => `Password must be at least ${minLength} characters long.`,
  
  // Generic
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again.',
  OPERATION_CANCELLED: 'Operation was cancelled.',
} as const

/**
 * Hook for standardized error handling in components
 */
export const useErrorHandler = () => {
  const handleError = (error: unknown, customMessage?: string): string => {
    const errorMessage = customMessage || getErrorMessage(error)
    
    // Log error for debugging (in development)
    if (import.meta.env.DEV) {
      console.error('Error handled:', error)
    }
    
    return errorMessage
  }

  const handleAsyncError = async <T>(
    asyncOperation: () => Promise<T>,
    errorMessage?: string
  ): Promise<{ data?: T; error?: string }> => {
    try {
      const data = await asyncOperation()
      return { data }
    } catch (error) {
      const message = handleError(error, errorMessage)
      return { error: message }
    }
  }

  return {
    handleError,
    handleAsyncError,
  }
}

/**
 * Utility to create consistent error handlers for CRUD operations
 */
export const createCrudErrorHandlers = (resourceName: string) => {
  return {
    load: (error: unknown) => getErrorMessage(error, ERROR_MESSAGES.LOAD_FAILED(resourceName)),
    create: (error: unknown) => getErrorMessage(error, ERROR_MESSAGES.CREATE_FAILED(resourceName)),
    update: (error: unknown) => getErrorMessage(error, ERROR_MESSAGES.UPDATE_FAILED(resourceName)),
    delete: (error: unknown) => getErrorMessage(error, ERROR_MESSAGES.DELETE_FAILED(resourceName)),
  }
}
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

import { useState, useCallback } from 'react'

interface PageLayoutState {
  loading: boolean
  error: string | null
  actionInProgress: boolean
}

interface UsePageLayoutOptions {
  initialLoading?: boolean
  onError?: (error: string) => void
}

interface UsePageLayoutReturn extends PageLayoutState {
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setActionInProgress: (inProgress: boolean) => void
  clearError: () => void
  handleAsyncAction: <T>(action: () => Promise<T>) => Promise<T | null>
  handleAsyncActionWithLoading: <T>(action: () => Promise<T>) => Promise<T | null>
}

export const usePageLayout = (options: UsePageLayoutOptions = {}): UsePageLayoutReturn => {
  const { initialLoading = false, onError } = options
  
  const [loading, setLoading] = useState(initialLoading)
  const [error, setError] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState(false)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    if (onError) {
      onError(errorMessage)
    }
  }, [onError])

  const handleAsyncAction = useCallback(async <T>(action: () => Promise<T>): Promise<T | null> => {
    try {
      setActionInProgress(true)
      clearError()
      return await action()
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred'
      handleError(errorMessage)
      return null
    } finally {
      setActionInProgress(false)
    }
  }, [clearError, handleError])

  const handleAsyncActionWithLoading = useCallback(async <T>(action: () => Promise<T>): Promise<T | null> => {
    try {
      setLoading(true)
      clearError()
      return await action()
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred'
      handleError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [clearError, handleError])

  return {
    loading,
    error,
    actionInProgress,
    setLoading,
    setError,
    setActionInProgress,
    clearError,
    handleAsyncAction,
    handleAsyncActionWithLoading
  }
}
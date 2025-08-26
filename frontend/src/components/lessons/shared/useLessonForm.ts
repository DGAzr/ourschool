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

interface UseLessonFormOptions<T> {
  initialData: T
  onSubmit: (data: T) => Promise<void>
  validate?: (data: T) => string | null
}

interface UseLessonFormReturn<T> {
  formData: T
  loading: boolean
  error: string | null
  updateField: (field: keyof T, value: any) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  setError: (error: string | null) => void
  resetForm: () => void
}

export function useLessonForm<T>({
  initialData,
  onSubmit,
  validate
}: UseLessonFormOptions<T>): UseLessonFormReturn<T> {
  const [formData, setFormData] = useState<T>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Run validation if provided
    if (validate) {
      const validationError = validate(formData)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      await onSubmit(formData)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [formData, onSubmit, validate])

  const resetForm = useCallback(() => {
    setFormData(initialData)
    setError(null)
  }, [initialData])

  return {
    formData,
    loading,
    error,
    updateField,
    handleSubmit,
    setError,
    resetForm
  }
}
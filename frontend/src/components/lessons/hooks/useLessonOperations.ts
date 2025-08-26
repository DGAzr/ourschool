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
import { lessonsApi } from '../../../services/lessons'
import { Lesson } from '../../../types'

interface LessonFormData {
  title: string
  description?: string
  scheduled_date: string
  start_time?: string
  end_time?: string
  estimated_duration_minutes?: number
  materials_needed?: string
  objectives?: string
  prerequisites?: string
  resources?: string
  lesson_order: number
  subject_id: number
}

interface UseLessonOperationsReturn {
  // Loading states
  creating: boolean
  updating: boolean
  deleting: boolean
  importing: boolean
  exporting: boolean
  
  // Error state
  error: string | null
  
  // Operations
  createLesson: (data: LessonFormData) => Promise<Lesson>
  updateLesson: (id: number, data: Partial<LessonFormData>) => Promise<Lesson>
  deleteLesson: (id: number) => Promise<void>
  exportLesson: (id: number) => Promise<any>
  importLesson: (data: any) => Promise<any>
  
  // Clear error
  clearError: () => void
}

export const useLessonOperations = (): UseLessonOperationsReturn => {
  // Loading states
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  
  // Error state
  const [error, setError] = useState<string | null>(null)

  const createLesson = useCallback(async (data: LessonFormData): Promise<Lesson> => {
    try {
      setCreating(true)
      setError(null)
      const result = await lessonsApi.create(data)
      return result
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create lesson'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setCreating(false)
    }
  }, [])

  const updateLesson = useCallback(async (id: number, data: Partial<LessonFormData>): Promise<Lesson> => {
    try {
      setUpdating(true)
      setError(null)
      const result = await lessonsApi.update(id, data)
      return result
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update lesson'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setUpdating(false)
    }
  }, [])

  const deleteLesson = useCallback(async (id: number): Promise<void> => {
    try {
      setDeleting(true)
      setError(null)
      await lessonsApi.delete(id)
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to delete lesson'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setDeleting(false)
    }
  }, [])

  const exportLesson = useCallback(async (id: number): Promise<any> => {
    try {
      setExporting(true)
      setError(null)
      const result = await lessonsApi.exportLesson(id)
      return result
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to export lesson'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setExporting(false)
    }
  }, [])

  const importLesson = useCallback(async (data: any): Promise<any> => {
    try {
      setImporting(true)
      setError(null)
      const result = await lessonsApi.importLesson(data)
      return result
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to import lesson'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setImporting(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Loading states
    creating,
    updating,
    deleting,
    importing,
    exporting,
    
    // Error state
    error,
    
    // Operations
    createLesson,
    updateLesson,
    deleteLesson,
    exportLesson,
    importLesson,
    
    // Clear error
    clearError
  }
}
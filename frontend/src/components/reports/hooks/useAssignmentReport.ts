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
import { reportsApi } from '../../../services/reports'
import { AssignmentReport } from '../../../types'

interface AssignmentFilters {
  subjectId: string
  studentId: string
  termId: string
  status: string
}

interface UseAssignmentReportReturn {
  // Loading state
  loading: boolean
  error: string | null
  
  // Report data
  assignmentReport: AssignmentReport | null
  
  // Filter state
  filters: AssignmentFilters
  
  // Actions
  updateFilter: (key: keyof AssignmentFilters, value: string) => void
  setFilters: (filters: AssignmentFilters) => void
  generateReport: () => Promise<void>
  clearReport: () => void
}

export const useAssignmentReport = (): UseAssignmentReportReturn => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignmentReport, setAssignmentReport] = useState<AssignmentReport | null>(null)
  
  const [filters, setFiltersState] = useState<AssignmentFilters>({
    subjectId: '',
    studentId: '',
    termId: '',
    status: ''
  })

  const updateFilter = useCallback((key: keyof AssignmentFilters, value: string) => {
    setFiltersState(prev => ({ ...prev, [key]: value }))
  }, [])

  const setFilters = useCallback((newFilters: AssignmentFilters) => {
    setFiltersState(newFilters)
  }, [])

  const generateReport = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const subjectId = filters.subjectId ? parseInt(filters.subjectId) : undefined
      const studentId = filters.studentId ? parseInt(filters.studentId) : undefined
      const termId = filters.termId ? parseInt(filters.termId) : undefined
      const status = filters.status || undefined

      const data = await reportsApi.getAssignmentReport(subjectId, studentId, termId, status)
      setAssignmentReport(data)
    } catch (err: any) {
      setError(`Failed to load assignment report: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const clearReport = () => {
    setAssignmentReport(null)
    setError(null)
  }

  return {
    loading,
    error,
    assignmentReport,
    filters,
    updateFilter,
    setFilters,
    generateReport,
    clearReport
  }
}
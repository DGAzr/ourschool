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

import { useState, useEffect } from 'react'
import { reportsApi } from '../../../services/reports'
import { ReportCard } from '../../../types'

interface ReportCardOptions {
  students: Array<{ id: number; name: string }>
  terms: Array<{ id: number; name: string; academic_year: string }>
}

interface UseReportCardReturn {
  // Loading state
  loading: boolean
  error: string | null
  
  // Report data
  reportCard: ReportCard | null
  
  // Options
  options: ReportCardOptions
  
  // Selection state
  selectedStudentId: string
  selectedTermId: string
  
  // Actions
  setSelectedStudentId: (id: string) => void
  setSelectedTermId: (id: string) => void
  generateReportCard: () => Promise<void>
  clearReportCard: () => void
  loadOptions: () => Promise<void>
}

export const useReportCard = (): UseReportCardReturn => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportCard, setReportCard] = useState<ReportCard | null>(null)
  
  const [options, setOptions] = useState<ReportCardOptions>({
    students: [],
    terms: []
  })
  
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [selectedTermId, setSelectedTermId] = useState<string>('')

  const loadOptions = async () => {
    try {
      setError(null)
      
      // Load available terms
      const years = await reportsApi.getAcademicYears()
      const termOptions = years.flatMap(year => 
        [{
          id: parseInt(year.academic_year.split('-')[0]), // Convert "2023-2024" to 2023
          name: `${year.academic_year} Term`,
          academic_year: year.academic_year
        }]
      )
      
      // Load available students from assignment report (which includes student data)
      try {
        const assignmentData = await reportsApi.getAssignmentReport()
        const studentOptions = assignmentData.available_students?.map(student => ({
          id: student.id,
          name: student.name
        })) || []
        
        setOptions({
          students: studentOptions,
          terms: termOptions
        })
      } catch {
        // If assignment report fails, just use empty students
        setOptions({
          students: [],
          terms: termOptions
        })
      }
    } catch (err: any) {
      setError(`Failed to load report card options: ${err.message || 'Unknown error'}`)
    }
  }

  const generateReportCard = async () => {
    if (!selectedStudentId || !selectedTermId) {
      setError('Please select both a student and a term')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const studentId = parseInt(selectedStudentId)
      const termId = parseInt(selectedTermId)
      
      const data = await reportsApi.getReportCard(studentId, termId)
      setReportCard(data)
    } catch (err: any) {
      setError(`Failed to generate report card: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const clearReportCard = () => {
    setReportCard(null)
    setError(null)
  }

  // Load options on mount
  useEffect(() => {
    loadOptions()
  }, [])

  return {
    loading,
    error,
    reportCard,
    options,
    selectedStudentId,
    selectedTermId,
    setSelectedStudentId,
    setSelectedTermId,
    generateReportCard,
    clearReportCard,
    loadOptions
  }
}
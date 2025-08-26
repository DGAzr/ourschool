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

import { useState } from 'react'
import { reportsApi } from '../../../services/reports'
import { useAuth } from '../../../contexts/AuthContext'
import {
  StudentAttendanceReport,
  BulkAttendanceReport
} from '../../../types'

interface UseAttendanceReportReturn {
  // Loading state
  loading: boolean
  error: string | null
  
  // Report data
  attendanceReport: StudentAttendanceReport | null
  bulkAttendanceReport: BulkAttendanceReport | null
  
  // Filter state
  selectedAcademicYear: string
  customStartDate: string
  customEndDate: string
  useCustomDates: boolean
  
  // Actions
  setSelectedAcademicYear: (year: string) => void
  setCustomStartDate: (date: string) => void
  setCustomEndDate: (date: string) => void
  setUseCustomDates: (use: boolean) => void
  generateAttendanceReport: (isAdmin: boolean, academicYears?: any[]) => Promise<void>
  clearReport: () => void
}

export const useAttendanceReport = (): UseAttendanceReportReturn => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Report data
  const [attendanceReport, setAttendanceReport] = useState<StudentAttendanceReport | null>(null)
  const [bulkAttendanceReport, setBulkAttendanceReport] = useState<BulkAttendanceReport | null>(null)
  
  // Filter state
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [useCustomDates, setUseCustomDates] = useState(false)

  const generateAttendanceReport = async (isAdmin: boolean, academicYears?: any[]) => {
    try {
      setLoading(true)
      setError(null)

      let startDate: string | undefined
      let endDate: string | undefined


      if (useCustomDates) {
        if (!customStartDate || !customEndDate) {
          setError('Please select both start and end dates')
          return
        }
        startDate = customStartDate
        endDate = customEndDate
      } else {
        if (!selectedAcademicYear) {
          setError('Please select an academic year')
          return
        }
        // Find the actual dates for the selected academic year
        if (!academicYears || academicYears.length === 0) {
          setError('Academic year data not available. Please try again.')
          return
        }
        
        const selectedYear = academicYears.find(year => year.academic_year === selectedAcademicYear)
        if (!selectedYear) {
          setError('Selected academic year not found')
          return
        }
        startDate = selectedYear.start_date
        endDate = selectedYear.end_date
      }

      if (isAdmin) {
        // Backend requires start_date and end_date as required parameters
        if (!startDate || !endDate) {
          setError('Start date and end date are required')
          return
        }
        
        const options: any = {
          start_date: startDate,
          end_date: endDate
        }
        if (selectedAcademicYear && !useCustomDates) {
          options.academic_year = selectedAcademicYear
        }
        
        const data = await reportsApi.getBulkAttendanceReport(options)
        setBulkAttendanceReport(data)
        setAttendanceReport(null)
      } else {
        // For student attendance report, we need the current user's ID
        if (!user?.id) {
          setError('User not found. Please log in again.')
          return
        }
        
        // Backend requires start_date and end_date as required parameters
        if (!startDate || !endDate) {
          setError('Start date and end date are required')
          return
        }
        
        const options: any = {
          student_id: user.id,
          start_date: startDate,
          end_date: endDate
        }
        if (selectedAcademicYear && !useCustomDates) {
          options.academic_year = selectedAcademicYear
        }
        const data = await reportsApi.getStudentAttendanceReport(options)
        setAttendanceReport(data)
        setBulkAttendanceReport(null)
      }
    } catch (err: any) {
      setError(`Failed to generate attendance report: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const clearReport = () => {
    setAttendanceReport(null)
    setBulkAttendanceReport(null)
    setError(null)
  }

  return {
    loading,
    error,
    attendanceReport,
    bulkAttendanceReport,
    selectedAcademicYear,
    customStartDate,
    customEndDate,
    useCustomDates,
    setSelectedAcademicYear,
    setCustomStartDate,
    setCustomEndDate,
    setUseCustomDates,
    generateAttendanceReport,
    clearReport
  }
}
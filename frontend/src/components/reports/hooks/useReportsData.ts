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
import { useAuth } from '../../../contexts/AuthContext'
import { reportsApi } from '../../../services/reports'
import {
  StudentReport,
  AdminReport,
  TermGrade,
  StudentProgress,
  AcademicYear,
  StudentAttendanceReport,
  BulkAttendanceReport,
  AssignmentReport
} from '../../../types'
import { Term } from '../../../types/lesson'

export type ReportView = 'overview' | 'terms' | 'subjects' | 'students' | 'attendance' | 'assignments' | 'reportcard'

interface UseReportsDataReturn {
  // General state
  loading: boolean
  error: string | null
  selectedView: ReportView
  setSelectedView: (view: ReportView) => void
  
  // Overview data
  overviewData: StudentReport | AdminReport | null
  termGrades: TermGrade[]
  studentProgress: StudentProgress[]
  
  // Academic years (used by multiple views)
  academicYears: AcademicYear[]
  
  // Terms (for Students report)
  terms: Term[]
  selectedTermId: number | null
  setSelectedTermId: (termId: number | null) => void
  
  // Attendance report data
  selectedAcademicYear: string
  setSelectedAcademicYear: (year: string) => void
  customStartDate: string
  setCustomStartDate: (date: string) => void
  customEndDate: string
  setCustomEndDate: (date: string) => void
  useCustomDates: boolean
  setUseCustomDates: (use: boolean) => void
  attendanceReport: StudentAttendanceReport | null
  bulkAttendanceReport: BulkAttendanceReport | null
  attendanceLoading: boolean
  generateAttendanceReport: () => Promise<void>
  
  // Assignment report data
  assignmentReport: AssignmentReport | null
  assignmentLoading: boolean
  
  // Report card data
  reportCard: any | null
  reportCardStudentId: string
  setReportCardStudentId: (id: string) => void
  reportCardTermId: string
  setReportCardTermId: (id: string) => void
  reportCardAsOfDate: string
  setReportCardAsOfDate: (date: string) => void
  reportCardLoading: boolean
  availableStudentsForReportCard: Array<{id: number, name: string}>
  availableTermsForReportCard: Array<{id: number, name: string, academic_year: string}>
  generateReportCard: () => Promise<void>
  
  // Data refresh function
  refreshData: () => Promise<void>
  refreshStudentProgress: (termId?: number | null) => Promise<void>
}

export const useReportsData = (): UseReportsDataReturn => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedView, setSelectedView] = useState<ReportView>('overview')
  
  // Data states
  const [overviewData, setOverviewData] = useState<StudentReport | AdminReport | null>(null)
  const [termGrades, setTermGrades] = useState<TermGrade[]>([])
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)
  
  // Attendance report states
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [useCustomDates, setUseCustomDates] = useState(false)
  const [attendanceReport, setAttendanceReport] = useState<StudentAttendanceReport | null>(null)
  const [bulkAttendanceReport, setBulkAttendanceReport] = useState<BulkAttendanceReport | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  
  // Assignment report states
  const [assignmentReport, setAssignmentReport] = useState<AssignmentReport | null>(null)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  
  // Report card states
  const [reportCard, setReportCard] = useState<any | null>(null)
  const [reportCardStudentId, setReportCardStudentId] = useState<string>('')
  const [reportCardTermId, setReportCardTermId] = useState<string>('')
  const [reportCardAsOfDate, setReportCardAsOfDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [reportCardLoading, setReportCardLoading] = useState(false)
  const [availableStudentsForReportCard, setAvailableStudentsForReportCard] = useState<Array<{id: number, name: string}>>([])
  const [availableTermsForReportCard, setAvailableTermsForReportCard] = useState<Array<{id: number, name: string, academic_year: string}>>([])

  const isAdmin = user?.role === 'admin'

  const fetchDataForView = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load academic years for views that need them
      if (selectedView === 'attendance' || selectedView === 'overview') {
        const years = await reportsApi.getAcademicYears()
        setAcademicYears(years)
        if (years.length > 0 && !selectedAcademicYear) {
          setSelectedAcademicYear(years[0].academic_year)
        }
      }

      if (selectedView === 'overview') {
        if (isAdmin) {
          const data = await reportsApi.getAdminReport()
          setOverviewData(data)
        } else {
          const data = await reportsApi.getStudentReport()
          setOverviewData(data)
        }
      } else if (selectedView === 'terms' && !isAdmin) {
        const data = await reportsApi.getStudentTermGrades()
        setTermGrades(data)
      } else if (selectedView === 'students' && isAdmin) {
        // Load terms for the Students report
        const termsData = await reportsApi.getTerms()
        setTerms(termsData)
        
        // Load student progress data
        const data = await reportsApi.getAllStudentsProgress(selectedTermId || undefined)
        setStudentProgress(data)
      } else if (selectedView === 'assignments' && isAdmin) {
        await fetchAssignmentReport()
      } else if (selectedView === 'reportcard') {
        await loadReportCardOptions()
      }
    } catch (err: any) {
      setError(`Failed to load report data: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchAssignmentReport = async () => {
    try {
      setAssignmentLoading(true)
      const data = await reportsApi.getAssignmentReport()
      setAssignmentReport(data)
    } catch (err: any) {
      setError('Failed to load assignment report')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const loadReportCardOptions = async () => {
    try {
      // Load available terms
      const terms = await reportsApi.getAcademicYears()
      const termOptions = terms.flatMap(year => 
        // For now, we'll use the academic year data, but in a real app you'd want term-specific data
        [{
          id: year.terms_count, // This is a placeholder - you'd need actual term IDs
          name: year.academic_year,
          academic_year: year.academic_year
        }]
      )
      setAvailableTermsForReportCard(termOptions)

      if (isAdmin) {
        // Load available students for admin
        const assignmentData = await reportsApi.getAssignmentReport()
        setAvailableStudentsForReportCard(assignmentData.available_students)
      } else {
        // For students, only show themselves
        setAvailableStudentsForReportCard([{
          id: user!.id,
          name: `${user!.first_name} ${user!.last_name}`
        }])
        setReportCardStudentId(user!.id.toString())
      }
    } catch (err: any) {
      setError('Failed to load report card options: ' + (err.message || 'Unknown error'))
    }
  }

  const generateReportCard = async () => {
    if (!reportCardStudentId || !reportCardTermId) {
      setError('Please select both a student and a term')
      return
    }

    try {
      setReportCardLoading(true)
      setError(null)
      
      const studentId = parseInt(reportCardStudentId)
      const termId = parseInt(reportCardTermId)

      // Pass the specified "as of" date to exclude future assignments from grade calculations
      const data = await reportsApi.getReportCard(studentId, termId, reportCardAsOfDate)
      setReportCard(data)
    } catch (err: any) {
      setError('Failed to generate report card: ' + (err.message || 'Unknown error'))
    } finally {
      setReportCardLoading(false)
    }
  }

  const generateAttendanceReport = async () => {
    try {
      setAttendanceLoading(true)
      setError(null)

      if (useCustomDates) {
        if (!customStartDate || !customEndDate) {
          setError('Please select both start and end dates')
          return
        }
        
        if (isAdmin) {
          const data = await reportsApi.getBulkAttendanceReport({
            start_date: customStartDate,
            end_date: customEndDate
          })
          setBulkAttendanceReport(data)
        } else {
          if (!user?.id) {
            setError('User not found. Please log in again.')
            return
          }
          const data = await reportsApi.getStudentAttendanceReport({
            student_id: user.id,
            start_date: customStartDate,
            end_date: customEndDate
          })
          setAttendanceReport(data)
        }
      } else {
        if (!selectedAcademicYear) {
          setError('Please select an academic year')
          return
        }
        
        // Find the actual dates for the selected academic year
        const selectedYear = academicYears.find(year => year.academic_year === selectedAcademicYear)
        if (!selectedYear) {
          setError('Selected academic year not found')
          return
        }
        const startDate = selectedYear.start_date
        const endDate = selectedYear.end_date
        
        if (isAdmin) {
          const data = await reportsApi.getBulkAttendanceReport({
            start_date: startDate,
            end_date: endDate,
            academic_year: selectedAcademicYear
          })
          setBulkAttendanceReport(data)
        } else {
          if (!user?.id) {
            setError('User not found. Please log in again.')
            return
          }
          const data = await reportsApi.getStudentAttendanceReport({
            student_id: user.id,
            start_date: startDate,
            end_date: endDate,
            academic_year: selectedAcademicYear
          })
          setAttendanceReport(data)
        }
      }
    } catch (err: any) {
      setError('Failed to generate attendance report')
    } finally {
      setAttendanceLoading(false)
    }
  }

  const refreshStudentProgress = async (termId?: number | null) => {
    if (selectedView === 'students' && isAdmin) {
      try {
        setLoading(true)
        const data = await reportsApi.getAllStudentsProgress(termId || undefined)
        setStudentProgress(data)
      } catch (err: any) {
        setError(`Failed to load student progress: ${err.message || 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    }
  }

  const refreshData = async () => {
    await fetchDataForView()
  }

  useEffect(() => {
    if (user) {
      fetchDataForView()
    }
  }, [selectedView, user, isAdmin])

  // Reload student progress when term selection changes
  useEffect(() => {
    if (selectedView === 'students' && isAdmin && terms.length > 0) {
      refreshStudentProgress(selectedTermId)
    }
  }, [selectedTermId])

  return {
    loading,
    error,
    selectedView,
    setSelectedView,
    overviewData,
    termGrades,
    studentProgress,
    academicYears,
    selectedAcademicYear,
    setSelectedAcademicYear,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    useCustomDates,
    setUseCustomDates,
    attendanceReport,
    bulkAttendanceReport,
    attendanceLoading,
    generateAttendanceReport,
    assignmentReport,
    assignmentLoading,
    reportCard,
    reportCardStudentId,
    setReportCardStudentId,
    reportCardTermId,
    setReportCardTermId,
    reportCardAsOfDate,
    setReportCardAsOfDate,
    reportCardLoading,
    availableStudentsForReportCard,
    availableTermsForReportCard,
    generateReportCard,
    refreshData,
    terms,
    selectedTermId,
    setSelectedTermId,
    refreshStudentProgress
  }
}
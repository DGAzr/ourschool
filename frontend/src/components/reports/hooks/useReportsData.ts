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

import { useState, useEffect, useCallback, useEffectEvent } from 'react'
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
  AssignmentReport,
  ReportCard
} from '../../../types'
import { Term } from '../../../types/term'
import { getErrorMessage } from '../../../services/api'

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
  // Per-student day-level data for admin calendar picker
  selectedStudentCalendarReport: StudentAttendanceReport | null
  calendarStudentLoading: boolean
  fetchStudentCalendar: (studentId: number) => Promise<void>

  // Assignment report data
  assignmentReport: AssignmentReport | null
  assignmentLoading: boolean
  
  // Report card data
  reportCard: ReportCard | null
  reportCardStudentId: string
  setReportCardStudentId: (id: string) => void
  reportCardTermId: string
  setReportCardTermId: (id: string) => void
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
  const [selectedView, setSelectedViewState] = useState<ReportView>('overview')

  // Switching views is user-triggered: show the spinner immediately here so
  // the load effect below doesn't have to set state synchronously.
  const setSelectedView = useCallback((view: ReportView) => {
    setLoading(true)
    setError(null)
    setSelectedViewState(view)
  }, [])
  
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
  // Per-student day-level report for the admin calendar picker
  const [selectedStudentCalendarReport, setSelectedStudentCalendarReport] = useState<StudentAttendanceReport | null>(null)
  const [calendarStudentLoading, setCalendarStudentLoading] = useState(false)
  
  // Assignment report states
  const [assignmentReport, setAssignmentReport] = useState<AssignmentReport | null>(null)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  
  // Report card states
  const [reportCard, setReportCard] = useState<ReportCard | null>(null)
  const [reportCardStudentId, setReportCardStudentId] = useState<string>('')
  const [reportCardTermId, setReportCardTermId] = useState<string>('')
  const [reportCardLoading, setReportCardLoading] = useState(false)
  const [availableStudentsForReportCard, setAvailableStudentsForReportCard] = useState<Array<{id: number, name: string}>>([])
  const [availableTermsForReportCard, setAvailableTermsForReportCard] = useState<Array<{id: number, name: string, academic_year: string}>>([])

  const isAdmin = user?.role === 'admin'

  // No synchronous spinner toggle here: `loading` starts true for the initial
  // load, and the user-triggered paths (setSelectedView / refreshData) turn it
  // on before calling this. State is only set from promise callbacks.
  const fetchDataForView = () => {
    // Load academic years for views that need them
    const loadYears =
      selectedView === 'attendance' || selectedView === 'overview'
        ? reportsApi.getAcademicYears().then((years) => {
            setAcademicYears(years)
            if (years.length > 0 && !selectedAcademicYear) {
              setSelectedAcademicYear(years[0].academic_year)
            }
          })
        : Promise.resolve()

    return loadYears
      .then(() => {
        if (selectedView === 'overview') {
          const request = isAdmin ? reportsApi.getAdminReport() : reportsApi.getStudentReport()
          return request.then((data) => setOverviewData(data))
        } else if (selectedView === 'terms' && !isAdmin) {
          return reportsApi.getStudentTermGrades().then(setTermGrades)
        } else if (selectedView === 'students' && isAdmin) {
          // Load terms for the Students report, then the student progress data
          return reportsApi.getTerms().then((termsData) => {
            setTerms(termsData)
            return reportsApi
              .getAllStudentsProgress(selectedTermId || undefined)
              .then(setStudentProgress)
          })
        } else if (selectedView === 'assignments' && isAdmin) {
          return fetchAssignmentReport()
        } else if (selectedView === 'reportcard') {
          return loadReportCardOptions()
        }
      })
      .catch((err) => {
        setError(`Failed to load report data: ${getErrorMessage(err, 'Unknown error')}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const fetchAssignmentReport = async () => {
    try {
      setAssignmentLoading(true)
      const data = await reportsApi.getAssignmentReport()
      setAssignmentReport(data)
    } catch (err) {
      setError('Failed to load assignment report')
    } finally {
      setAssignmentLoading(false)
    }
  }

  const loadReportCardOptions = async () => {
    try {
      // Load available terms (real terms with real IDs)
      const termsData = await reportsApi.getTerms()
      const termOptions = termsData.map(term => ({
        id: term.id,
        name: term.name,
        academic_year: term.academic_year
      }))
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
    } catch (err) {
      setError('Failed to load report card options: ' + (getErrorMessage(err, 'Unknown error')))
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

      const data = await reportsApi.getReportCard(studentId, termId)
      setReportCard(data)
    } catch (err) {
      setError('Failed to generate report card: ' + (getErrorMessage(err, 'Unknown error')))
    } finally {
      setReportCardLoading(false)
    }
  }

  // Fetch per-day records for a single student, using the same date range as the
  // current bulk report.  Used by the admin calendar picker.
  const fetchStudentCalendar = useCallback(async (studentId: number) => {
    if (!bulkAttendanceReport) return
    try {
      setCalendarStudentLoading(true)
      const data = await reportsApi.getStudentAttendanceReport({
        student_id: studentId,
        start_date: String(bulkAttendanceReport.start_date),
        end_date: String(bulkAttendanceReport.end_date),
      })
      setSelectedStudentCalendarReport(data)
    } catch {
      // Non-fatal: calendar just stays empty
      setSelectedStudentCalendarReport(null)
    } finally {
      setCalendarStudentLoading(false)
    }
  }, [bulkAttendanceReport])

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
    } catch (err) {
      setError('Failed to generate attendance report')
    } finally {
      setAttendanceLoading(false)
    }
  }

  // Fetch-only variant used by the term-change effect below (no synchronous
  // spinner toggle; the table simply swaps in the new data when it arrives).
  const loadStudentProgress = (termId?: number | null) => {
    return reportsApi
      .getAllStudentsProgress(termId || undefined)
      .then(setStudentProgress)
      .catch((err) => {
        setError(`Failed to load student progress: ${getErrorMessage(err, 'Unknown error')}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const refreshStudentProgress = async (termId?: number | null) => {
    if (selectedView === 'students' && isAdmin) {
      setLoading(true)
      await loadStudentProgress(termId)
    }
  }

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    await fetchDataForView()
  }

  // Effect event: reads the latest fetchDataForView without making every piece
  // of state it captures (selected dates, term, ...) a refetch trigger.
  const loadViewData = useEffectEvent(() => {
    fetchDataForView()
  })

  useEffect(() => {
    if (user) {
      loadViewData()
    }
  }, [selectedView, user, isAdmin])

  // Effect event: term changes should only reload student progress; the other
  // captured values (view, admin flag, terms) must not retrigger the effect.
  const reloadProgressForTerm = useEffectEvent((termId: number | null) => {
    if (selectedView === 'students' && isAdmin && terms.length > 0) {
      loadStudentProgress(termId)
    }
  })

  // Reload student progress when term selection changes
  useEffect(() => {
    reloadProgressForTerm(selectedTermId)
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
    selectedStudentCalendarReport,
    calendarStudentLoading,
    fetchStudentCalendar,
    assignmentReport,
    assignmentLoading,
    reportCard,
    reportCardStudentId,
    setReportCardStudentId,
    reportCardTermId,
    setReportCardTermId,
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
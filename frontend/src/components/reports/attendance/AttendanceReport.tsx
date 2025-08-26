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

import React from 'react'
import { Calendar, Download, Users, Clock, TrendingUp } from 'lucide-react'
import { AcademicYear, StudentAttendanceReport, BulkAttendanceReport } from '../../../types'

interface AttendanceReportProps {
  academicYears: AcademicYear[]
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
  isAdmin: boolean
}

const AttendanceReport: React.FC<AttendanceReportProps> = ({
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
  isAdmin
}) => {
  const downloadAttendanceCSV = () => {
    if (isAdmin && bulkAttendanceReport) {
      const csvContent = generateBulkAttendanceCSV(bulkAttendanceReport)
      downloadCSV(csvContent, 'bulk_attendance_report.csv')
    } else if (attendanceReport) {
      const csvContent = generateStudentAttendanceCSV(attendanceReport)
      downloadCSV(csvContent, 'student_attendance_report.csv')
    }
  }

  const generateBulkAttendanceCSV = (report: BulkAttendanceReport): string => {
    const headers = ['Student Name', 'Total Days', 'Present Days', 'Absent Days', 'Attendance Rate', 'First Absence', 'Recent Activity']
    const rows = report.students.map(student => [
      student.student_name,
      student.total_school_days.toString(),
      student.present_days.toString(),
      student.absent_days.toString(),
      `${student.attendance_rate.toFixed(1)}%`,
      student.first_absence_date || 'None',
      student.recent_activity_summary || 'No recent activity'
    ])
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }

  const generateStudentAttendanceCSV = (report: StudentAttendanceReport): string => {
    const headers = ['Date', 'Status', 'Notes']
    const rows = report.daily_attendance.map(day => [
      day.date,
      day.status,
      day.notes || ''
    ])
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className="space-y-6">
      {/* Attendance Report Controls */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Attendance Report Generator
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Generate comprehensive attendance reports for compliance purposes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                id="academic-year"
                name="date-selection"
                checked={!useCustomDates}
                onChange={() => setUseCustomDates(false)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="academic-year" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                By Academic Year
              </label>
            </div>
            
            {!useCustomDates && (
              <div className="ml-7">
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((year) => (
                    <option key={year.academic_year} value={year.academic_year}>
                      {year.academic_year} ({year.start_date} to {year.end_date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <input
                type="radio"
                id="custom-dates"
                name="date-selection"
                checked={useCustomDates}
                onChange={() => setUseCustomDates(true)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="custom-dates" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Date Range
              </label>
            </div>

            {useCustomDates && (
              <div className="ml-7 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div className="flex flex-col justify-center">
            <button
              onClick={generateAttendanceReport}
              disabled={attendanceLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {attendanceLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Report...
                </>
              ) : (
                <>
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Generate Attendance Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Report Results */}
      {(attendanceReport || bulkAttendanceReport) && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              {isAdmin ? 'Bulk Attendance Report' : 'Student Attendance Report'}
            </h3>
            <button
              onClick={downloadAttendanceCSV}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </button>
          </div>

          {isAdmin && bulkAttendanceReport ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Students</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {bulkAttendanceReport.students.length}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Average Attendance</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {bulkAttendanceReport.students.length > 0 
                          ? (bulkAttendanceReport.students.reduce((sum, student) => sum + student.attendance_rate, 0) / bulkAttendanceReport.students.length).toFixed(1)
                          : '0.0'
                        }%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-yellow-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Total Days</p>
                      <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                        {bulkAttendanceReport.total_school_days}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-red-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Total Absences</p>
                      <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                        {bulkAttendanceReport.students.reduce((sum, student) => sum + student.absent_days, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Present</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Absent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {bulkAttendanceReport.students.map((student) => (
                      <tr key={student.student_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {student.student_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {student.total_school_days}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                          {student.present_days}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                          {student.absent_days}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            student.attendance_rate >= 95 ? 'bg-green-100 text-green-800' :
                            student.attendance_rate >= 90 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {student.attendance_rate.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : attendanceReport && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Days</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {attendanceReport.summary.total_possible_days}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Present Days</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {attendanceReport.summary.present_days}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-red-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Attendance Rate</p>
                      <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                        {attendanceReport.summary.attendance_percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {attendanceReport.daily_attendance.map((day) => (
                      <tr key={day.date}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {new Date(day.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            day.status === 'present' ? 'bg-green-100 text-green-800' :
                            day.status === 'absent' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {day.status.charAt(0).toUpperCase() + day.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {day.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AttendanceReport
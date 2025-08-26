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

import React, { useState } from 'react'
import { Users, ChevronDown, BookOpen, TrendingUp } from 'lucide-react'
import { StudentProgress } from '../../../types'
import { Term } from '../../../types/lesson'
import { formatAttendanceRate } from '../../../utils/formatters'

interface StudentsReportProps {
  studentProgress: StudentProgress[]
  terms: Term[]
  loading: boolean
  selectedTermId?: number
  onTermChange?: (termId: number) => void
}

const StudentsReport: React.FC<StudentsReportProps> = ({ 
  studentProgress, 
  terms, 
  loading, 
  selectedTermId, 
  onTermChange 
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    studentProgress.length > 0 ? studentProgress[0].student_id : null
  )
  
  // Get the selected student data
  const selectedStudent = selectedStudentId 
    ? studentProgress.find(s => s.student_id === selectedStudentId)
    : null

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading student progress...</span>
        </div>
      </div>
    )
  }

  if (studentProgress.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No student data available</h3>
        <p className="text-gray-600 dark:text-gray-400">Student progress reports will appear here once students are enrolled and assignments are completed.</p>
      </div>
    )
  }


  const getGradeColor = (grade: number): string => {
    if (grade >= 90) return 'text-green-600'
    if (grade >= 80) return 'text-blue-600'
    if (grade >= 70) return 'text-yellow-600'
    if (grade >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getGradeBadge = (grade: number): string => {
    if (grade >= 90) return 'bg-green-100 text-green-800'
    if (grade >= 80) return 'bg-blue-100 text-blue-800'
    if (grade >= 70) return 'bg-yellow-100 text-yellow-800'
    if (grade >= 60) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }


  const getSubjectColor = (subjectId: number): string => {
    // Generate consistent colors based on subject ID
    const colors = [
      '#3B82F6', // blue
      '#10B981', // emerald
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // violet
      '#F97316', // orange
      '#06B6D4', // cyan
      '#84CC16', // lime
      '#EC4899', // pink
      '#6B7280'  // gray
    ]
    return colors[subjectId % colors.length]
  }

  return (
    <div className="space-y-6">
      {/* Student Selection Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Student Progress Report</h1>
          </div>
        </div>
        
        {/* Student and Term Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="student-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Student:
            </label>
            <div className="relative">
              <select
                id="student-select"
                value={selectedStudentId || ''}
                onChange={(e) => setSelectedStudentId(Number(e.target.value) || null)}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-4 py-2 pr-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              >
                <option value="">Select a student...</option>
                {studentProgress.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.first_name && student.last_name 
                      ? `${student.first_name} ${student.last_name}` 
                      : student.student_name
                    }
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label htmlFor="term-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Academic Term:
            </label>
            <div className="relative">
              <select
                id="term-select"
                value={selectedTermId || ''}
                onChange={(e) => onTermChange?.(Number(e.target.value))}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-4 py-2 pr-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              >
                <option value="">Current term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.academic_year})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Selected Student Details */}
      {selectedStudent ? (
        <>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mr-4">
              <span className="text-white font-semibold text-lg">
                {selectedStudent.first_name && selectedStudent.last_name 
                  ? `${selectedStudent.first_name.charAt(0)}${selectedStudent.last_name.charAt(0)}`
                  : selectedStudent.student_name.split(' ').map(name => name.charAt(0)).slice(0, 2).join('')
                }
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {selectedStudent.first_name && selectedStudent.last_name 
                  ? `${selectedStudent.first_name} ${selectedStudent.last_name}` 
                  : selectedStudent.student_name
                }
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedStudent.grade_level ? `Grade ${selectedStudent.grade_level}` : 'Grade not set'} • {selectedStudent.email || 'No email available'}
              </p>
            </div>
          </div>

          {/* Student Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Overall Grade</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {(selectedStudent.overall_grade || selectedStudent.average_grade)?.toFixed(1) || 'N/A'}%
                  </p>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGradeBadge(selectedStudent.overall_grade || selectedStudent.average_grade || 0)}`}>
                  {(selectedStudent.overall_grade || selectedStudent.average_grade || 0) >= 90 ? 'A' :
                   (selectedStudent.overall_grade || selectedStudent.average_grade || 0) >= 80 ? 'B' :
                   (selectedStudent.overall_grade || selectedStudent.average_grade || 0) >= 70 ? 'C' :
                   (selectedStudent.overall_grade || selectedStudent.average_grade || 0) >= 60 ? 'D' : 'F'}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Assignment Progress</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {selectedStudent.completed_assignments} / {selectedStudent.total_assignments}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {selectedStudent.pending_assignments || (selectedStudent.total_assignments - selectedStudent.completed_assignments) || 0} pending
                </p>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Completion Rate</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {(selectedStudent.completion_rate || (selectedStudent.completed_assignments / selectedStudent.total_assignments * 100) || 0).toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Attendance Rate</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {formatAttendanceRate(selectedStudent.attendance_rate)}
                </p>
              </div>
            </div>
          </div>

          {/* Last Activity */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Last Activity:</span> {
                selectedStudent.last_activity_date 
                  ? new Date(selectedStudent.last_activity_date).toLocaleDateString()
                  : 'No recent activity'
              }
            </p>
          </div>
        </div>

        {/* Subject Progress Table */}
        {(selectedStudent.subject_grades || selectedStudent.subjects) && (selectedStudent.subject_grades || selectedStudent.subjects).length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Subject Progress
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Detailed breakdown of performance by subject area
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Assignments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Grade Average
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Progress Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {(selectedStudent.subject_grades || selectedStudent.subjects).map((subject) => {
                    const completionRate = subject.total_assignments > 0 
                      ? (subject.completed_assignments / subject.total_assignments * 100) 
                      : 0
                    
                    return (
                      <tr key={subject.subject_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: getSubjectColor(subject.subject_id) }}></div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {subject.subject_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {completionRate.toFixed(1)}% complete
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {subject.completed_assignments} / {subject.total_assignments}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {subject.total_assignments - subject.completed_assignments} remaining
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {subject.points_earned !== undefined && subject.points_possible !== undefined 
                              ? `${Math.round(subject.points_earned)} / ${Math.round(subject.points_possible)}`
                              : `${subject.average_percentage.toFixed(1)}%`
                            }
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {subject.points_earned !== undefined && subject.points_possible !== undefined 
                              ? 'Points earned' 
                              : 'Average grade'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`text-lg font-bold mr-2 ${getGradeColor(subject.average_percentage)}`}>
                              {subject.average_percentage.toFixed(1)}%
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGradeBadge(subject.average_percentage)}`}>
                              {subject.average_percentage >= 90 ? 'A' :
                               subject.average_percentage >= 80 ? 'B' :
                               subject.average_percentage >= 70 ? 'C' :
                               subject.average_percentage >= 60 ? 'D' : 'F'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-24 h-8 bg-gray-100 dark:bg-gray-700 rounded">
                              <div className="h-full flex items-end justify-around px-1">
                                {subject.trend_data && subject.trend_data.length > 0 ? (
                                  subject.trend_data.map((point, index) => (
                                    <div
                                      key={index}
                                      className="bg-blue-500 rounded-sm w-2"
                                      style={{ height: `${Math.max(5, (point.average_grade / 100) * 100)}%` }}
                                      title={`${point.average_grade.toFixed(1)}% (${new Date(point.date).toLocaleDateString()})`}
                                    />
                                  ))
                                ) : (
                                  // Fallback for subjects without enough trend data
                                  <div
                                    className="bg-blue-500 rounded-sm w-2"
                                    style={{ height: `${Math.max(5, (subject.average_percentage / 100) * 100)}%` }}
                                    title={`${subject.average_percentage.toFixed(1)}% (Current)`}
                                  />
                                )}
                              </div>
                            </div>
                            <TrendingUp className={`h-4 w-4 ml-2 ${
                              (() => {
                                if (subject.trend_data && subject.trend_data.length >= 2) {
                                  const trend = subject.trend_data[subject.trend_data.length - 1].average_grade - 
                                               subject.trend_data[0].average_grade;
                                  return trend > 5 ? 'text-green-500' : 
                                         trend < -5 ? 'text-red-500' : 'text-yellow-500';
                                }
                                return subject.average_percentage >= 85 ? 'text-green-500' : 
                                       subject.average_percentage >= 70 ? 'text-yellow-500' : 
                                       'text-red-500';
                              })()
                            }`} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Student Selected</h3>
            <p className="text-gray-600 dark:text-gray-400">Please select a student from the dropdown above to view their detailed progress.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentsReport
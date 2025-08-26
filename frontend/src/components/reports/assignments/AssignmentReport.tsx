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

import React, { useState, useMemo, useEffect } from 'react'
import { ClipboardList, TrendingUp, Target, BookOpen, CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-react'
import { AssignmentReport as AssignmentReportType } from '../../../types'
import { Term } from '../../../types/lesson'
import { reportsApi } from '../../../services/reports'
import AssignmentDetailModal from '../../assignments/AssignmentDetailModal'

interface AssignmentReportProps {
  assignmentReport: AssignmentReportType | null
  loading: boolean
}

const AssignmentReport: React.FC<AssignmentReportProps> = ({ assignmentReport, loading }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)
  const [allTerms, setAllTerms] = useState<Term[]>([])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [selectedAssignmentStudentId, setSelectedAssignmentStudentId] = useState<number | null>(null)

  // Fetch all terms to get the is_active field
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const terms = await reportsApi.getTerms()
        setAllTerms(terms)
      } catch (error) {
        // Failed to fetch terms
      }
    }
    fetchTerms()
  }, [])

  // Update selections when assignment report data loads
  useEffect(() => {
    if (assignmentReport?.available_students?.length && selectedStudentId === null) {
      // Default to first student (or could be "All students" by keeping null)
      setSelectedStudentId(assignmentReport.available_students[0].id)
    }
    
    if (assignmentReport?.available_terms?.length && allTerms.length && selectedTermId === null) {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1 // 1-12
      
      // Get only active terms that are also available in the assignment report
      const availableTermIds = new Set(assignmentReport.available_terms.map(t => t.id))
      const activeAvailableTerms = allTerms.filter(term => 
        term.is_active && availableTermIds.has(term.id)
      )
      
      // Find the best matching active term for current time
      let bestTerm = null
      
      if (activeAvailableTerms.length > 0) {
        // First, try to find an active term from the current academic year
        const currentYearActiveTerms = activeAvailableTerms.filter(term => 
          term.academic_year.includes(currentYear.toString())
        )
        
        if (currentYearActiveTerms.length > 0) {
          // Try to find the most appropriate active term based on current date
          if (currentMonth >= 8 && currentMonth <= 12) {
            // Fall semester (Aug-Dec)
            bestTerm = currentYearActiveTerms.find(term => 
              term.name.toLowerCase().includes('fall') || 
              term.name.toLowerCase().includes('autumn') ||
              term.name.toLowerCase().includes('semester 1') ||
              term.name.toLowerCase().includes('q1') ||
              term.name.toLowerCase().includes('quarter 1')
            )
          } else if (currentMonth >= 1 && currentMonth <= 5) {
            // Spring semester (Jan-May)
            bestTerm = currentYearActiveTerms.find(term => 
              term.name.toLowerCase().includes('spring') ||
              term.name.toLowerCase().includes('semester 2') ||
              term.name.toLowerCase().includes('q2') ||
              term.name.toLowerCase().includes('quarter 2')
            )
          } else {
            // Summer (Jun-Jul)
            bestTerm = currentYearActiveTerms.find(term => 
              term.name.toLowerCase().includes('summer') ||
              term.name.toLowerCase().includes('q3') ||
              term.name.toLowerCase().includes('quarter 3')
            )
          }
          
          // Fallback to first active term from current year if no specific match
          if (!bestTerm) {
            bestTerm = currentYearActiveTerms[0]
          }
        } else {
          // Fallback: use the first active term
          bestTerm = activeAvailableTerms[0]
        }
      } else {
        // No active terms available, fallback to any available term
        bestTerm = assignmentReport.available_terms[0]
      }
      
      setSelectedTermId(bestTerm.id)
    }
  }, [assignmentReport, selectedStudentId, selectedTermId, allTerms])

  // Filter assignments based on selected student and term
  const filteredAssignments = useMemo(() => {
    if (!assignmentReport?.assignments) return []
    
    return assignmentReport.assignments.filter(assignment => {
      const matchesStudent = !selectedStudentId || assignment.student_id === selectedStudentId
      const matchesTerm = !selectedTermId || assignment.term_id === selectedTermId
      return matchesStudent && matchesTerm
    })
  }, [assignmentReport?.assignments, selectedStudentId, selectedTermId])

  // Calculate student-specific summary statistics
  const studentSummary = useMemo(() => {
    const assignments = filteredAssignments
    const totalAssignments = assignments.length
    const completedAssignments = assignments.filter(a => a.status === 'graded').length
    const inProgressAssignments = assignments.filter(a => a.status === 'in_progress').length
    const notStartedAssignments = assignments.filter(a => a.status === 'not_started').length
    const overdueAssignments = assignments.filter(a => 
      a.due_date && new Date(a.due_date) < new Date() && a.status !== 'graded'
    ).length
    
    const gradedAssignments = assignments.filter(a => a.percentage_grade !== null && a.percentage_grade !== undefined)
    const averageGrade = gradedAssignments.length > 0 
      ? gradedAssignments.reduce((sum, a) => sum + (a.percentage_grade || 0), 0) / gradedAssignments.length
      : null

    return {
      totalAssignments,
      completedAssignments,
      inProgressAssignments,
      notStartedAssignments,
      overdueAssignments,
      averageGrade
    }
  }, [filteredAssignments])
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading assignment report...</span>
        </div>
      </div>
    )
  }

  if (!assignmentReport) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No assignment data available</h3>
        <p className="text-gray-600 dark:text-gray-400">Assignment reports will appear here once assignments are created and submitted.</p>
      </div>
    )
  }

  const handleAssignmentClick = (assignmentId: number, studentId?: number) => {
    setSelectedAssignmentId(assignmentId)
    setSelectedAssignmentStudentId(studentId || null)
    setShowDetailModal(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'submitted':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'not_started':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'overdue':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded':
        return 'bg-green-100 text-green-800'
      case 'submitted':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'not_started':
        return 'bg-red-100 text-red-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Student and Term Selection Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <ClipboardList className="h-6 w-6 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Student Assignment Report</h1>
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
                <option value="">All students...</option>
                {assignmentReport?.available_students?.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label htmlFor="term-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Term:
            </label>
            <div className="relative">
              <select
                id="term-select"
                value={selectedTermId || ''}
                onChange={(e) => setSelectedTermId(Number(e.target.value) || null)}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 px-4 py-2 pr-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
              >
                <option value="">All terms...</option>
                {assignmentReport?.available_terms?.map((term) => (
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

      {/* Student Summary Statistics */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Assignment Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-center">
              <ClipboardList className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {studentSummary.totalAssignments}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Completed</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {studentSummary.completedAssignments}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {studentSummary.inProgressAssignments}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Overdue</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {studentSummary.overdueAssignments}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Avg Grade</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {studentSummary.averageGrade ? studentSummary.averageGrade.toFixed(1) : 'N/A'}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Assignment Table */}
      {filteredAssignments.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Assignment Details
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''})
              </span>
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAssignments.map((assignment) => {
                  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date() && assignment.status !== 'graded'
                  
                  return (
                    <tr 
                      key={assignment.assignment_id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => handleAssignmentClick(assignment.assignment_id, assignment.student_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {assignment.assignment_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Assigned: {new Date(assignment.assigned_date).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: assignment.subject_color || '#9CA3AF' }}
                          ></div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {assignment.subject_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-900 dark:text-gray-100'}`}>
                          {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}
                        </div>
                        {isOverdue && (
                          <div className="text-xs text-red-500 dark:text-red-400">
                            Overdue
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(assignment.status)}`}>
                          {getStatusIcon(assignment.status)}
                          <span className="ml-1">
                            {assignment.status.replace('_', ' ').charAt(0).toUpperCase() + assignment.status.replace('_', ' ').slice(1)}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {assignment.points_earned !== null && assignment.points_earned !== undefined
                          ? `${assignment.points_earned} / ${assignment.max_points}`
                          : `— / ${assignment.max_points}`
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {assignment.percentage_grade !== null && assignment.percentage_grade !== undefined ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            assignment.percentage_grade >= 90 ? 'bg-green-100 text-green-800' :
                            assignment.percentage_grade >= 80 ? 'bg-blue-100 text-blue-800' :
                            assignment.percentage_grade >= 70 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {assignment.percentage_grade.toFixed(1)}% ({assignment.letter_grade || 'N/A'})
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">Not graded</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {assignment.assignment_type.charAt(0).toUpperCase() + assignment.assignment_type.slice(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="text-center py-8">
            <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Assignments Found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedStudentId && selectedTermId 
                ? "No assignments found for the selected student and term."
                : selectedStudentId 
                ? "No assignments found for the selected student."
                : selectedTermId
                ? "No assignments found for the selected term."
                : "No assignments available. Please check your filters."}
            </p>
          </div>
        </div>
      )}

      {/* Assignment Detail Modal */}
      {showDetailModal && selectedAssignmentId && (
        <AssignmentDetailModal
          assignmentId={selectedAssignmentId}
          studentId={selectedAssignmentStudentId || undefined}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedAssignmentId(null)
            setSelectedAssignmentStudentId(null)
          }}
        />
      )}
    </div>
  )
}

export default AssignmentReport
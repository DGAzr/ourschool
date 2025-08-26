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
import { BarChart3, TrendingUp, Calendar } from 'lucide-react'
import { TermGrade } from '../../../types'

interface TermReportProps {
  termGrades: TermGrade[]
  loading: boolean
}

const TermReport: React.FC<TermReportProps> = ({ termGrades, loading }) => {
  const calculateGradeColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 70) return 'text-yellow-600'
    if (percentage >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  const getGradeLetter = (percentage: number): string => {
    if (percentage >= 90) return 'A'
    if (percentage >= 80) return 'B'
    if (percentage >= 70) return 'C'
    if (percentage >= 60) return 'D'
    return 'F'
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading term grades...</span>
        </div>
      </div>
    )
  }

  if (termGrades.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No term grades available</h3>
        <p className="text-gray-600 dark:text-gray-400">Term grades will appear here once assignments are completed and graded.</p>
      </div>
    )
  }

  // Group grades by term
  const gradesByTerm = termGrades.reduce((acc, grade) => {
    const termKey = grade.academic_year + ' - ' + grade.term
    if (!acc[termKey]) {
      acc[termKey] = []
    }
    acc[termKey].push(grade)
    return acc
  }, {} as Record<string, TermGrade[]>)

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Calendar className="h-5 w-5 text-amber-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Grade by Term & Subject</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Your academic performance organized by term and subject area.
        </p>
        
        <div className="space-y-8">
          {Object.entries(gradesByTerm).map(([termKey, grades]) => (
            <div key={termKey} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-amber-600" />
                {termKey}
              </h4>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {grades.map((grade, index) => (
                  <div 
                    key={index} 
                    className="py-4 first:pt-0 last:pb-0"
                    style={{ 
                      borderLeft: `4px solid ${grade.subject_color || '#9CA3AF'}`,
                      paddingLeft: '16px',
                      marginLeft: '8px'
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h5 
                        className="text-sm font-medium"
                        style={{ color: grade.subject_color || '#374151' }}
                      >
                        {grade.subject_name}
                      </h5>
                      <div className="flex items-center space-x-2">
                        <span className={`text-lg font-bold ${calculateGradeColor(grade.percentage)}`}>
                          {grade.percentage.toFixed(1)}%
                        </span>
                        <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
                          grade.percentage >= 90 ? 'bg-green-100 text-green-800' :
                          grade.percentage >= 80 ? 'bg-blue-100 text-blue-800' :
                          grade.percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          grade.percentage >= 60 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {getGradeLetter(grade.percentage)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Total Points:</span>
                        <div>{grade.total_points_earned} / {grade.total_points_possible}</div>
                      </div>
                      <div>
                        <span className="font-medium">Assignments:</span>
                        <div>{grade.total_assignments}</div>
                      </div>
                      <div>
                        <span className="font-medium">Completion:</span>
                        <div>{grade.completion_rate.toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    {grade.notes && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 italic">
                        {grade.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TermReport
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

import { TrendingUp } from 'lucide-react'
import { Card } from '../../ui'
import { StudentReport, AdminReport } from '../../../types'

interface OverviewPerformanceProps {
  data: StudentReport | AdminReport | null
  isAdmin: boolean
}

// Helper function to calculate grade colors
const calculateGradeColor = (grade: number): string => {
  if (grade >= 90) return 'text-green-600 dark:text-green-400'
  if (grade >= 80) return 'text-blue-600 dark:text-blue-400'
  if (grade >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

const OverviewPerformance: React.FC<OverviewPerformanceProps> = ({ data, isAdmin }) => {
  if (!data) {
    return (
      <Card className="animate-pulse">
        <Card.Header>
          <div className="flex items-center">
            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded mr-2"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>
    )
  }

  const studentData = data as StudentReport

  const performanceItems = [
    {
      label: 'Current Term Average',
      value: !isAdmin && studentData.current_term_grade 
        ? `${studentData.current_term_grade}%` 
        : 'N/A',
      colorClass: !isAdmin && studentData.current_term_grade 
        ? calculateGradeColor(studentData.current_term_grade) 
        : 'text-gray-500'
    },
    {
      label: 'Completion Rate',
      value: data.total_assignments > 0
        ? `${Math.round((data.completed_assignments / data.total_assignments) * 100)}%`
        : '0%',
      colorClass: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Pending Grades',
      value: `${data.pending_grades || 0}`,
      colorClass: 'text-orange-600 dark:text-orange-400'
    }
  ]

  return (
    <Card className="border-gray-100 dark:border-gray-700">
      <Card.Header>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-amber-600" />
          Recent Performance
        </h3>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          {performanceItems.map((item, index) => (
            <div key={index} className="flex justify-between items-center py-2">
              <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              <span className={`font-semibold ${item.colorClass}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </Card.Content>
    </Card>
  )
}

export default OverviewPerformance
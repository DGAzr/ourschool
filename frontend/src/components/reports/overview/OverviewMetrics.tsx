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

import {
  FileText,
  Target,
  Clock,
  TrendingUp
} from 'lucide-react'
import { Card } from '../../ui'
import { StudentReport, AdminReport } from '../../../types'

interface OverviewMetricsProps {
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

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  bgColor: string
  textColor?: string
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  bgColor,
  textColor = 'text-gray-900 dark:text-gray-100'
}) => (
  <Card className="hover:shadow-xl transition-all duration-200 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600">
    <Card.Content className="p-6">
      <div className="flex items-center">
        <div className={`p-3 ${bgColor} rounded-xl shadow-sm`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className={`text-2xl font-bold ${textColor}`}>
            {value}
          </p>
        </div>
      </div>
    </Card.Content>
  </Card>
)

const OverviewMetrics: React.FC<OverviewMetricsProps> = ({ data, isAdmin }) => {
  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <Card.Content className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                <div className="ml-4 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>
    )
  }

  const adminData = data as AdminReport
  const studentData = data as StudentReport

  const metrics = [
    {
      icon: <FileText className="h-6 w-6 text-white" />,
      label: isAdmin ? 'Total Students' : 'Total Assignments',
      value: isAdmin ? adminData.total_students : studentData.total_assignments,
      bgColor: 'bg-gradient-to-br from-blue-500 to-blue-600'
    },
    {
      icon: <Target className="h-6 w-6 text-white" />,
      label: isAdmin ? 'Active Assignments' : 'Completed',
      value: isAdmin ? adminData.active_assignments : studentData.completed_assignments,
      bgColor: 'bg-gradient-to-br from-green-500 to-green-600'
    },
    {
      icon: <Clock className="h-6 w-6 text-white" />,
      label: isAdmin ? 'Pending Grades' : 'In Progress',
      value: isAdmin ? adminData.pending_grades : studentData.in_progress_assignments,
      bgColor: 'bg-gradient-to-br from-yellow-500 to-yellow-600'
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-white" />,
      label: 'Average Grade',
      value: `${data.average_grade ?? 0}%`,
      bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600',
      textColor: calculateGradeColor(data.average_grade ?? 0)
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          icon={metric.icon}
          label={metric.label}
          value={metric.value}
          bgColor={metric.bgColor}
          textColor={metric.textColor}
        />
      ))}
    </div>
  )
}

export default OverviewMetrics
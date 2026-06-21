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

import { StudentReport, AdminReport } from '../../../types'
import { StatTile } from '../../ui'

interface OverviewMetricsProps {
  data: StudentReport | AdminReport | null
  isAdmin: boolean
}

const OverviewMetrics: React.FC<OverviewMetricsProps> = ({ data, isAdmin }) => {
  const adminData = data as AdminReport
  const studentData = data as StudentReport

  const metrics = data ? [
    {
      label: isAdmin ? 'Total Students' : 'Total Assignments',
      value: String(isAdmin ? (adminData.total_students ?? 0) : (studentData.total_assignments ?? 0)),
    },
    {
      label: isAdmin ? 'Active Assignments' : 'Completed',
      value: String(isAdmin ? (adminData.active_assignments ?? 0) : (studentData.completed_assignments ?? 0)),
    },
    {
      label: isAdmin ? 'Pending Grades' : 'In Progress',
      value: String(isAdmin ? (adminData.pending_grades ?? 0) : (studentData.in_progress_assignments ?? 0)),
    },
    {
      label: 'Average Grade',
      value: `${data.average_grade ?? 0}%`,
      accent: (data.average_grade ?? 0) >= 80,
    },
  ] : Array(4).fill({ label: '—', value: '—' })

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((m, i) => (
        <StatTile key={i} label={m.label} value={m.value} accent={m.accent} />
      ))}
    </div>
  )
}

export default OverviewMetrics
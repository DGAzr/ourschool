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

interface OverviewPerformanceProps {
  data: StudentReport | AdminReport | null
  isAdmin: boolean
}

const gradeColor = (g: number) =>
  g >= 90 ? 'text-pos-fg' : g >= 80 ? 'text-info-fg' : g >= 70 ? 'text-sub-fg' : 'text-neg-fg'

const OverviewPerformance: React.FC<OverviewPerformanceProps> = ({ data, isAdmin }) => {
  if (!data) {
    return (
      <div className="bg-panel border border-line rounded-card p-5 animate-pulse">
        <div className="h-4 bg-track rounded w-40 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex justify-between py-3 border-t border-line-2">
            <div className="h-3 bg-track rounded w-32" />
            <div className="h-3 bg-track rounded w-14" />
          </div>
        ))}
      </div>
    )
  }

  const studentData = data as StudentReport

  const items = [
    {
      label: 'Current Term Average',
      value: !isAdmin && studentData.current_term_grade ? `${studentData.current_term_grade}%` : 'N/A',
      colorClass: !isAdmin && studentData.current_term_grade ? gradeColor(studentData.current_term_grade) : 'text-muted',
    },
    {
      label: 'Completion Rate',
      value: data.total_assignments > 0
        ? `${Math.round((data.completed_assignments / data.total_assignments) * 100)}%`
        : '0%',
      colorClass: 'text-pos-fg',
    },
    {
      label: 'Pending Grades',
      value: `${data.pending_grades || 0}`,
      colorClass: (data.pending_grades || 0) > 0 ? 'text-sub-fg' : 'text-muted',
    },
  ]

  return (
    <div className="bg-panel border border-line rounded-card p-5">
      <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-4">Recent Performance</p>
      <div className="divide-y divide-line-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <span className="text-[13.5px] text-ink-2">{item.label}</span>
            <span className={`font-mono font-semibold text-[14px] ${item.colorClass}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default OverviewPerformance

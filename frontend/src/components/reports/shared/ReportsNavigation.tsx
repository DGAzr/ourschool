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

import { ReportView } from '../hooks/useReportsData'

interface ReportsNavigationProps {
  selectedView: ReportView
  onViewChange: (view: ReportView) => void
  isAdmin: boolean
}

const ReportsNavigation: React.FC<ReportsNavigationProps> = ({
  selectedView,
  onViewChange,
  isAdmin
}) => {
  const navItems = [
    { view: 'overview' as ReportView, label: 'Overview' },
    { view: 'attendance' as ReportView, label: 'Attendance' },
    ...(isAdmin ? [
      { view: 'students' as ReportView, label: 'Students' },
      { view: 'assignments' as ReportView, label: 'Assignments' },
      { view: 'reportcard' as ReportView, label: 'Report Cards' }
    ] : [
      { view: 'terms' as ReportView, label: 'Terms' },
      { view: 'reportcard' as ReportView, label: 'Report Card' }
    ])
  ]

return (
    <div className="inline-flex items-center gap-0.5 bg-track p-[3px] rounded-[10px] mb-6">
      {navItems.map((item) => {
        const active = selectedView === item.view
        return (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={[
              'px-3 py-1.5 rounded-[8px] text-[12.5px] font-semibold transition-all duration-150 select-none',
              active ? 'bg-seg-active text-ink shadow-sm' : 'text-muted hover:text-ink-2',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default ReportsNavigation
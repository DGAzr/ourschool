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

  const getButtonClasses = (view: ReportView) => {
    const baseClasses = 'px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200'
    const activeClasses = 'bg-amber-600 text-white shadow-sm'
    const inactiveClasses = 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
    
    return `${baseClasses} ${selectedView === view ? activeClasses : inactiveClasses}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-1 border border-gray-100 dark:border-gray-700 mb-6">
      <div className="flex flex-wrap gap-1">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={getButtonClasses(item.view)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ReportsNavigation
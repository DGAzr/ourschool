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
import { Table2, List, AlignJustify, LayoutGrid } from 'lucide-react'
import { ViewDensity } from '../layouts/CompactListLayout'

interface ViewDensitySelectorProps {
  viewDensity: ViewDensity
  onViewDensityChange: (density: ViewDensity) => void
  className?: string
}

const ViewDensitySelector: React.FC<ViewDensitySelectorProps> = ({
  viewDensity,
  onViewDensityChange,
  className = ''
}) => {
  const densityOptions = [
    {
      value: 'table' as ViewDensity,
      icon: Table2,
      title: 'Table view - Best information density'
    },
    {
      value: 'compact' as ViewDensity,
      icon: List,
      title: 'Compact list view - More items visible'
    },
    {
      value: 'comfortable' as ViewDensity,
      icon: AlignJustify,
      title: 'Comfortable list view - Balanced layout'
    },
    {
      value: 'spacious' as ViewDensity,
      icon: LayoutGrid,
      title: 'Card view - Spacious layout'
    }
  ]

  return (
    <div className={`flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg ${className}`}>
      {densityOptions.map(({ value, icon: Icon, title }) => (
        <button
          key={value}
          onClick={() => onViewDensityChange(value)}
          className={`p-2 rounded-md transition-colors ${
            viewDensity === value
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
          title={title}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

export default ViewDensitySelector
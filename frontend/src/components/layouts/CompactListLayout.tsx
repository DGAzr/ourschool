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

export type ViewDensity = 'table' | 'compact' | 'comfortable' | 'spacious'

interface CompactListLayoutProps {
  // List-specific props
  items: React.ReactNode[]
  emptyMessage?: string
  emptyDescription?: string
  customContent?: React.ReactNode
  
  // View density
  viewDensity: ViewDensity
}

const CompactListLayout: React.FC<CompactListLayoutProps> = ({
  items,
  emptyMessage = 'No data available',
  emptyDescription = 'There are no items to display.',
  customContent,
  viewDensity
}) => {

  const renderList = () => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {emptyMessage}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {emptyDescription}
          </p>
        </div>
      )
    }

    const getListSpacing = () => {
      switch (viewDensity) {
        case 'table':
          return ''
        case 'compact':
          return 'space-y-1'
        case 'comfortable':
          return 'space-y-3'
        case 'spacious':
          return 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
        default:
          return 'space-y-3'
      }
    }

    return (
      <div className={viewDensity === 'table' ? '' : 'bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700'}>
        <div className={`${viewDensity === 'spacious' ? 'p-4' : viewDensity === 'table' ? '' : 'p-0'} ${getListSpacing()}`}>
          {items}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {customContent && customContent}
      {renderList()}
    </div>
  )
}

export default CompactListLayout
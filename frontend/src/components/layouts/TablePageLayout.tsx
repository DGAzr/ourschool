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
import { LucideIcon } from 'lucide-react'
import PageLayout from './PageLayout'

interface TablePageLayoutProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  headerColor?: 'blue' | 'red' | 'purple' | 'green' | 'orange' | 'indigo' | 'gray'
  actions?: React.ReactNode
  loading?: boolean
  error?: string | null
  accessDenied?: boolean
  accessDeniedMessage?: string
  
  // Table-specific props
  tableHeaders: string[]
  tableData: React.ReactNode[][]
  emptyMessage?: string
  emptyDescription?: string
  tableActions?: (rowIndex: number, rowData: any) => React.ReactNode
  customContent?: React.ReactNode
}

const TablePageLayout: React.FC<TablePageLayoutProps> = ({
  title,
  subtitle,
  icon,
  headerColor = 'blue',
  actions,
  loading = false,
  error = null,
  accessDenied = false,
  accessDeniedMessage = 'Access denied',
  tableHeaders,
  tableData,
  emptyMessage = 'No data available',
  emptyDescription = 'There are no items to display.',
  tableActions,
  customContent
}) => {
  const renderTable = () => {
    if (tableData.length === 0) {
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

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {tableHeaders.map((header, index) => (
                  <th
                    key={index}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
                {tableActions && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100"
                    >
                      {cell}
                    </td>
                  ))}
                  {tableActions && (
                    <td className="px-6 py-4 text-right text-sm">
                      {tableActions(rowIndex, row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      icon={icon}
      headerColor={headerColor}
      actions={actions}
      loading={loading}
      error={error}
      accessDenied={accessDenied}
      accessDeniedMessage={accessDeniedMessage}
    >
      <div className="space-y-6">
        {customContent && customContent}
        {renderTable()}
      </div>
    </PageLayout>
  )
}

export default TablePageLayout
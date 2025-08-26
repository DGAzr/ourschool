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

import { ReactNode } from 'react'
import { Card } from '../../ui'

interface ReportHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className = ''
}) => {
  return (
    <Card className={`mb-6 ${className}`}>
      <Card.Header>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {icon && (
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mr-4">
                <div className="text-blue-600 dark:text-blue-400">
                  {icon}
                </div>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {title}
              </h1>
              {subtitle && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center space-x-3">
              {actions}
            </div>
          )}
        </div>
      </Card.Header>
    </Card>
  )
}

export default ReportHeader
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
import { AlertCircle, X } from 'lucide-react'

interface ErrorDisplayProps {
  error: string | null
  onDismiss?: () => void
  className?: string
  variant?: 'default' | 'compact'
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onDismiss, 
  className = '',
  variant = 'default'
}) => {
  if (!error) return null

  const baseClasses = variant === 'compact' 
    ? 'bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm'
    : 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded'

  return (
    <div className={`${baseClasses} ${className}`}>
      <div className="flex items-start">
        <AlertCircle className={`${variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'} mr-2 mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          <p className={variant === 'compact' ? 'text-sm' : ''}>{error}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`ml-2 text-red-400 hover:text-red-600 flex-shrink-0 ${
              variant === 'compact' ? 'p-0.5' : 'p-1'
            }`}
            aria-label="Dismiss error"
          >
            <X className={variant === 'compact' ? 'h-3 w-3' : 'h-4 w-4'} />
          </button>
        )}
      </div>
    </div>
  )
}

export default ErrorDisplay
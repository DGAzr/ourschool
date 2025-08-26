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

import { Spinner } from '../../ui'

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading report data...',
  size = 'md',
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Spinner size={size} />
      {message && (
        <p className="text-gray-600 dark:text-gray-400 mt-4 text-center">
          {message}
        </p>
      )}
    </div>
  )
}

export default LoadingSpinner
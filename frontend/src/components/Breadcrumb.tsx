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
import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  /** Display text for the breadcrumb item */
  label: string
  /** URL to navigate to (if not provided, item is not clickable) */
  href?: string
  /** Whether this is the current/active item */
  current?: boolean
  /** Optional icon component */
  icon?: React.ComponentType<{ className?: string }>
}

interface BreadcrumbProps {
  /** Array of breadcrumb items */
  items: BreadcrumbItem[]
  /** Whether to show the home icon on the first item */
  showHome?: boolean
}

/**
 * Breadcrumb navigation component for showing the current page's location
 * within the application hierarchy.
 * 
 * Features:
 * - Accessible navigation with proper ARIA labels
 * - Support for icons on breadcrumb items
 * - Responsive design that truncates on small screens
 * - Keyboard navigation support
 * - Current page highlighting
 */
const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  items, 
  showHome = true 
}) => {
  return (
    <nav 
      className="flex mb-6" 
      aria-label="Breadcrumb navigation"
    >
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {/* Home Link */}
        {showHome && (
          <li className="inline-flex items-center">
            <Link
              to="/"
              className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
              aria-label="Go to dashboard"
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Link>
          </li>
        )}

        {/* Breadcrumb Items */}
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {(showHome || index > 0) && (
              <ChevronRight className="w-4 h-4 text-gray-400 mx-1" aria-hidden="true" />
            )}
            
            {item.current ? (
              <span 
                className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400 truncate max-w-[200px] md:max-w-none"
                aria-current="page"
              >
                {item.icon && <item.icon className="w-4 h-4 mr-2 inline" />}
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                to={item.href}
                className="ml-1 text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white truncate max-w-[200px] md:max-w-none"
              >
                {item.icon && <item.icon className="w-4 h-4 mr-2 inline" />}
                {item.label}
              </Link>
            ) : (
              <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400 truncate max-w-[200px] md:max-w-none">
                {item.icon && <item.icon className="w-4 h-4 mr-2 inline" />}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Breadcrumb
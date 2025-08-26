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
import { BUTTON_SIZES, STATUS_COLORS, SPINNER_STYLES } from '../../../constants'
import { ButtonProps } from './Button.types'

/**
 * A flexible and reusable button component with multiple variants, sizes, and states.
 * 
 * @component
 * @example
 * ```tsx
 * // Primary button
 * <Button variant="primary" onClick={handleSave}>
 *   Save Changes
 * </Button>
 * 
 * // Loading state
 * <Button loading={isSubmitting} disabled={!isValid}>
 *   Submit Form
 * </Button>
 * 
 * // With icon
 * <Button variant="secondary" icon={<PlusIcon />}>
 *   Add Item
 * </Button>
 * ```
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  className = '',
  ...props
}) => {
  /**
   * Returns CSS classes for button variant styling
   * @returns {string} Combined CSS classes for the selected variant
   */
  const getVariantClasses = () => {
    const base = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    switch (variant) {
      case 'primary':
        return `${base} text-white ${STATUS_COLORS.info.button} focus:ring-blue-500`
      case 'secondary':
        return `${base} text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 focus:ring-gray-500`
      case 'danger':
        return `${base} text-white ${STATUS_COLORS.error.button} focus:ring-red-500`
      case 'success':
        return `${base} text-white ${STATUS_COLORS.success.button} focus:ring-green-500`
      case 'outline':
        return `${base} text-blue-600 dark:text-blue-400 bg-transparent border-2 border-blue-600 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 focus:ring-blue-500`
      default:
        return `${base} text-white ${STATUS_COLORS.info.button} focus:ring-blue-500`
    }
  }

  /**
   * Returns CSS classes for button size styling
   * @returns {string} CSS classes for the selected size
   */
  const getSizeClasses = () => {
    return BUTTON_SIZES[size]
  }

  /**
   * Returns CSS classes for button width styling
   * @returns {string} CSS classes for width (full width or default)
   */
  const getWidthClasses = () => {
    return fullWidth ? 'w-full' : ''
  }

  /**
   * Returns CSS classes for disabled/loading state styling
   * @returns {string} CSS classes for interactive states
   */
  const getDisabledClasses = () => {
    return (disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
  }

  const buttonClasses = [
    getVariantClasses(),
    getSizeClasses(),
    getWidthClasses(),
    getDisabledClasses(),
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      className={buttonClasses}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className={`${SPINNER_STYLES.sm} ${SPINNER_STYLES.base} mr-2`}></div>
      )}
      {!loading && icon && (
        <span className="mr-2">{icon}</span>
      )}
      {children}
    </button>
  )
}

export default Button
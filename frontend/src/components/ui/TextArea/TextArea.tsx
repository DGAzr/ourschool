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

import { TextareaHTMLAttributes, forwardRef } from 'react'
import { INPUT_STYLES } from '../../../constants'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
  resize?: 'none' | 'both' | 'horizontal' | 'vertical'
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  label,
  error,
  helperText,
  fullWidth = true,
  resize = 'vertical',
  className = '',
  disabled = false,
  rows = 4,
  ...props
}, ref) => {
  const getTextAreaClasses = () => {
    const baseClasses = INPUT_STYLES.base
    const errorClasses = error ? INPUT_STYLES.error : ''
    const disabledClasses = disabled ? INPUT_STYLES.disabled : ''
    const widthClasses = fullWidth ? 'w-full' : ''
    const resizeClasses = `resize-${resize}`
    
    return [baseClasses, errorClasses, disabledClasses, widthClasses, resizeClasses, className]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={getTextAreaClasses()}
        disabled={disabled}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  )
})

TextArea.displayName = 'TextArea'

export default TextArea
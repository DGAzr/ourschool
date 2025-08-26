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

import { InputHTMLAttributes, forwardRef } from 'react'
import { INPUT_STYLES } from '../../../constants'

/**
 * Props for the Input component
 * Extends all standard HTML input attributes
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Label text to display above the input */
  label?: string
  /** Error message to display below the input */
  error?: string
  /** Helper text to display below the input when no error */
  helperText?: string
  /** Whether the input should take full width @default true */
  fullWidth?: boolean
}

/**
 * A styled input component with label, error states, and helper text.
 * Uses forwardRef for proper form library integration (React Hook Form, etc.).
 * 
 * @component
 * @example
 * ```tsx
 * // Basic input with label
 * <Input 
 *   label="Email" 
 *   type="email" 
 *   placeholder="Enter your email"
 * />
 * 
 * // Input with error state
 * <Input 
 *   label="Password" 
 *   type="password"
 *   error="Password must be at least 8 characters"
 * />
 * 
 * // With React Hook Form
 * <Input 
 *   label="Username"
 *   {...register('username', { required: 'Username is required' })}
 *   error={errors.username?.message}
 * />
 * ```
 */
const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  fullWidth = true,
  className = '',
  disabled = false,
  ...props
}, ref) => {
  const getInputClasses = () => {
    const baseClasses = INPUT_STYLES.base
    const errorClasses = error ? INPUT_STYLES.error : ''
    const disabledClasses = disabled ? INPUT_STYLES.disabled : ''
    const widthClasses = fullWidth ? 'w-full' : ''
    
    return [baseClasses, errorClasses, disabledClasses, widthClasses, className]
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
      <input
        ref={ref}
        className={getInputClasses()}
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

Input.displayName = 'Input'

export default Input
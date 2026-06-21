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

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, fullWidth = true, className = '', disabled = false, ...props }, ref) => {
    const inputClasses = [
      'bg-field-bg border text-ink text-[13.5px] rounded-field px-3 py-2 transition-colors duration-150',
      'placeholder:text-faintest',
      'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
      error ? 'border-danger' : 'border-field-border',
      disabled ? 'opacity-50 cursor-not-allowed bg-panel-2' : '',
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
            {label}
            {props.required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <input ref={ref} className={inputClasses} disabled={disabled} {...props} />
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
        {helperText && !error && <p className="mt-1 text-[12px] text-muted">{helperText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input

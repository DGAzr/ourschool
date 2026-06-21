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
import { ButtonProps } from './Button.types'

const sizeClasses = {
  sm: 'px-3 py-1.5 text-[12px] gap-1.5',
  md: 'px-4 py-2 text-[13px] gap-2',
  lg: 'px-5 py-2.5 text-[14px] gap-2',
}

const variantClasses = {
  primary:
    'bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 border border-transparent',
  secondary:
    'bg-panel text-ink-2 border border-btn-border hover:bg-panel-2 hover:text-ink',
  danger:
    'bg-danger text-white border border-transparent hover:opacity-90',
  success:
    'bg-pos-fg text-white border border-transparent hover:opacity-90',
  outline:
    'bg-transparent text-accent border border-accent-line hover:bg-accent-soft',
}

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
  const classes = [
    'inline-flex items-center justify-center font-semibold rounded-field transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 select-none',
    variantClasses[variant] ?? variantClasses.primary,
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    disabled || loading ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && (
        <svg
          className="animate-spin h-3.5 w-3.5 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {!loading && icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  )
}

export default Button

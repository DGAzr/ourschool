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

/**
 * Color palette constants for consistent theming
 */

// Status colors
export const STATUS_COLORS = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900',
    border: 'border-green-200 dark:border-green-700',
    text: 'text-green-700 dark:text-green-200',
    button: 'bg-green-600 hover:bg-green-700'
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900',
    border: 'border-red-200 dark:border-red-700', 
    text: 'text-red-700 dark:text-red-200',
    button: 'bg-red-600 hover:bg-red-700'
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900',
    border: 'border-yellow-200 dark:border-yellow-700',
    text: 'text-yellow-700 dark:text-yellow-200',
    button: 'bg-yellow-600 hover:bg-yellow-700'
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900',
    border: 'border-blue-200 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700'
  }
} as const

// Assignment status colors
export const ASSIGNMENT_STATUS_COLORS = {
  not_started: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    border: 'border-gray-500',
    text: 'text-gray-600',
    checkbox: 'text-gray-600 focus:ring-gray-500'
  },
  in_progress: {
    bg: 'bg-blue-50 dark:bg-blue-900', 
    border: 'border-blue-500',
    text: 'text-blue-600',
    checkbox: 'text-blue-600 focus:ring-blue-500'
  },
  submitted: {
    bg: 'bg-yellow-50 dark:bg-yellow-900',
    border: 'border-yellow-500',
    text: 'text-yellow-600', 
    checkbox: 'text-yellow-600 focus:ring-yellow-500'
  },
  graded: {
    bg: 'bg-purple-50 dark:bg-purple-900',
    border: 'border-purple-500',
    text: 'text-purple-600',
    checkbox: 'text-purple-600 focus:ring-purple-500'
  },
  overdue: {
    bg: 'bg-red-50 dark:bg-red-900',
    border: 'border-red-500',
    text: 'text-red-600',
    checkbox: 'text-red-600 focus:ring-red-500'
  }
} as const

// Primary theme colors
export const THEME_COLORS = {
  primary: {
    50: 'bg-blue-50',
    100: 'bg-blue-100',
    500: 'bg-blue-500',
    600: 'bg-blue-600',
    700: 'bg-blue-700',
    800: 'bg-blue-800'
  },
  secondary: {
    50: 'bg-gray-50',
    100: 'bg-gray-100', 
    500: 'bg-gray-500',
    600: 'bg-gray-600',
    700: 'bg-gray-700',
    800: 'bg-gray-800'
  }
} as const

// Gradient backgrounds
export const GRADIENTS = {
  primary: 'bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800',
  success: 'bg-gradient-to-r from-green-600 to-green-700',
  warning: 'bg-gradient-to-r from-yellow-600 to-yellow-700',
  danger: 'bg-gradient-to-r from-red-600 to-red-700'
} as const
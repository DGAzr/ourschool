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
 * UI-related constants for consistent design patterns
 */

// Modal sizes
export const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg', 
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl'
} as const

// Card styling
export const CARD_STYLES = {
  base: 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700',
  header: 'px-6 py-4 border-b border-gray-200 dark:border-gray-700',
  content: 'p-6',
  footer: 'px-6 py-4 border-t border-gray-200 dark:border-gray-700'
} as const

// Button sizes
export const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base'
} as const

// Input styling
export const INPUT_STYLES = {
  base: 'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors',
  error: 'border-red-300 dark:border-red-600 focus:ring-red-500 focus:border-red-500',
  disabled: 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed opacity-50'
} as const

// Table styling
export const TABLE_STYLES = {
  container: 'overflow-x-auto shadow-sm rounded-lg',
  table: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700',
  header: 'bg-gray-50 dark:bg-gray-700',
  headerCell: 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider',
  body: 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700',
  row: 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
  cell: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100'
} as const

// Loading spinner
export const SPINNER_STYLES = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8', 
  lg: 'w-12 h-12',
  base: 'border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin'
} as const

// Layout spacing
export const LAYOUT_SPACING = {
  pageContainer: 'space-y-8',
  sectionGap: 'space-y-6',
  itemGap: 'space-y-4',
  compactGap: 'space-y-2'
} as const

// Responsive grid
export const GRID_LAYOUTS = {
  cards: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6',
  table: 'grid grid-cols-1 gap-4',
  form: 'grid grid-cols-1 md:grid-cols-2 gap-6'
} as const
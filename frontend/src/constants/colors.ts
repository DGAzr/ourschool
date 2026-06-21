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

export const STATUS_COLORS = {
  success: {
    bg: 'bg-pos-bg',
    border: 'border-pos-fg/30',
    text: 'text-pos-fg',
    button: 'bg-pos-fg hover:opacity-90'
  },
  error: {
    bg: 'bg-neg-bg',
    border: 'border-neg-fg/30',
    text: 'text-neg-fg',
    button: 'bg-danger hover:opacity-90'
  },
  warning: {
    bg: 'bg-sub-bg',
    border: 'border-sub-fg/30',
    text: 'text-sub-fg',
    button: 'bg-sub-fg hover:opacity-90'
  },
  info: {
    bg: 'bg-info-bg',
    border: 'border-info-fg/30',
    text: 'text-info-fg',
    button: 'bg-btn-primary-bg hover:opacity-90'
  }
} as const

export const ASSIGNMENT_STATUS_COLORS = {
  not_started: {
    bg: 'bg-ns-bg',
    border: 'border-ns-fg/30',
    text: 'text-ns-fg',
    checkbox: 'text-ns-fg focus:ring-muted'
  },
  in_progress: {
    bg: 'bg-info-bg',
    border: 'border-info-fg/30',
    text: 'text-info-fg',
    checkbox: 'text-info-fg focus:ring-info-fg'
  },
  submitted: {
    bg: 'bg-sub-bg',
    border: 'border-sub-fg/30',
    text: 'text-sub-fg',
    checkbox: 'text-sub-fg focus:ring-sub-fg'
  },
  graded: {
    bg: 'bg-pos-bg',
    border: 'border-pos-fg/30',
    text: 'text-pos-fg',
    checkbox: 'text-pos-fg focus:ring-pos-fg'
  },
  overdue: {
    bg: 'bg-neg-bg',
    border: 'border-neg-fg/30',
    text: 'text-neg-fg',
    checkbox: 'text-neg-fg focus:ring-neg-fg'
  }
} as const

export const THEME_COLORS = {
  primary: {
    50: 'bg-accent-soft',
    100: 'bg-accent-soft',
    500: 'bg-accent',
    600: 'bg-accent',
    700: 'bg-accent',
    800: 'bg-btn-primary-bg'
  },
  secondary: {
    50: 'bg-panel-2',
    100: 'bg-track',
    500: 'bg-muted',
    600: 'bg-ink-2',
    700: 'bg-ink-2',
    800: 'bg-ink'
  }
} as const

export const GRADIENTS = {
  primary: 'bg-btn-primary-bg',
  success: 'bg-pos-fg',
  warning: 'bg-sub-fg',
  danger: 'bg-danger'
} as const

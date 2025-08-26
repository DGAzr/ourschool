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

import { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Available button visual variants
 * - `primary`: Main action button with blue background
 * - `secondary`: Secondary action with gray background  
 * - `danger`: Destructive action with red background
 * - `success`: Positive action with green background
 * - `outline`: Transparent background with colored border
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline'

/**
 * Available button sizes
 * - `sm`: Small button for compact layouts
 * - `md`: Medium button for general use (default)
 * - `lg`: Large button for prominent actions
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * Props for the Button component
 * Extends all standard HTML button attributes
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant of the button @default 'primary' */
  variant?: ButtonVariant
  /** Size of the button @default 'md' */
  size?: ButtonSize
  /** Content to display inside the button */
  children: ReactNode
  /** Show loading spinner and disable interaction @default false */
  loading?: boolean
  /** Disable button interaction @default false */
  disabled?: boolean
  /** Make button take full width of container @default false */
  fullWidth?: boolean
  /** Icon to display before the button text */
  icon?: ReactNode
}
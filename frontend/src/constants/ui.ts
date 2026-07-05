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

export const INPUT_STYLES = {
  base: 'w-full bg-field-bg border border-field-border text-ink text-[13.5px] rounded-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors placeholder:text-faintest',
  error: 'border-danger focus:ring-danger/30 focus:border-danger',
  disabled: 'opacity-50 cursor-not-allowed bg-panel-2'
} as const

export const SPINNER_STYLES = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  base: 'border-2 border-line border-t-accent rounded-full animate-spin'
} as const

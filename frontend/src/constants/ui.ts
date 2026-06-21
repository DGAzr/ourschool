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

export const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl'
} as const

export const CARD_STYLES = {
  base: 'bg-panel border border-line rounded-card shadow-card',
  header: 'px-5 py-4 border-b border-line',
  content: 'p-5',
  footer: 'px-5 py-4 border-t border-line'
} as const

export const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-4 py-2 text-[13px]',
  lg: 'px-5 py-2.5 text-[14px]'
} as const

export const INPUT_STYLES = {
  base: 'w-full bg-field-bg border border-field-border text-ink text-[13.5px] rounded-field px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors placeholder:text-faintest',
  error: 'border-danger focus:ring-danger/30 focus:border-danger',
  disabled: 'opacity-50 cursor-not-allowed bg-panel-2'
} as const

export const TABLE_STYLES = {
  container: 'overflow-x-auto rounded-card border border-line',
  table: 'min-w-full divide-y divide-line',
  header: 'bg-panel-2',
  headerCell: 'px-5 py-3 text-left text-[11px] font-semibold text-faint uppercase tracking-[.06em]',
  body: 'bg-panel divide-y divide-line-2',
  row: 'hover:bg-panel-2 transition-colors duration-100',
  cell: 'px-5 py-3.5 text-[13.5px] text-ink whitespace-nowrap'
} as const

export const SPINNER_STYLES = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  base: 'border-2 border-line border-t-accent rounded-full animate-spin'
} as const

export const LAYOUT_SPACING = {
  pageContainer: 'space-y-6',
  sectionGap: 'space-y-5',
  itemGap: 'space-y-4',
  compactGap: 'space-y-2'
} as const

export const GRID_LAYOUTS = {
  cards: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4',
  table: 'grid grid-cols-1 gap-4',
  form: 'grid grid-cols-1 md:grid-cols-2 gap-5'
} as const

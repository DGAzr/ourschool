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

import type { RedemptionStatus } from '../../types/shop'

export interface StatusStyle {
  /** Admin-facing label. */
  label: string
  /** Student-facing label (differs for pending). */
  studentLabel: string
  fg: string
  bg: string
}

/**
 * Redemption status → pill styling. A plain data map (not the shared
 * `pillVariants`) because shop statuses need the `--neutral`/`--info` colors
 * that don't all map to existing pill variants.
 */
export const STATUS_STYLES: Record<RedemptionStatus, StatusStyle> = {
  redeemed: {
    label: 'Redeemed',
    studentLabel: 'Redeemed',
    fg: 'var(--pos)',
    bg: 'var(--pos-soft)',
  },
  pending: {
    label: 'Pending',
    studentLabel: 'Awaiting approval',
    fg: 'var(--neutral)',
    bg: 'var(--neutral-soft)',
  },
  ready: {
    label: 'Ready for pickup',
    studentLabel: 'Ready for pickup',
    fg: 'var(--accent)',
    bg: 'var(--accent-soft)',
  },
  fulfilled: {
    label: 'Fulfilled',
    studentLabel: 'Fulfilled',
    fg: 'var(--muted)',
    bg: 'var(--track)',
  },
  declined: {
    label: 'Declined',
    studentLabel: 'Declined',
    fg: 'var(--neg)',
    bg: 'var(--neg-soft)',
  },
}

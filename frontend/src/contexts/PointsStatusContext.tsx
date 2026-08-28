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

import { createContext, useContext } from 'react'

export interface PointsStatusContextType {
  /** Whether the points system (and therefore the shop) is enabled. */
  enabled: boolean
  /** True once the first status fetch has settled — gate UI on this to avoid flicker. */
  ready: boolean
  /** A user-facing message when the latest status check failed. */
  error: string | null
  /** Bumped whenever a redemption (or other spend) changes a balance. */
  balanceVersion: number
  /** Tell balance widgets to refetch (call after a successful redemption). */
  notifyBalanceChanged: () => void
  /** Re-fetch the status (call after toggling it in Settings). */
  refresh: () => Promise<void>
}

/** Raw context — consumed by PointsStatusProvider; use usePointsStatus() elsewhere. */
export const PointsStatusContext = createContext<
  PointsStatusContextType | undefined
>(undefined)

export const usePointsStatus = (): PointsStatusContextType => {
  const context = useContext(PointsStatusContext)
  if (context === undefined) {
    throw new Error('usePointsStatus must be used within a PointsStatusProvider')
  }
  return context
}

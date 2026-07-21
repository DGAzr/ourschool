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

import { PaperlessStatus } from '../types/paperless'

export interface PaperlessStatusContextType {
  /** Last fetched status; null before the first fetch or for non-admins. */
  status: PaperlessStatus | null
  /** Whether the integration is connected (false until ready). */
  connected: boolean
  /** True once the first status fetch has settled — gate UI on this to avoid flicker. */
  ready: boolean
  /** Human-readable fetch error, if the last fetch failed. */
  error: string | null
  /** Re-fetch the status from the server. */
  refresh: () => Promise<void>
  /** Replace the shared status directly (optimistic updates / mutation results). */
  applyStatus: (next: PaperlessStatus | null) => void
}

/** Raw context — consumed by PaperlessStatusProvider; use the hooks elsewhere. */
export const PaperlessStatusContext = createContext<
  PaperlessStatusContextType | undefined
>(undefined)

export const usePaperlessStatusContext = (): PaperlessStatusContextType => {
  const context = useContext(PaperlessStatusContext)
  if (context === undefined) {
    throw new Error(
      'usePaperlessStatusContext must be used within a PaperlessStatusProvider'
    )
  }
  return context
}

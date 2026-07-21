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

import type { ShopItem } from '../../types/shop'

/** Affordability + progress derivation for a single item at a given balance. */
export interface Affordability {
  affordable: boolean
  remaining: number
  /** Progress toward the cost, 0–100. */
  pct: number
  /** True when locked and within 25% of affording it (the "almost there" nudge). */
  nearlyThere: boolean
}

export function affordabilityOf(cost: number, balance: number): Affordability {
  const affordable = balance >= cost
  const remaining = Math.max(0, cost - balance)
  const pct = cost > 0 ? Math.min(100, (balance / cost) * 100) : 100
  const nearlyThere = !affordable && cost > 0 && remaining <= cost * 0.25
  return { affordable, remaining, pct, nearlyThere }
}

/** Compact "how long ago" label for a redemption timestamp. */
export function relativeWhen(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  const diff = now.getTime() - then
  const day = 86400000
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < day) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** Active locked items (cost > balance), cheapest first. */
export function lockedItems(items: ShopItem[], balance: number): ShopItem[] {
  return items
    .filter((i) => i.is_active && i.cost_points > balance)
    .sort((a, b) => a.cost_points - b.cost_points)
}

/**
 * The goal item: the chosen locked item if it's still locked, otherwise the
 * cheapest locked item. Null when nothing is locked (afford everything).
 */
export function goalItem(
  locked: ShopItem[],
  chosenId: number | null
): ShopItem | null {
  if (locked.length === 0) return null
  return locked.find((i) => i.id === chosenId) ?? locked[0]
}

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

import { describe, expect, it } from 'vitest'

import type { ShopItem } from '../../types/shop'
import { affordabilityOf, goalItem, lockedItems, relativeWhen } from './shopLogic'
import { STATUS_STYLES } from './statusStyles'

const item = (id: number, cost: number, active = true): ShopItem => ({
  id,
  external_id: `x${id}`,
  name: `Item ${id}`,
  category_id: 1,
  description: null,
  cost_points: cost,
  quantity_available: null,
  fulfillment_type: 'instant',
  is_active: active,
  image_ids: [],
  total_redeemed: 0,
  display_order: 0,
  created_at: '2026-07-07T00:00:00Z',
  updated_at: '2026-07-07T00:00:00Z',
  category: null,
})

describe('affordabilityOf', () => {
  it('marks an item affordable when balance covers the cost', () => {
    const a = affordabilityOf(50, 100)
    expect(a.affordable).toBe(true)
    expect(a.remaining).toBe(0)
    expect(a.pct).toBe(100)
    expect(a.nearlyThere).toBe(false)
  })

  it('computes remaining and progress for a locked item', () => {
    const a = affordabilityOf(100, 40)
    expect(a.affordable).toBe(false)
    expect(a.remaining).toBe(60)
    expect(a.pct).toBe(40)
  })

  it('flags "almost there" only within 25% of the cost', () => {
    // 80/100 → 20 remaining = 20% of cost → nudge on.
    expect(affordabilityOf(100, 80).nearlyThere).toBe(true)
    // exactly 25% remaining → still on (<=).
    expect(affordabilityOf(100, 75).nearlyThere).toBe(true)
    // 26% remaining → off.
    expect(affordabilityOf(100, 74).nearlyThere).toBe(false)
    // affordable → never a nudge.
    expect(affordabilityOf(100, 100).nearlyThere).toBe(false)
  })

  it('treats a free item (cost 0) as fully affordable', () => {
    const a = affordabilityOf(0, 0)
    expect(a.affordable).toBe(true)
    expect(a.pct).toBe(100)
  })
})

describe('lockedItems', () => {
  it('returns only active, unaffordable items, cheapest first', () => {
    const items = [
      item(1, 30), // affordable at balance 50
      item(2, 90),
      item(3, 60),
      item(4, 200, false), // inactive — excluded even though locked
    ]
    const locked = lockedItems(items, 50)
    expect(locked.map((i) => i.id)).toEqual([3, 2])
  })

  it('returns nothing when the student can afford everything', () => {
    expect(lockedItems([item(1, 10), item(2, 20)], 100)).toEqual([])
  })
})

describe('goalItem', () => {
  it('keeps the chosen item while it is still locked', () => {
    const locked = [item(3, 60), item(2, 90)]
    expect(goalItem(locked, 2)?.id).toBe(2)
  })

  it('falls back to the cheapest locked item when the choice is gone', () => {
    const locked = [item(3, 60), item(2, 90)]
    expect(goalItem(locked, 999)?.id).toBe(3)
  })

  it('is null when nothing is locked', () => {
    expect(goalItem([], null)).toBeNull()
  })

  it('honors an explicitly chosen goal over the cheapest', () => {
    const locked = [item(3, 60), item(2, 90), item(5, 120)]
    // Student picked item 5 even though 3 is cheapest.
    expect(goalItem(locked, 5)?.id).toBe(5)
  })
})

describe('STATUS_STYLES', () => {
  it('covers every redemption status with distinct student/admin labels where expected', () => {
    expect(Object.keys(STATUS_STYLES).sort()).toEqual([
      'declined',
      'fulfilled',
      'pending',
      'ready',
      'redeemed',
    ])
    // pending differs between admin and student wording.
    expect(STATUS_STYLES.pending.label).toBe('Pending')
    expect(STATUS_STYLES.pending.studentLabel).toBe('Awaiting approval')
    // every entry has fg + bg tokens.
    for (const style of Object.values(STATUS_STYLES)) {
      expect(style.fg).toMatch(/^var\(--/)
      expect(style.bg).toMatch(/^var\(--/)
    }
  })
})

describe('relativeWhen', () => {
  const now = new Date('2026-07-08T12:00:00Z')
  const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString()

  it('renders each age bracket', () => {
    expect(relativeWhen(at(30_000), now)).toBe('just now')
    expect(relativeWhen(at(5 * 60_000), now)).toBe('5m ago')
    expect(relativeWhen(at(3 * 3_600_000), now)).toBe('3h ago')
    expect(relativeWhen(at(2 * 86_400_000), now)).toBe('2d ago')
  })

  it('falls back to a short date after a week', () => {
    expect(relativeWhen(at(10 * 86_400_000), now)).toMatch(/Jun/)
  })
})

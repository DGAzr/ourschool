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

import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ItemCard } from './ItemCard'
import type { ShopItem } from '../../types/shop'

const makeItem = (overrides: Partial<ShopItem> = {}): ShopItem => ({
  id: 1,
  external_id: 'x1',
  name: 'Extra screen time',
  category_id: 1,
  description: 'Thirty bonus minutes',
  cost_points: 100,
  quantity_available: null,
  fulfillment_type: 'instant',
  is_active: true,
  image_ids: [],
  total_redeemed: 0,
  display_order: 0,
  created_at: '2026-07-07T00:00:00Z',
  updated_at: '2026-07-07T00:00:00Z',
  category: { id: 1, external_id: 'c1', name: 'Privileges', color: '#4F7CAC', icon: '🎟', sort_order: 0, created_at: '2026-07-07T00:00:00Z' },
  ...overrides,
})

describe('ItemCard', () => {
  it('shows a Redeem button when affordable and fires onRedeem', () => {
    const onRedeem = vi.fn()
    render(<ItemCard item={makeItem()} balance={150} onRedeem={onRedeem} />)

    const button = screen.getByRole('button', { name: 'Redeem' })
    fireEvent.click(button)
    expect(onRedeem).toHaveBeenCalledOnce()
    expect(screen.queryByText(/to go/)).toBeNull()
  })

  it('shows "◆ n to go" and no Redeem button when locked', () => {
    render(<ItemCard item={makeItem({ cost_points: 100 })} balance={40} />)

    expect(screen.getByText(/60 to go/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Redeem' })).toBeNull()
  })

  it('shows the "almost there" nudge within 25% of the cost', () => {
    render(<ItemCard item={makeItem({ cost_points: 100 })} balance={80} />)
    expect(screen.getByText(/Almost there/)).toBeInTheDocument()
  })

  it('omits the nudge when more than 25% remains', () => {
    render(<ItemCard item={makeItem({ cost_points: 100 })} balance={50} />)
    expect(screen.queryByText(/Almost there/)).toBeNull()
  })

  it('flags an instant item and low stock', () => {
    render(
      <ItemCard
        item={makeItem({ quantity_available: 2, fulfillment_type: 'instant' })}
        balance={150}
      />
    )
    expect(screen.getByText('Instant')).toBeInTheDocument()
    expect(screen.getByText('2 left')).toBeInTheDocument()
  })
})

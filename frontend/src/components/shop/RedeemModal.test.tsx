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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { RedeemModal } from './RedeemModal'
import type { RedeemResponse, ShopItem } from '../../types/shop'
import { shopApi } from '../../services/shop'

vi.mock('../../services/shop', () => ({
  shopApi: {
    redeem: vi.fn(),
  },
}))

const item: ShopItem = {
  id: 7,
  external_id: 'x7',
  name: 'Movie night',
  category_id: 1,
  description: 'Pick the family movie',
  cost_points: 60,
  quantity_available: null,
  fulfillment_type: 'instant',
  is_active: true,
  image_ids: [],
  total_redeemed: 0,
  display_order: 0,
  created_at: '2026-07-07T00:00:00Z',
  updated_at: '2026-07-07T00:00:00Z',
  category: { id: 1, external_id: 'c1', name: 'Experiences', color: '#9A8A4F', icon: '🎢', sort_order: 0, created_at: '2026-07-07T00:00:00Z' },
}

afterEach(() => vi.clearAllMocks())

describe('RedeemModal', () => {
  it('renders the ask state with a receipt and confirm CTA', () => {
    render(
      <RedeemModal
        item={item}
        balance={100}
        onClose={() => {}}
        onRedeemed={() => {}}
        onViewRedemptions={() => {}}
      />
    )
    expect(screen.getByText('Movie night')).toBeInTheDocument()
    expect(screen.getByText(/Your balance/)).toBeInTheDocument()
    // Instant item → "Redeem now".
    expect(screen.getByRole('button', { name: 'Redeem now' })).toBeInTheDocument()
  })

  it('confirms, calls the API, and shows the done state', async () => {
    const result = {
      redemption: { item_id: 7, status: 'redeemed' },
      student_points: { current_balance: 40 },
    }
    vi.mocked(shopApi.redeem).mockResolvedValueOnce(result as never)

    // Like the real parent, update the balance prop as soon as onRedeemed
    // fires — the done state must still show the API balance, not re-deduct.
    const onRedeemed = vi.fn((r: RedeemResponse) => {
      view.rerender(
        <RedeemModal
          item={item}
          balance={r.student_points.current_balance}
          onClose={() => {}}
          onRedeemed={onRedeemed}
          onViewRedemptions={() => {}}
        />
      )
    })
    const view = render(
      <RedeemModal
        item={item}
        balance={100}
        onClose={() => {}}
        onRedeemed={onRedeemed}
        onViewRedemptions={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Redeem now' }))

    await waitFor(() =>
      expect(screen.getByText('Redeemed!')).toBeInTheDocument()
    )
    expect(shopApi.redeem).toHaveBeenCalledWith(7)
    expect(onRedeemed).toHaveBeenCalledWith(result)
    expect(
      screen.getByText(/Your new balance is ◆ 40\./)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View redemption' })
    ).toBeInTheDocument()
  })

  it('uses request wording for request-type items', () => {
    render(
      <RedeemModal
        item={{ ...item, fulfillment_type: 'request' }}
        balance={100}
        onClose={() => {}}
        onRedeemed={() => {}}
        onViewRedemptions={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })
})

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

import React from 'react'
import { ArrowLeft, Zap, Package } from 'lucide-react'
import type { ShopItem } from '../../types/shop'
import { shopApi } from '../../services/shop'
import { CategoryBadge, CategoryTile } from './categoryVisual'
import { affordabilityOf } from './shopLogic'

interface ItemDetailProps {
  item: ShopItem
  balance: number
  /** True when this item is already the student's chosen goal. */
  isGoal: boolean
  onBack: () => void
  onRedeem: (item: ShopItem) => void
  onSetGoal: (itemId: number) => void
}

export const ItemDetail: React.FC<ItemDetailProps> = ({
  item,
  balance,
  isGoal,
  onBack,
  onRedeem,
  onSetGoal,
}) => {
  const cost = item.cost_points
  const { affordable, remaining, pct } = affordabilityOf(cost, balance)
  const balanceAfter = balance - cost
  const isInstant = item.fulfillment_type === 'instant'

  const coverId = item.image_ids?.[0]
  const coverUrl = coverId ? shopApi.imageUrl(coverId) : null

  const soldOut =
    item.quantity_available !== null && item.quantity_available <= 0
  const availabilityLabel =
    item.quantity_available === null
      ? 'Always available'
      : soldOut
        ? 'Sold out'
        : `${item.quantity_available} available`
  const availabilityNeg =
    soldOut || (item.quantity_available !== null && item.quantity_available <= 3)

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-field border text-[13px] text-ink-2 hover:bg-panel-2 transition-colors mb-5"
        style={{ borderColor: 'var(--btn-border)' }}
      >
        <ArrowLeft size={14} /> Back to shop
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">
        {/* Left: big tile */}
        <div className="border border-line rounded-card-lg overflow-hidden">
          <CategoryTile
            category={item.category}
            imageUrl={coverUrl}
            height={300}
            iconSize={88}
          />
        </div>

        {/* Right */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <CategoryBadge category={item.category} />
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-[11px] font-semibold"
              style={
                isInstant
                  ? { background: 'var(--pos-soft)', color: 'var(--pos)' }
                  : { background: 'var(--info-soft)', color: 'var(--info)' }
              }
            >
              {isInstant ? (
                <>
                  <Zap size={11} /> Instant reward
                </>
              ) : (
                <>
                  <Package size={11} /> Pickup with admin
                </>
              )}
            </span>
          </div>

          <h2 className="text-[22px] font-bold text-ink tracking-[-0.01em]">
            {item.name}
          </h2>
          {item.description && (
            <p className="mt-2 text-[14px] text-ink-2 leading-[1.6]">
              {item.description}
            </p>
          )}

          {/* Stat strip */}
          <div
            className="mt-5 py-4 flex items-center gap-6 border-t border-b"
            style={{ borderColor: 'var(--line-2)' }}
          >
            <div>
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">
                Cost
              </p>
              <span className="inline-flex items-baseline gap-1">
                <span style={{ color: 'var(--accent)' }} aria-hidden>◆</span>
                <span className="font-mono text-[24px] font-semibold text-ink">
                  {cost.toLocaleString()}
                </span>
              </span>
            </div>
            <div className="w-px h-9" style={{ background: 'var(--line-2)' }} />
            <div>
              <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">
                Availability
              </p>
              <p
                className="text-[15px] font-semibold"
                style={{ color: availabilityNeg ? 'var(--neg)' : 'var(--ink)' }}
              >
                {availabilityLabel}
              </p>
            </div>
          </div>

          {/* CTA */}
          {affordable && !soldOut ? (
            <div className="mt-5">
              <button
                onClick={() => onRedeem(item)}
                className="w-full h-[46px] rounded-field text-white text-[15px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                Redeem for ◆ {cost.toLocaleString()}
              </button>
              <p className="mt-2 text-center text-[12px] text-muted">
                You'll have{' '}
                <span className="font-semibold text-ink">
                  ◆ {balanceAfter.toLocaleString()}
                </span>{' '}
                left afterward
              </p>
            </div>
          ) : soldOut ? (
            <div
              className="mt-5 rounded-card p-4 text-center text-[13px] font-medium"
              style={{ background: 'var(--neg-soft)', color: 'var(--neg)' }}
            >
              This item is sold out right now.
            </div>
          ) : (
            <div
              className="mt-5 rounded-card p-4 border"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--accent-line)',
              }}
            >
              <p className="text-[13px] font-semibold text-ink">
                Earn ◆ {remaining.toLocaleString()} more to unlock this
                <span className="text-muted font-normal">
                  {' '}
                  ({Math.round(pct)}%)
                </span>
              </p>
              <div
                className="mt-2.5 h-2 rounded-pill overflow-hidden"
                style={{ background: 'var(--track)' }}
              >
                <div
                  className="h-full"
                  style={{ width: `${pct}%`, background: 'var(--accent)' }}
                />
              </div>
              <p className="mt-2 text-[12px] text-muted">
                Keep completing assignments to earn more points!
              </p>
              <button
                onClick={() => onSetGoal(item.id)}
                disabled={isGoal}
                className="mt-3 w-full h-9 rounded-field border text-[13px] font-medium text-ink-2 hover:bg-panel-2 transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
                style={{ borderColor: 'var(--btn-border)' }}
              >
                {isGoal ? '★ Your current goal' : 'Set as my goal'}
              </button>
            </div>
          )}

          {/* Fulfillment info box */}
          <div
            className="mt-4 rounded-card p-3.5 text-[12.5px] text-muted leading-relaxed"
            style={{ background: 'var(--panel-2)' }}
          >
            {isInstant
              ? 'Instant reward: your points are deducted and it’s yours right away.'
              : 'Pickup with admin: your points are held and a request goes to your admin, who’ll approve it and hand it off.'}
          </div>
        </div>
      </div>
    </div>
  )
}

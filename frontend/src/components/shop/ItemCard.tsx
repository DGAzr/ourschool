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
import { Zap } from 'lucide-react'
import type { ShopItem } from '../../types/shop'
import { shopApi } from '../../services/shop'
import { CategoryBadge, CategoryTile } from './categoryVisual'
import { affordabilityOf } from './shopLogic'

interface ItemCardProps {
  item: ShopItem
  balance: number
  /** Open the item detail view. */
  onOpen?: (item: ShopItem) => void
  /** Trigger the redeem confirm flow. */
  onRedeem?: (item: ShopItem) => void
  /** Non-interactive render for the admin editor's Student Preview. */
  preview?: boolean
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  balance,
  onOpen,
  onRedeem,
  preview = false,
}) => {
  const cost = item.cost_points
  const { affordable, remaining, pct, nearlyThere } = affordabilityOf(cost, balance)

  const coverId = item.image_ids?.[0]
  const coverUrl = coverId ? shopApi.imageUrl(coverId) : null

  const soldOut =
    item.quantity_available !== null && item.quantity_available <= 0
  const lowStock =
    item.quantity_available !== null &&
    item.quantity_available > 0 &&
    item.quantity_available <= 3

  const openDetail = () => {
    if (!preview) onOpen?.(item)
  }

  return (
    <div
      className="bg-panel border border-line rounded-[14px] overflow-hidden flex flex-col"
      style={
        preview
          ? undefined
          : { transition: 'transform .12s, box-shadow .12s' }
      }
      onMouseEnter={
        preview
          ? undefined
          : (e) => {
              e.currentTarget.style.transform = 'translateY(-3px)'
              e.currentTarget.style.boxShadow = '0 10px 26px var(--shadow)'
            }
      }
      onMouseLeave={
        preview
          ? undefined
          : (e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = ''
            }
      }
    >
      {/* Tile */}
      <div className="relative">
        <button
          type="button"
          onClick={openDetail}
          className={`block w-full ${preview ? 'cursor-default' : ''}`}
          disabled={preview}
        >
          <CategoryTile category={item.category} imageUrl={coverUrl} height={130} />
        </button>
        {(soldOut || lowStock) && (
          <span
            className="absolute top-2 right-2 px-2 py-0.5 rounded-pill text-[11px] font-semibold"
            style={{ background: 'var(--neg-soft)', color: 'var(--neg)' }}
          >
            {soldOut ? 'Sold out' : `${item.quantity_available} left`}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-[13px_14px_14px] flex flex-col gap-2 flex-1" style={{ padding: '13px 14px 14px' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={item.category} />
          {item.fulfillment_type === 'instant' && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: 'var(--pos)' }}
            >
              <Zap size={11} /> Instant
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={openDetail}
          disabled={preview}
          className={`text-left text-[14.5px] font-semibold text-ink ${preview ? 'cursor-default' : 'hover:text-accent'} transition-colors`}
        >
          {item.name || 'Untitled item'}
        </button>

        {item.description && (
          <p className="text-[12px] text-muted line-clamp-2">{item.description}</p>
        )}

        {/* Footer */}
        <div className="mt-auto pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-baseline gap-1">
              <span style={{ color: 'var(--accent)', fontSize: 13 }} aria-hidden>◆</span>
              <span
                className="font-mono"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: affordable ? 'var(--ink)' : 'var(--muted)',
                }}
              >
                {cost.toLocaleString()}
              </span>
            </span>

            {affordable ? (
              <button
                type="button"
                onClick={() => !preview && onRedeem?.(item)}
                disabled={preview || soldOut}
                className="h-8 px-3.5 rounded-field text-white text-[13px] font-medium transition-opacity disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                Redeem
              </button>
            ) : (
              <span
                className="text-[12px] font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                <span aria-hidden>◆</span> {remaining.toLocaleString()} to go
              </span>
            )}
          </div>

          {/* Locked progress bar + nudge */}
          {!affordable && (
            <>
              <div
                className="mt-2 h-[5px] rounded-pill overflow-hidden"
                style={{ background: 'var(--track)' }}
              >
                <div
                  className="h-full"
                  style={{ width: `${pct}%`, background: 'var(--accent)' }}
                />
              </div>
              {nearlyThere && (
                <p
                  className="mt-1.5 text-[11px] font-semibold"
                  style={{ color: 'var(--gold)' }}
                >
                  ✨ Almost there — keep it up!
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

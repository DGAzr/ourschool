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
import { EmptyState } from '../ui'
import { ShoppingBag } from 'lucide-react'
import type { ShopRedemption } from '../../types/shop'
import { RedemptionStatusPill } from './statusPill'
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  tint,
} from './categoryTint'
import { relativeWhen } from './shopLogic'

interface MyRedemptionsProps {
  redemptions: ShopRedemption[]
  showPoints?: boolean
  totalSpent: number
}

export const MyRedemptions: React.FC<MyRedemptionsProps> = ({
  redemptions,
  totalSpent,
  showPoints=true,
}) => (
  <div className="bg-panel border border-line rounded-[14px] overflow-hidden">
    <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-line">
      <p className="text-[14px] font-semibold text-ink">My redemptions</p>
      <span hidden={!showPoints} className="text-[12px] text-muted">
        <span style={{ color: 'var(--accent)' }} aria-hidden>◆</span>{' '}
        {totalSpent.toLocaleString()} spent all-time
      </span>
    </div>

    {redemptions.length === 0 ? (
      <EmptyState
        icon={ShoppingBag}
        title="Nothing redeemed yet"
        subtext="Browse the shop and redeem your first reward!"
      />
    ) : (
      <div>
        {redemptions.map((r) => {
          const color = r.item?.category?.color || DEFAULT_CATEGORY_COLOR
          const icon = r.item?.category?.icon || DEFAULT_CATEGORY_ICON
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 px-[18px] py-3.5 border-t first:border-t-0"
              style={{ borderColor: 'var(--line-2)' }}
            >
              <div
                className="w-[42px] h-[42px] rounded-field flex items-center justify-center flex-shrink-0 text-[19px]"
                style={{ background: tint(color) }}
                aria-hidden
              >
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink truncate">
                  {r.item_name}
                </p>
                <p className="text-[12px] text-muted">
                  {relativeWhen(r.created_at)} ·{' '}
                  <span aria-hidden>◆</span> {r.cost_points.toLocaleString()}
                </p>
              </div>
              <RedemptionStatusPill status={r.status} student />
              <div className="w-full text-sm text-ink-2 pl-0 sm:pl-[54px]">
                <p>{r.status==='pending'?'Requested → waiting for teacher approval. Your points are held and already deducted.':r.status==='ready'?'Requested → Approved · Ready for pickup':r.status==='fulfilled'?'Requested → Approved → Fulfilled':r.status==='declined'?'Request declined': 'Reward redeemed'}</p>
                {r.status==='ready'&&<p className="font-semibold mt-1">{r.pickup_instructions||'Ask your teacher how to collect this reward.'}</p>}
                {r.status==='declined'&&<p className="mt-1">{r.points_refunded ? `${r.cost_points.toLocaleString()} points were returned to your balance.` : 'Ask your teacher to check the refund for this older request.'}</p>}
                {r.fulfilled_at&&<p className="text-muted">Collected {new Date(r.fulfilled_at).toLocaleDateString()}</p>}
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
)

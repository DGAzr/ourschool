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
import { ChevronDown } from 'lucide-react'
import type { ShopItem } from '../../types/shop'
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  tint,
} from './categoryTint'
import { affordabilityOf } from './shopLogic'

interface GoalCardProps {
  goal: ShopItem
  balance: number
  /** Locked items the student can choose between (cheapest first). */
  lockedItems: ShopItem[]
  /** Persist the chosen goal item. */
  onSelect: (itemId: number) => void
}

/**
 * "Saving toward" card: a category-tinted icon, the goal item name, a shimmering
 * accent→gold progress bar, and a "◆ n to go" / "Unlocked!" footer. The student
 * explicitly picks which locked item to save toward via the dropdown.
 */
export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  balance,
  lockedItems,
  onSelect,
}) => {
  const {
    remaining,
    pct,
    affordable: unlocked,
  } = affordabilityOf(goal.cost_points, balance)
  const color = goal.category?.color || DEFAULT_CATEGORY_COLOR

  return (
    <div
      className="rounded-card-lg bg-panel border p-[18px_20px]"
      style={{ borderColor: 'var(--accent-line)', padding: '18px 20px' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-field flex items-center justify-center flex-shrink-0 text-[18px]"
            style={{ background: tint(color) }}
            aria-hidden
          >
            {goal.category?.icon || DEFAULT_CATEGORY_ICON}
          </div>
          <div className="min-w-0">
            <p
              className="text-[10.5px] font-semibold uppercase"
              style={{ color: 'var(--accent)', letterSpacing: '.04em' }}
            >
              Saving toward
            </p>
            <p className="text-[14px] font-semibold text-ink truncate">{goal.name}</p>
          </div>
        </div>
        {lockedItems.length > 1 && (
          <div className="relative flex-shrink-0">
            <select
              value={goal.id}
              onChange={(e) => onSelect(Number(e.target.value))}
              aria-label="Choose the reward you're saving toward"
              className="appearance-none h-7 pl-2.5 pr-7 rounded-pill border text-[12px] text-ink-2 bg-panel hover:bg-panel-2 transition-colors cursor-pointer max-w-[160px] truncate"
              style={{ borderColor: 'var(--btn-border)' }}
            >
              {lockedItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — ◆ {item.cost_points.toLocaleString()}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="mt-3.5 h-3 rounded-pill overflow-hidden"
        style={{ background: 'var(--track)' }}
      >
        <div
          className="h-full animate-shimmer"
          style={{
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, var(--accent), var(--gold), var(--accent))',
            backgroundSize: '200% 100%',
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className="text-muted font-mono">
          {balance.toLocaleString()} of {goal.cost_points.toLocaleString()}
        </span>
        <span style={{ color: 'var(--accent)' }} className="font-semibold">
          {unlocked ? (
            'Unlocked! 🎉'
          ) : (
            <>
              <span aria-hidden>◆</span> {remaining.toLocaleString()} to go
            </>
          )}
        </span>
      </div>
    </div>
  )
}

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
import { StatTile } from '../../ui'
import type { ShopAdminOverview, StudentGoalSummary } from '../../../types/shop'
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  tint,
} from '../categoryTint'
import { affordabilityOf } from '../shopLogic'

interface AdminShopStatsProps {
  overview: ShopAdminOverview
}

const GoalRow: React.FC<{ goal: StudentGoalSummary }> = ({ goal }) => {
  const color = goal.category_color || DEFAULT_CATEGORY_COLOR
  const { pct, affordable: unlocked } = affordabilityOf(
    goal.cost_points,
    goal.current_balance
  )

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-field flex items-center justify-center flex-shrink-0 text-[15px]"
        style={{ background: tint(color) }}
        aria-hidden
      >
        {goal.category_icon || DEFAULT_CATEGORY_ICON}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-ink truncate">
            <span className="font-semibold">{goal.student_name}</span>
            <span className="text-muted"> → {goal.item_name}</span>
          </p>
          <span
            className="text-[12px] font-semibold font-mono flex-shrink-0"
            style={{ color: 'var(--accent)' }}
          >
            {unlocked ? 'Unlocked! 🎉' : `◆ ${goal.remaining.toLocaleString()} to go`}
          </span>
        </div>
        <div
          className="mt-1.5 h-2 rounded-pill overflow-hidden"
          style={{ background: 'var(--track)' }}
        >
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background:
                'linear-gradient(90deg, var(--accent), var(--gold), var(--accent))',
            }}
          />
        </div>
      </div>
    </div>
  )
}

export const AdminShopStats: React.FC<AdminShopStatsProps> = ({ overview }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        label="Needs approval"
        value={<span className="font-mono">{overview.pending_redemptions}</span>}
        sub="redemption requests"
        accent={overview.pending_redemptions > 0}
      />
      <StatTile
        label="Ready for pickup"
        value={
          <span
            className="font-mono"
            style={
              overview.ready_redemptions > 0 ? { color: 'var(--info)' } : undefined
            }
          >
            {overview.ready_redemptions}
          </span>
        }
        sub="awaiting hand-off"
      />
    </div>

    <div className="bg-panel border border-line rounded-card p-4 shadow-card">
      <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-3">
        Saving toward
      </p>
      {overview.student_goals.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          No students have picked a goal yet.
        </p>
      ) : (
        <div className="space-y-3.5">
          {overview.student_goals.map((goal) => (
            <GoalRow key={`${goal.student_id}:${goal.item_name}`} goal={goal} />
          ))}
        </div>
      )}
    </div>
  </div>
)

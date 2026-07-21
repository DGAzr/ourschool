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
import type { StudentPoints } from '../../services/points'

interface BalanceCardProps {
  points: StudentPoints
}

/** The dark "points to spend" card with earned/spent sub-stats. */
export const BalanceCard: React.FC<BalanceCardProps> = ({ points }) => (
  <div
    className="rounded-card-lg p-[20px_22px]"
    style={{
      background: 'var(--btn-primary-bg)',
      color: 'var(--btn-primary-fg)',
      padding: '20px 22px',
    }}
  >
    <p
      className="text-[11px] font-semibold uppercase"
      style={{ letterSpacing: '.08em', opacity: 0.62 }}
    >
      Points to spend
    </p>
    <div className="mt-1.5 flex items-baseline gap-2">
      <span style={{ color: 'var(--accent)', fontSize: 26, lineHeight: 1 }} aria-hidden>
        ◆
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 40,
          fontWeight: 600,
          letterSpacing: '-.02em',
          lineHeight: 1,
        }}
      >
        {points.current_balance.toLocaleString()}
      </span>
    </div>
    <div className="mt-4 flex items-center gap-5 text-[12px]" style={{ opacity: 0.72 }}>
      <span>
        <span style={{ color: 'var(--accent)' }} aria-hidden>◆</span>{' '}
        {points.total_earned.toLocaleString()} earned all-time
      </span>
      <span>
        <span style={{ color: 'var(--accent)' }} aria-hidden>◆</span>{' '}
        {points.total_spent.toLocaleString()} spent
      </span>
    </div>
  </div>
)

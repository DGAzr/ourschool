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

import React, { ReactNode } from 'react'

interface StatTileProps {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: boolean
  className?: string
}

const StatTile: React.FC<StatTileProps> = ({ label, value, sub, accent = false, className = '' }) => (
  <div
    className={[
      'bg-panel rounded-card p-4 shadow-card border',
      accent ? 'border-accent-line' : 'border-line',
      className,
    ].join(' ')}
  >
    <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-2">{label}</p>
    <p
      className={[
        'font-mono text-[26px] font-semibold leading-none tabular-nums',
        accent ? 'text-accent' : 'text-ink',
      ].join(' ')}
    >
      {value}
    </p>
    {sub && <p className="mt-1.5 text-[12px] text-muted">{sub}</p>}
  </div>
)

export default StatTile

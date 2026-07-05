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
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  subtext?: ReactNode
  action?: ReactNode
  size?: 'sm' | 'md'
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  subtext,
  action,
  size = 'md',
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center ${
      size === 'sm' ? 'py-10' : 'py-14'
    }`}
  >
    {Icon && <Icon size={32} strokeWidth={1.5} className="text-faint mb-3" />}
    <p className="text-[14px] font-semibold text-ink">{title}</p>
    {subtext && <p className="text-[12.5px] text-muted mt-1 max-w-sm">{subtext}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)

export default EmptyState

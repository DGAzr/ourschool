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

import { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  className = '',
}) => (
  <div className={`flex items-start justify-between gap-4 mb-6 ${className}`}>
    <div>
      {eyebrow && (
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">
          {eyebrow}
        </p>
      )}
      <h1 className="text-[26px] font-bold text-ink tracking-[-0.02em] leading-tight">{title}</h1>
      {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
    </div>
    {actions && (
      <div className="flex items-center gap-2 mt-1 flex-shrink-0">{actions}</div>
    )}
  </div>
)

export default PageHeader

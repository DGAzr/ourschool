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
import { PillVariant } from './pillVariants'

interface PillProps {
  children: ReactNode
  variant?: PillVariant
  className?: string
}

const variantStyles: Record<PillVariant, string> = {
  pos:     'text-pos-fg bg-pos-bg',
  neg:     'text-neg-fg bg-neg-bg',
  info:    'text-info-fg bg-info-bg',
  sub:     'text-sub-fg bg-sub-bg',
  exc:     'text-exc-fg bg-exc-bg',
  ns:      'text-ns-fg bg-ns-bg',
  accent:  'text-accent bg-accent-soft',
  neutral: 'text-muted bg-track',
}

const Pill: React.FC<PillProps> = ({ children, variant = 'neutral', className = '' }) => (
  <span
    className={[
      'inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold leading-tight',
      variantStyles[variant],
      className,
    ].join(' ')}
  >
    {children}
  </span>
)

export default Pill

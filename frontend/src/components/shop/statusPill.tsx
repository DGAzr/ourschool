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
import type { RedemptionStatus } from '../../types/shop'
import { STATUS_STYLES } from './statusStyles'

interface RedemptionStatusPillProps {
  status: RedemptionStatus
  /** Use the student-facing label variant. */
  student?: boolean
  className?: string
}

export const RedemptionStatusPill: React.FC<RedemptionStatusPillProps> = ({
  status,
  student = false,
  className = '',
}) => {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-semibold leading-tight ${className}`}
      style={{ color: style.fg, background: style.bg }}
    >
      {student ? style.studentLabel : style.label}
    </span>
  )
}

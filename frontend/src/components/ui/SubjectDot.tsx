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

interface SubjectDotProps {
  color?: string
  size?: number
  className?: string
}

const SubjectDot: React.FC<SubjectDotProps> = ({ color = '#74716A', size = 8, className = '' }) => (
  <span
    className={`inline-block rounded-full flex-shrink-0 ${className}`}
    style={{ width: size, height: size, background: color }}
  />
)

export default SubjectDot

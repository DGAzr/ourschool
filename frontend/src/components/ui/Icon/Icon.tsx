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
import { Bookmark, type LucideIcon } from 'lucide-react'
import { CATALOG_MAP } from './catalog'

interface IconProps {
  /** Lucide icon name stored in the database (e.g. "book-open"). Null/undefined renders the fallback. */
  name?: string | null
  /** Rendered size in pixels. Default: 16 */
  size?: number
  /** Icon color. Default: currentColor (inherits from CSS) */
  color?: string
  /** Component to render when `name` is null/unknown. Default: Bookmark */
  fallback?: LucideIcon
  /** Additional class names applied to the icon element */
  className?: string
}

/**
 * Single render path for all configured icons in OurSchool.
 *
 * Looks up `name` in the curated catalog and renders the matching lucide icon.
 * When the name is absent or unknown it renders the `fallback` icon instead,
 * so all consumers are safe even with stale/missing data.
 */
const Icon: React.FC<IconProps> = ({
  name,
  size = 16,
  color = 'currentColor',
  fallback: Fallback = Bookmark,
  className,
}) => {
  const entry = name ? CATALOG_MAP[name] : undefined
  const Comp: LucideIcon = entry?.Comp ?? Fallback
  return <Comp size={size} color={color} className={className} />
}

export default Icon

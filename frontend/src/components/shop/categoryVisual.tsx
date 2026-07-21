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
import type { ShopCategory } from '../../types/shop'
import {
  DEFAULT_CATEGORY_COLOR as DEFAULT_COLOR,
  DEFAULT_CATEGORY_ICON as DEFAULT_ICON,
  badgeBg,
  tint,
} from './categoryTint'

interface CategoryBadgeProps {
  category?: Pick<ShopCategory, 'name' | 'color' | 'icon'> | null
  className?: string
}

/** A small pill in the category's own color. */
export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  className = '',
}) => {
  const color = category?.color || DEFAULT_COLOR
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-[11px] font-semibold leading-tight ${className}`}
      style={{ background: badgeBg(color), color }}
    >
      {category?.icon && <span aria-hidden>{category.icon}</span>}
      {category?.name || 'Uncategorized'}
    </span>
  )
}

interface CategoryTileProps {
  category?: Pick<ShopCategory, 'color' | 'icon'> | null
  /** Cover image URL, if the item has a photo. */
  imageUrl?: string | null
  /** Tile height in px. */
  height?: number
  /** Emoji size in px when falling back. */
  iconSize?: number
  rounded?: string
  className?: string
}

/**
 * The item's visual tile: shows the cover photo if present, otherwise a
 * category-tinted background with the category emoji centered. Used at several
 * sizes (card 130px, detail 300px, preview).
 */
export const CategoryTile: React.FC<CategoryTileProps> = ({
  category,
  imageUrl,
  height = 130,
  iconSize = 38,
  rounded = '',
  className = '',
}) => {
  const color = category?.color || DEFAULT_COLOR
  if (imageUrl) {
    return (
      <div
        className={`w-full bg-center bg-cover ${rounded} ${className}`}
        style={{ height, backgroundImage: `url(${imageUrl})` }}
      />
    )
  }
  return (
    <div
      className={`w-full flex items-center justify-center ${rounded} ${className}`}
      style={{ height, background: tint(color) }}
    >
      <span aria-hidden style={{ fontSize: iconSize, lineHeight: 1 }}>
        {category?.icon || DEFAULT_ICON}
      </span>
    </div>
  )
}

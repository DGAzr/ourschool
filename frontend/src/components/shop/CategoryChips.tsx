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

interface CategoryChipsProps {
  categories: ShopCategory[]
  /** Active-item count per category id. */
  counts: Record<number, number>
  /** Total count for the "All" chip. */
  totalCount: number
  selectedCategoryId: number | null
  onSelect: (categoryId: number | null) => void
}

interface ChipProps {
  icon: string
  label: string
  count: number
  selected: boolean
  onClick: () => void
}

const Chip: React.FC<ChipProps> = ({ icon, label, count, selected, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-pill border text-[13px] transition-colors"
    style={
      selected
        ? {
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-fg)',
            borderColor: 'var(--ink)',
          }
        : {
            background: 'var(--panel)',
            color: 'var(--ink-2)',
            borderColor: 'var(--line)',
          }
    }
  >
    <span aria-hidden>{icon}</span>
    <span className="font-medium">{label}</span>
    <span className="font-mono text-[12px]" style={{ opacity: 0.7 }}>
      {count}
    </span>
  </button>
)

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  categories,
  counts,
  totalCount,
  selectedCategoryId,
  onSelect,
}) => (
  <div className="flex flex-wrap gap-2">
    <Chip
      icon="✦"
      label="All"
      count={totalCount}
      selected={selectedCategoryId === null}
      onClick={() => onSelect(null)}
    />
    {categories.map((cat) => (
      <Chip
        key={cat.id}
        icon={cat.icon || '✦'}
        label={cat.name}
        count={counts[cat.id] ?? 0}
        selected={selectedCategoryId === cat.id}
        onClick={() => onSelect(cat.id)}
      />
    ))}
  </div>
)

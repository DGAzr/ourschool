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
import { EmptyState } from '../ui'
import { ShoppingBag } from 'lucide-react'
import type { ShopItem } from '../../types/shop'
import { ItemCard } from './ItemCard'

interface ItemGridProps {
  items: ShopItem[]
  balance: number
  onOpen: (item: ShopItem) => void
  onRedeem: (item: ShopItem) => void
}

export const ItemGrid: React.FC<ItemGridProps> = ({
  items,
  balance,
  onOpen,
  onRedeem,
}) => {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Nothing here yet"
        subtext="No items in this category right now — check back soon!"
      />
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          balance={balance}
          onOpen={onOpen}
          onRedeem={onRedeem}
        />
      ))}
    </div>
  )
}

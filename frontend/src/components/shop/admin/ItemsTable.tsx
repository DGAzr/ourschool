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

import React, { CSSProperties } from 'react'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { EmptyState } from '../../ui'
import { Store } from 'lucide-react'
import type { ShopItem } from '../../../types/shop'
import { CategoryBadge } from '../categoryVisual'
import { tint } from '../categoryTint'

// Leading 28px drag-handle column, then the original six.
const GRID =
  'grid grid-cols-[28px_2.4fr_1fr_0.9fr_1.1fr_0.7fr_64px] gap-3 items-center'

interface ItemsTableProps {
  items: ShopItem[]
  /** Toggle Live/Hidden (optimistic; parent handles the API + revert). */
  onToggleActive: (item: ShopItem) => void
  onEdit: (item: ShopItem) => void
  /** Persist a new full top-to-bottom order of item ids. */
  onReorder: (orderedIds: number[]) => void
}

const stockCell = (item: ShopItem) => {
  if (item.quantity_available === null) {
    return <span className="text-muted">Unlimited</span>
  }
  if (item.quantity_available <= 0) {
    return <span style={{ color: 'var(--neg)' }}>Sold out</span>
  }
  const low = item.quantity_available <= 3
  return (
    <span style={low ? { color: 'var(--accent)' } : undefined}>
      {item.quantity_available} in stock
    </span>
  )
}

const ItemRow: React.FC<{
  item: ShopItem
  onToggleActive: (item: ShopItem) => void
  onEdit: (item: ShopItem) => void
}> = ({ item, onToggleActive, onEdit }) => {
  const color = item.category?.color || '#9A8A4F'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={`${GRID} px-4 py-3 text-[13px]`}>
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.name}`}
        className="flex items-center justify-center text-faint hover:text-ink cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={16} />
      </button>

      {/* Item */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-[38px] h-[38px] rounded-field flex items-center justify-center flex-shrink-0 text-[17px]"
          style={{ background: tint(color) }}
          aria-hidden
        >
          {item.category?.icon || '✦'}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{item.name}</p>
          <p className="text-[11px] text-faint">
            {item.fulfillment_type === 'instant' ? 'Instant' : 'Request'} ·{' '}
            <span aria-hidden>◆</span> {item.total_redeemed} redeemed
          </p>
        </div>
      </div>

      {/* Category */}
      <div className="min-w-0">
        <CategoryBadge category={item.category} />
      </div>

      {/* Cost */}
      <span className="font-mono" style={{ color: 'var(--accent)' }}>
        ◆ {item.cost_points.toLocaleString()}
      </span>

      {/* Stock */}
      <span>{stockCell(item)}</span>

      {/* Status toggle */}
      <button
        onClick={() => onToggleActive(item)}
        className="justify-self-start px-2.5 py-0.5 rounded-pill text-[11px] font-semibold transition-opacity hover:opacity-80"
        style={
          item.is_active
            ? { background: 'var(--pos-soft)', color: 'var(--pos)' }
            : { background: 'var(--track)', color: 'var(--muted)' }
        }
      >
        {item.is_active ? 'Live' : 'Hidden'}
      </button>

      {/* Edit */}
      <button
        onClick={() => onEdit(item)}
        className="justify-self-end h-7 px-3 rounded-field border text-[12px] text-ink-2 hover:bg-panel-2 transition-colors"
        style={{ borderColor: 'var(--btn-border)' }}
      >
        Edit
      </button>
    </div>
  )
}

export const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  onToggleActive,
  onEdit,
  onReorder,
}) => {
  // A small activation distance keeps handle clicks from starting spurious drags.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(items, oldIndex, newIndex)
    onReorder(reordered.map((i) => i.id))
  }

  return (
    <div className="bg-panel border border-line rounded-card overflow-hidden">
      <div
        className={`${GRID} px-4 py-2.5 border-b border-line bg-panel-2 text-[11px] font-semibold text-faint uppercase tracking-[.06em]`}
      >
        <span />
        <span>Item</span>
        <span>Category</span>
        <span>Cost</span>
        <span>Stock</span>
        <span>Status</span>
        <span />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No items yet"
          subtext="Add your first reward to stock the shop."
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-line">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggleActive={onToggleActive}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

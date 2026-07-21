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

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ShopCategory } from '../../../types/shop'
import { shopApi } from '../../../services/shop'
import { getErrorMessage } from '../../../services/api'
import { useToast } from '../../ui'
import { badgeBg } from '../categoryTint'

interface CategoryChipPickerProps {
  categories: ShopCategory[]
  selectedId: number | null
  onSelect: (id: number) => void
  /** Called after a new category is created so the parent refetches. */
  onCreated: (category: ShopCategory) => void
}

export const CategoryChipPicker: React.FC<CategoryChipPickerProps> = ({
  categories,
  selectedId,
  onSelect,
  onCreated,
}) => {
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const cat = await shopApi.createCategory({ name: trimmed })
      onCreated(cat)
      onSelect(cat.id)
      setName('')
      setAdding(false)
    } catch (err) {
      toast(getErrorMessage(err, 'Could not create category'), 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const selected = cat.id === selectedId
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border text-[13px] font-medium transition-colors"
              style={
                selected
                  ? {
                      background: badgeBg(cat.color),
                      color: cat.color,
                      borderColor: cat.color,
                    }
                  : {
                      background: 'var(--panel)',
                      color: 'var(--ink-2)',
                      borderColor: 'var(--line)',
                    }
              }
            >
              {cat.icon && <span aria-hidden>{cat.icon}</span>}
              {cat.name}
            </button>
          )
        })}

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-pill border border-dashed text-[13px] text-muted hover:text-ink transition-colors"
            style={{ borderColor: 'var(--btn-border)' }}
          >
            <Plus size={13} /> New category
          </button>
        )}

        {adding && (
          <div className="inline-flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  create()
                } else if (e.key === 'Escape') {
                  setAdding(false)
                  setName('')
                }
              }}
              placeholder="Category name"
              className="h-8 px-3 rounded-pill border bg-field-bg text-[13px] text-ink placeholder:text-faintest"
              style={{ borderColor: 'var(--field-border)' }}
            />
            <button
              type="button"
              onClick={create}
              disabled={saving || !name.trim()}
              className="h-8 px-3 rounded-pill text-white text-[13px] font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              Add
            </button>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-faint">
        Shared across the shop — manage your own set.
      </p>
    </div>
  )
}

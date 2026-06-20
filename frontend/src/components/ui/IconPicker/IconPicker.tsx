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

import React, { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import Modal from '../Modal/Modal'
import Icon from '../Icon/Icon'
import CATALOG, { type CatalogEntry } from '../Icon/catalog'

interface IconPickerProps {
  /** Whether the picker is open */
  isOpen: boolean
  /** Called when the picker should close */
  onClose: () => void
  /** Currently selected icon name (or undefined for no selection) */
  value?: string | null
  /** Preview color for icons in the grid (matches the item's color) */
  color?: string
  /** Called with the chosen icon name, or null to clear */
  onSelect: (name: string | null) => void
}

/**
 * Full-screen icon picker modal.
 *
 * Built on the shared Modal primitive. Displays a searchable grid of icons
 * from the curated catalog, tinted in the item's configured color.
 */
const IconPicker: React.FC<IconPickerProps> = ({
  isOpen,
  onClose,
  value,
  color = 'var(--accent)',
  onSelect,
}) => {
  const [query, setQuery] = useState('')

  const filtered = useMemo<CatalogEntry[]>(() => {
    const q = query.toLowerCase().trim()
    if (!q) return CATALOG
    return CATALOG.filter(entry =>
      entry.name.includes(q) ||
      entry.keywords.some(kw => kw.includes(q))
    )
  }, [query])

  const handleSelect = (name: string) => {
    onSelect(name)
    onClose()
  }

  const handleClear = () => {
    onSelect(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose an icon"
      subtitle="Icons are tinted with the item's color"
      size="lg"
    >
      {/* Search bar */}
      <div className="sticky top-0 z-10 pb-3 -mt-1 bg-panel">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search icons…"
          className="w-full h-9 px-3 text-sm rounded-field border border-field-border bg-field-bg text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          autoFocus
        />
      </div>

      {/* Clear / no-icon option */}
      <button
        onClick={handleClear}
        className={`
          w-full mb-3 px-3 py-2 rounded-field border text-sm text-left flex items-center gap-2
          transition-colors
          ${!value
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-field-border bg-field-bg text-muted hover:text-ink hover:border-line'
          }
        `}
      >
        <X size={15} />
        No icon (clear)
      </button>

      {/* Icon grid */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-faint">No icons match "{query}"</p>
      ) : (
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {filtered.map(entry => {
            const isSelected = entry.name === value
            return (
              <button
                key={entry.name}
                title={entry.name}
                onClick={() => handleSelect(entry.name)}
                className={`
                  flex items-center justify-center w-full aspect-square rounded-field border
                  transition-colors
                  ${isSelected
                    ? 'border-accent bg-accent-soft ring-2 ring-accent/40'
                    : 'border-field-border bg-field-bg hover:border-accent/40 hover:bg-accent-soft/40'
                  }
                `}
              >
                <Icon name={entry.name} size={18} color={color} />
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default IconPicker

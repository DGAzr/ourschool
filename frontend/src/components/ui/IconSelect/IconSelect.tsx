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

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { INPUT_STYLES } from '../../../constants'
import Icon from '../Icon/Icon'

interface IconSelectOption {
  value: string | number
  label: string
  icon?: string | null
  iconColor?: string
  disabled?: boolean
}

interface IconSelectProps {
  label?: string
  value: string | number
  onChange: (value: string | number) => void
  options: IconSelectOption[]
  disabled?: boolean
  required?: boolean
  error?: string
  helperText?: string
  fullWidth?: boolean
}

/**
 * Custom single-select dropdown that renders a lucide icon next to each option.
 * Mirrors the Select component's visual language but uses React-rendered rows so
 * <Icon> components can appear inside each option — native <option> elements
 * cannot render React components.
 */
const IconSelect: React.FC<IconSelectProps> = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  error,
  helperText,
  fullWidth = true,
}) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  // Close on Escape; basic keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); return }
    if (!open) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const activeOptions = options.filter(o => !o.disabled)
      const idx = activeOptions.findIndex(o => o.value === value)
      const next = e.key === 'ArrowDown'
        ? activeOptions[Math.min(idx + 1, activeOptions.length - 1)]
        : activeOptions[Math.max(idx - 1, 0)]
      if (next) onChange(next.value)
    }
  }, [open, disabled, options, value, onChange])

  const triggerClasses = [
    INPUT_STYLES.base,
    'flex items-center gap-2 cursor-pointer text-left appearance-none',
    disabled ? INPUT_STYLES.disabled : '',
    error ? INPUT_STYLES.error : '',
    open ? 'ring-2 ring-accent/30 border-accent' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={containerRef}>
      {label && (
        <label className="block text-[12px] font-semibold text-faint uppercase tracking-wide mb-1.5">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        className={triggerClasses}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {selected?.icon && (
          <Icon
            name={selected.icon}
            size={15}
            color={selected.iconColor ?? 'currentColor'}
            className="flex-shrink-0"
          />
        )}
        <span className="flex-1 truncate">{selected?.label ?? ''}</span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-faint transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-panel-2 border border-line-3 rounded-field shadow-lg overflow-y-auto"
          style={{ maxHeight: '220px' }}
        >
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  if (!opt.disabled) { onChange(opt.value); setOpen(false) }
                }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-[13.5px] text-left transition-colors',
                  isSelected ? 'bg-accent/10 text-accent font-medium' : 'text-ink hover:bg-faintest/30',
                  opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                {opt.icon
                  ? <Icon name={opt.icon} size={15} color={opt.iconColor ?? 'currentColor'} className="flex-shrink-0" />
                  : <span className="w-[15px] flex-shrink-0" />
                }
                <span className="flex-1 truncate">{opt.label}</span>
                {isSelected && <Check size={13} className="flex-shrink-0 text-accent" />}
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      {helperText && !error && <p className="mt-1 text-[12px] text-muted">{helperText}</p>}
    </div>
  )
}

export default IconSelect

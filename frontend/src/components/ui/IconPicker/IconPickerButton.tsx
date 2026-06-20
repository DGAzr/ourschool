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
import { Smile } from 'lucide-react'
import Icon from '../Icon/Icon'
import IconPicker from './IconPicker'

interface IconPickerButtonProps {
  /** Currently selected icon name (null/undefined = none) */
  value?: string | null
  /** Color to tint the icon preview and the picker grid */
  color?: string
  /** Called when the user picks a new icon (null = cleared) */
  onSelect: (name: string | null) => void
  /** Additional class names for the button */
  className?: string
}

/**
 * A trigger button that previews the current icon and opens the IconPicker modal.
 *
 * Designed to sit inline next to the color input, mirroring the compact
 * `<input type="color">` style used for color picking.
 */
const IconPickerButton: React.FC<IconPickerButtonProps> = ({
  value,
  color = 'var(--accent)',
  onSelect,
  className = '',
}) => {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        title={value ? `Icon: ${value} (click to change)` : 'Click to choose an icon'}
        onClick={() => setPickerOpen(true)}
        className={`
          h-9 w-16 flex items-center justify-center rounded-field border border-field-border
          bg-field-bg hover:border-accent/60 hover:bg-accent-soft/30
          transition-colors cursor-pointer flex-shrink-0
          ${className}
        `}
      >
        {value
          ? <Icon name={value} size={18} color={color} />
          : <Smile size={18} className="text-faint" />
        }
      </button>

      <IconPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={value}
        color={color}
        onSelect={onSelect}
      />
    </>
  )
}

export default IconPickerButton

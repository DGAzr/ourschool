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

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false, className = '' }) => (
  <label className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative w-10 h-[23px] rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        checked ? 'bg-accent' : 'bg-check-border',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-[3px] w-[17px] h-[17px] rounded-full bg-white shadow transition-transform duration-150',
          checked ? 'translate-x-[20px]' : 'translate-x-[3px]',
        ].join(' ')}
      />
    </button>
    {label && <span className="text-[13.5px] text-ink-2">{label}</span>}
  </label>
)

export default Toggle

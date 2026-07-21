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
import { ChevronDown, LucideIcon } from 'lucide-react'

interface IntegrationShelfProps {
  icon: LucideIcon
  title: string
  description: string
  /** Optional badge on the right of the header, e.g. a connection <Pill>. */
  badge?: React.ReactNode
  /** Start expanded. Defaults to collapsed. */
  defaultOpen?: boolean
  children: React.ReactNode
}

/**
 * Collapsible card for one integration in the Admin Center's Integrations
 * section. Header shows an icon, name, description and optional status badge;
 * the body (management UI) reveals on click. Designed to stack — add a shelf
 * per integration.
 */
const IntegrationShelf: React.FC<IntegrationShelfProps> = ({
  icon: Icon,
  title,
  description,
  badge,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-panel border border-line rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3.5 p-5 text-left hover:bg-panel-2/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-panel-2 border border-line text-faint flex-shrink-0">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
            {badge}
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-faint flex-shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-line">{children}</div>
      )}
    </div>
  )
}

export default IntegrationShelf

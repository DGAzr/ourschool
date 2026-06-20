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

import React, { useState, useEffect, useRef } from 'react'
import { MoreVertical, Edit, Trash2, Archive, Users, Download, CheckSquare, Square, Clock } from 'lucide-react'
import { AssignmentTemplate, Subject } from '../../types'
import { ViewDensity } from '../layouts/CompactListLayout'

interface AssignmentTemplateListItemProps {
  template: AssignmentTemplate
  subject?: Subject
  isSelected?: boolean
  onSelectionToggle?: () => void
  onEdit: () => void
  onDelete: () => void
  onAssign: () => void
  onArchive: () => void
  onExport: () => void
  viewDensity: ViewDensity
}

const AssignmentTemplateListItem: React.FC<AssignmentTemplateListItemProps> = ({
  template,
  subject,
  isSelected = false,
  onSelectionToggle,
  onEdit,
  onDelete,
  onAssign,
  onArchive,
  onExport,
  viewDensity
}) => {
  const [showActions, setShowActions] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false)
      }
    }
    if (showActions) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActions])

  const getAssignmentTypeIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      homework: '📝', quiz: '❓', test: '📋', project: '🗂️',
      essay: '📄', lab: '🧪', presentation: '📊', other: '📚'
    }
    return iconMap[type] || '📚'
  }

  if (viewDensity === 'spacious') return null

  const isCompact = viewDensity === 'compact'
  const pad = isCompact ? 'p-3' : 'p-4'

  return (
    <div
      className={`bg-panel border-l-4 border-b border-b-line-2 first:border-t first:border-t-line-2 last:border-b-0 hover:bg-panel-2 transition-colors ${pad}`}
      style={{ borderLeftColor: subject?.color || 'var(--faintest)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            {onSelectionToggle && (
              <button onClick={onSelectionToggle} className="text-faint hover:text-ink transition-colors">
                {isSelected
                  ? <CheckSquare className="h-3.5 w-3.5 text-accent" />
                  : <Square className="h-3.5 w-3.5" />}
              </button>
            )}
            <span className={isCompact ? 'text-base' : 'text-lg'}>
              {getAssignmentTypeIcon(template.assignment_type)}
            </span>
            <h3 className={`font-semibold text-ink truncate ${isCompact ? 'text-[12px]' : 'text-[13px]'}`}>
              {template.name}
            </h3>
            {template.total_assigned != null && template.total_assigned > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent">
                <Users className="h-2.5 w-2.5" />
                {template.total_assigned}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-3 text-[11px] text-muted ${isCompact ? 'gap-2' : ''}`}>
            <span className="font-medium">{subject?.name}</span>
            <span>·</span>
            <span>{template.max_points} pts</span>
            {template.estimated_duration_minutes && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {template.estimated_duration_minutes}m
                </span>
              </>
            )}
            <span>·</span>
            <span className="capitalize">{template.assignment_type}</span>
          </div>

          {!isCompact && template.description && (
            <p className="text-[11px] text-faint mt-1.5 truncate">{template.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={onAssign}
            className={`text-muted hover:text-ink hover:bg-panel-2 rounded-field transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
            title="Assign to students"
          >
            <Users className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
          <button
            onClick={onExport}
            className={`text-muted hover:text-ink hover:bg-panel-2 rounded-field transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
            title="Export template"
          >
            <Download className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
          <div className="relative" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className={`text-faint hover:text-ink hover:bg-panel-2 rounded-field transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
            >
              <MoreVertical className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
            {showActions && (
              <div className="absolute right-0 top-8 w-40 bg-panel border border-line rounded-card shadow-lg z-10">
                <button
                  onClick={() => { onEdit(); setShowActions(false) }}
                  className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2"
                >
                  <Edit className="h-3 w-3" />Edit Template
                </button>
                <button
                  onClick={() => { onArchive(); setShowActions(false) }}
                  className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2"
                >
                  <Archive className="h-3 w-3" />Archive
                </button>
                <button
                  onClick={() => { onDelete(); setShowActions(false) }}
                  className="w-full text-left px-3 py-2 text-[12px] text-neg-fg hover:bg-neg-bg flex items-center gap-2"
                >
                  <Trash2 className="h-3 w-3" />Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssignmentTemplateListItem

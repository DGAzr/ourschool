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
import { Edit, Trash2, Users, Clock, Target, Archive, Download, MoreVertical } from 'lucide-react'
import Icon from '../ui/Icon/Icon'
import { AssignmentTemplate, Subject } from '../../types'
import { assignmentUtils } from '../../services/assignments'
import { useAssignmentTypes } from '../../contexts/AssignmentTypesContext'
import MarkdownRenderer from '../common/MarkdownRenderer'

interface AssignmentTemplateCardProps {
  template: AssignmentTemplate
  subject?: Subject
  onEdit: (template: AssignmentTemplate) => void
  onDelete: (template: AssignmentTemplate) => void
  onAssign: (template: AssignmentTemplate) => void
  onArchive: (template: AssignmentTemplate) => void
  onExport?: (template: AssignmentTemplate) => void
  isSelected?: boolean
  onSelectionToggle?: (templateId: number) => void
}

const AssignmentTemplateCard: React.FC<AssignmentTemplateCardProps> = ({
  template,
  subject,
  onEdit,
  onDelete,
  onAssign,
  onArchive,
  onExport,
  isSelected = false,
  onSelectionToggle
}) => {
  const [showActions, setShowActions] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const { getTypeLabel, getTypeIcon } = useAssignmentTypes()

  // Resolved icon: template override → type icon → subject icon → (Icon's built-in fallback)
  const resolvedIconName =
    template.icon ??
    getTypeIcon(template.assignment_type) ??
    subject?.icon ??
    undefined
  // Resolved color for icon tinting: subject color first, then a neutral token
  const resolvedColor = subject?.color ?? 'var(--muted)'

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false)
      }
    }
    if (showActions) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showActions])

  return (
    <div className="bg-panel border border-line rounded-card-lg overflow-hidden hover:shadow-sm transition-shadow relative">
      <div className="h-1.5" style={{ backgroundColor: subject?.color || 'var(--faintest)' }} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {onSelectionToggle && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelectionToggle(template.id)}
                  className="h-3.5 w-3.5 accent-[var(--accent)] rounded"
                />
              )}
              <Icon name={resolvedIconName} size={16} color={resolvedColor} />
              <h3 className="text-[14px] font-semibold text-ink truncate">{template.name}</h3>
            </div>
            <p className="text-[12px] text-muted">{subject?.name} · {getTypeLabel(template.assignment_type)}</p>
          </div>

          <div className="relative ml-3" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 text-faint hover:text-ink hover:bg-panel-2 rounded-field transition-colors"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {showActions && (
              <div className="absolute right-0 top-8 w-44 bg-panel border border-line rounded-card shadow-lg z-50">
                <button
                  onClick={() => { onAssign(template); setShowActions(false) }}
                  className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2"
                >
                  <Users className="h-3.5 w-3.5 text-pos-fg" />
                  Assign to Students
                </button>
                <button
                  onClick={() => { onEdit(template); setShowActions(false) }}
                  className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2"
                >
                  <Edit className="h-3.5 w-3.5 text-accent" />
                  Edit Template
                </button>
                {onExport && (
                  <button
                    onClick={() => { onExport(template); setShowActions(false) }}
                    className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2"
                  >
                    <Download className="h-3.5 w-3.5 text-muted" />
                    Export Template
                  </button>
                )}
                <button
                  onClick={() => { onArchive(template); setShowActions(false) }}
                  className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2"
                >
                  <Archive className="h-3.5 w-3.5 text-muted" />
                  Archive Template
                </button>
                <div className="border-t border-line" />
                <button
                  onClick={() => { onDelete(template); setShowActions(false) }}
                  className="w-full text-left px-3 py-2 text-[12px] text-neg-fg hover:bg-neg-bg flex items-center gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Template
                </button>
              </div>
            )}
          </div>
        </div>

        {template.description && (
          <div className="mb-4">
            <MarkdownRenderer
              content={template.description}
              className="text-[12px] text-muted line-clamp-2"
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-4 text-[12px] text-muted">
            <div className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              <span>{template.max_points} pts</span>
            </div>
            {template.estimated_duration_minutes && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{assignmentUtils.formatDuration(template.estimated_duration_minutes)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-line-2">
            <span className="text-[12px] text-muted">
              <span className="font-medium text-ink">{template.total_assigned || 0}</span> assigned
            </span>
            {template.average_grade && (
              <span className={`text-[12px] font-medium ${assignmentUtils.calculateGradeColor(template.average_grade)}`}>
                Avg: {template.average_grade.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssignmentTemplateCard

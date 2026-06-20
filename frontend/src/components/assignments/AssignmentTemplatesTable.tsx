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
import { MoreVertical, Edit, Trash2, Archive, Users, Download, CheckSquare, Square, Clock, BookOpen, Calendar } from 'lucide-react'
import { AssignmentTemplate, Subject } from '../../types'
import { useAssignmentTypes } from '../../contexts/AssignmentTypesContext'

interface AssignmentTemplatesTableProps {
  templates: AssignmentTemplate[]
  subjects: Subject[]
  selectedTemplates: Set<number>
  onTemplateSelectionToggle: (templateId: number) => void
  onEditTemplate: (template: AssignmentTemplate) => void
  onDeleteTemplate: (template: AssignmentTemplate) => void
  onAssignTemplate: (template: AssignmentTemplate) => void
  onArchiveTemplate: (template: AssignmentTemplate) => void
  onExportTemplate: (template: AssignmentTemplate) => void
  emptyMessage?: string
  emptyDescription?: string
}

const AssignmentTemplatesTable: React.FC<AssignmentTemplatesTableProps> = ({
  templates, subjects, selectedTemplates,
  onTemplateSelectionToggle, onEditTemplate, onDeleteTemplate,
  onAssignTemplate, onArchiveTemplate, onExportTemplate,
  emptyMessage = 'No assignment templates found',
  emptyDescription = 'Get started by creating your first assignment template.'
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({})

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId && dropdownRefs.current[openDropdownId] &&
          !dropdownRefs.current[openDropdownId]?.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
    }
    if (openDropdownId) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdownId])

  const getSubjectById = (id: number) => subjects.find(s => s.id === id)

  const { getTypeLabel, getTypeIcon } = useAssignmentTypes()

  if (templates.length === 0) {
    return (
      <div className="bg-panel border border-line rounded-card-lg p-6">
        <div className="text-center py-8">
          <BookOpen className="h-10 w-10 text-faintest mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-ink mb-1">{emptyMessage}</p>
          <p className="text-[13px] text-muted">{emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-card-lg overflow-hidden">
      <div className="px-5 py-3.5 border-b border-line flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted" />
        <h3 className="text-[14px] font-semibold text-ink">
          Assignment Templates
        </h3>
        <span className="text-[12px] text-faint">({templates.length})</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-panel-2 border-b border-line">
            <tr>
              <th className="w-10 px-5 py-2.5">
                <CheckSquare className="h-3.5 w-3.5 text-faint" />
              </th>
              {['Template', 'Subject', 'Type', 'Points', 'Duration', 'Assigned', 'Actions'].map(col => (
                <th key={col} className="px-5 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {templates.map((template) => {
              const subject = getSubjectById(template.subject_id)
              return (
                <tr key={template.id} className="hover:bg-panel-2 transition-colors">
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => onTemplateSelectionToggle(template.id)}
                      className="text-faint hover:text-ink transition-colors"
                    >
                      {selectedTemplates.has(template.id)
                        ? <CheckSquare className="h-3.5 w-3.5 text-accent" />
                        : <Square className="h-3.5 w-3.5" />}
                    </button>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">{getTypeIcon(template.assignment_type)}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink">{template.name}</div>
                        {template.description && (
                          <div className="text-[11px] text-faint mt-0.5 line-clamp-1">{template.description}</div>
                        )}
                        <div className="flex items-center gap-1 text-[11px] text-faintest mt-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(template.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject?.color || 'var(--faintest)' }} />
                      <span className="text-[13px] text-ink">{subject?.name || 'Unknown'}</span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="inline-flex px-2 py-0.5 rounded-field text-[11px] font-medium bg-panel-2 text-muted border border-line">
                      {getTypeLabel(template.assignment_type)}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-ink font-mono">
                    {template.max_points} pts
                  </td>

                  <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-muted">
                    {template.estimated_duration_minutes
                      ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{template.estimated_duration_minutes}m</span>
                      : '—'}
                  </td>

                  <td className="px-5 py-3.5 whitespace-nowrap">
                    {template.total_assigned && template.total_assigned > 0
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent"><Users className="h-2.5 w-2.5" />{template.total_assigned}</span>
                      : <span className="text-[13px] text-faint">0</span>}
                  </td>

                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onAssignTemplate(template)} className="p-1.5 rounded-field text-muted hover:text-ink hover:bg-panel-2 transition-colors" title="Assign to students">
                        <Users className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onExportTemplate(template)} className="p-1.5 rounded-field text-muted hover:text-ink hover:bg-panel-2 transition-colors" title="Export template">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <div className="relative" ref={(el) => dropdownRefs.current[template.id] = el}>
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === template.id ? null : template.id)}
                          className="p-1.5 rounded-field text-faint hover:text-ink hover:bg-panel-2 transition-colors"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {openDropdownId === template.id && (
                          <div className="absolute right-0 top-8 w-40 bg-panel border border-line rounded-card shadow-lg z-10">
                            <button onClick={() => { onEditTemplate(template); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2">
                              <Edit className="h-3 w-3" />Edit Template
                            </button>
                            <button onClick={() => { onArchiveTemplate(template); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-ink hover:bg-panel-2 flex items-center gap-2">
                              <Archive className="h-3 w-3" />Archive
                            </button>
                            <button onClick={() => { onDeleteTemplate(template); setOpenDropdownId(null) }} className="w-full text-left px-3 py-2 text-[12px] text-neg-fg hover:bg-neg-bg flex items-center gap-2">
                              <Trash2 className="h-3 w-3" />Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AssignmentTemplatesTable

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
import AssignmentTemplateCard from './AssignmentTemplateCard'
import { AssignmentTemplate, Subject } from '../../types'
import { BookOpen } from 'lucide-react'

interface AssignmentTemplatesListProps {
  templates: AssignmentTemplate[]
  subjects: Subject[]
  selectedTemplates: Set<number>
  onTemplateSelectionToggle: (templateId: number) => void
  onEditTemplate: (template: AssignmentTemplate) => void
  onDeleteTemplate: (template: AssignmentTemplate) => void
  onAssignTemplate: (template: AssignmentTemplate) => void
  onArchiveTemplate: (template: AssignmentTemplate) => void
  onExportTemplate: (template: AssignmentTemplate) => void
}

const AssignmentTemplatesList: React.FC<AssignmentTemplatesListProps> = ({
  templates,
  subjects,
  selectedTemplates,
  onTemplateSelectionToggle,
  onEditTemplate,
  onDeleteTemplate,
  onAssignTemplate,
  onArchiveTemplate,
  onExportTemplate
}) => {
  const getSubjectById = (id: number) => subjects.find(s => s.id === id)

  if (templates.length === 0) {
    return (
      <div className="text-center py-14 bg-panel border border-line rounded-card-lg">
        <BookOpen className="h-10 w-10 text-faintest mx-auto mb-3" />
        <p className="text-[14px] font-semibold text-ink mb-1">No Assignment Templates</p>
        <p className="text-[13px] text-muted">Get started by creating your first assignment template.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {templates.map(template => (
        <AssignmentTemplateCard
          key={template.id}
          template={template}
          subject={getSubjectById(template.subject_id)}
          isSelected={selectedTemplates.has(template.id)}
          onSelectionToggle={() => onTemplateSelectionToggle(template.id)}
          onEdit={() => onEditTemplate(template)}
          onDelete={() => onDeleteTemplate(template)}
          onAssign={() => onAssignTemplate(template)}
          onArchive={() => onArchiveTemplate(template)}
          onExport={() => onExportTemplate(template)}
        />
      ))}
    </div>
  )
}

export default AssignmentTemplatesList

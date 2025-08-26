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
import { AssignmentTemplate, Subject, Lesson } from '../../types'

interface AssignmentTemplatesListProps {
  templates: AssignmentTemplate[]
  subjects: Subject[]
  lessons: Lesson[]
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
  lessons,
  selectedTemplates,
  onTemplateSelectionToggle,
  onEditTemplate,
  onDeleteTemplate,
  onAssignTemplate,
  onArchiveTemplate,
  onExportTemplate
}) => {
  const getSubjectById = (id: number) => subjects.find(s => s.id === id)
  const getLessonById = (id: number) => lessons.find(l => l.id === id)

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Assignment Templates</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by creating your first assignment template.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Templates help you create consistent assignments that can be reused across multiple students.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {templates.map(template => (
        <AssignmentTemplateCard
          key={template.id}
          template={template}
          subject={getSubjectById(template.subject_id)}
          lesson={template.lesson_id ? getLessonById(template.lesson_id) : undefined}
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
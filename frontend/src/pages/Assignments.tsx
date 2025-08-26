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
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { assignmentsApi } from '../services/assignments'

// Hooks
import { useAssignments } from '../hooks/useAssignments'
import { useAssignmentFilters } from '../hooks/useAssignmentFilters'
import { useViewDensity } from '../hooks/useViewDensity'

// Components
import AssignmentHeader from '../components/assignments/AssignmentHeader'
// TODO: Will use these when implementing filters and list view components
// import AssignmentFilters from '../components/assignments/AssignmentFilters'
// import GradingFilters from '../components/assignments/GradingFilters'
// import AssignmentTemplatesList from '../components/assignments/AssignmentTemplatesList'
// import GradingAssignmentsList from '../components/assignments/GradingAssignmentsList'
// import StudentAssignmentsList from '../components/assignments/StudentAssignmentsList'
import AssignmentTemplateCard from '../components/assignments/AssignmentTemplateCard'
import AssignmentTemplateListItem from '../components/assignments/AssignmentTemplateListItem'
import AssignmentTemplatesTable from '../components/assignments/AssignmentTemplatesTable'
import GradingAssignmentCard from '../components/assignments/GradingAssignmentCard'
import GradingAssignmentListItem from '../components/assignments/GradingAssignmentListItem'
import GradingAssignmentsTable from '../components/assignments/GradingAssignmentsTable'
import StudentAssignmentCard from '../components/assignments/StudentAssignmentCard'
import { CompactListLayout } from '../components/layouts'
import ViewDensitySelector from '../components/common/ViewDensitySelector'
import CreateTemplateModal from '../components/assignments/CreateTemplateModal'
import EditTemplateModal from '../components/assignments/EditTemplateModal'
import AssignTemplateModal from '../components/assignments/AssignTemplateModal'
import GradeAssignmentModal from '../components/assignments/GradeAssignmentModal'
import EditAssignmentModal from '../components/assignments/EditAssignmentModal'
import { ExportAssignmentModal } from '../components/assignments/ExportAssignmentModal'
import { ImportAssignmentModal } from '../components/assignments/ImportAssignmentModal'
import SubmissionDialog from '../components/assignments/SubmissionDialog'

// Types
import { AssignmentTemplate, StudentAssignment } from '../types'

const Assignments: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [searchParams] = useSearchParams()
  
  // View mode state - check URL parameter
  const initialViewMode = searchParams.get('view') === 'grading' ? 'grading' : 'templates'
  const [adminViewMode, setAdminViewMode] = useState<'templates' | 'grading'>(initialViewMode)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [showEditAssignmentModal, setShowEditAssignmentModal] = useState(false)
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<AssignmentTemplate | null>(null)
  const [assigningTemplate, setAssigningTemplate] = useState<AssignmentTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<AssignmentTemplate | null>(null)
  const [archivingTemplate, setArchivingTemplate] = useState<AssignmentTemplate | null>(null)
  const [exportingTemplate, setExportingTemplate] = useState<AssignmentTemplate | null>(null)
  const [gradingAssignment, setGradingAssignment] = useState<StudentAssignment | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<StudentAssignment | null>(null)
  const [submittingAssignment, setSubmittingAssignment] = useState<StudentAssignment | null>(null)
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(new Set())

  // View density
  const { viewDensity: templatesViewDensity, setViewDensity: setTemplatesViewDensity } = useViewDensity({
    storageKey: 'assignments-templates-view-density',
    defaultDensity: 'table'
  })
  
  const { viewDensity: gradingViewDensity, setViewDensity: setGradingViewDensity } = useViewDensity({
    storageKey: 'assignments-grading-view-density', 
    defaultDensity: 'table'
  })

  // Filters
  const {
    searchTerm,
    setSearchTerm,
    selectedSubject,
    setSelectedSubject,
    selectedLesson,
    setSelectedLesson,
    selectedType,
    setSelectedType,
    selectedStatuses,
    setSelectedStatuses,
    selectedStudent,
    setSelectedStudent,
    filterTemplates,
    filterStudentAssignments,
    filterGradingAssignments
  } = useAssignmentFilters()

  // Data
  const {
    templates,
    studentAssignments,
    // submittedAssignments, // TODO: will use when implementing status filtering
    allAssignments,
    subjects,
    lessons,
    students,
    loading,
    error,
    refetch,
    setTemplates,
    setError
  } = useAssignments({ 
    isAdmin, 
    adminViewMode, 
    selectedSubject, 
    selectedLesson
  })

  // Utility functions
  const getSubjectById = (id: number) => subjects.find(s => s.id === id)
  const getLessonById = (id: number) => lessons.find(l => l.id === id)

  // Event handlers
  const handleCreateTemplate = () => {
    setShowCreateModal(true)
  }

  const handleEditTemplate = (template: AssignmentTemplate) => {
    setEditingTemplate(template)
    setShowEditModal(true)
  }

  const handleDeleteTemplate = (template: AssignmentTemplate) => {
    setDeletingTemplate(template)
    setShowDeleteConfirm(true)
  }

  const handleAssignTemplate = (template: AssignmentTemplate) => {
    setAssigningTemplate(template)
    setShowAssignModal(true)
  }

  const handleArchiveTemplate = (template: AssignmentTemplate) => {
    setArchivingTemplate(template)
    setShowArchiveConfirm(true)
  }

  const handleExportTemplate = (template: AssignmentTemplate) => {
    setExportingTemplate(template)
    setSelectedTemplates(new Set())
    setShowExportModal(true)
  }

  const handleBulkExport = () => {
    if (selectedTemplates.size === 0) return
    setExportingTemplate(null)
    setShowExportModal(true)
  }

  const handleImportTemplate = () => {
    setShowImportModal(true)
  }

  const performTemplateExport = async (templateId: number) => {
    return await assignmentsApi.exportTemplate(templateId)
  }

  const performBulkExport = async (templateIds: number[]) => {
    return await assignmentsApi.bulkExportTemplates(templateIds)
  }

  const performTemplateImport = async (data: any) => {
    return await assignmentsApi.importTemplate(data)
  }

  const toggleTemplateSelection = (templateId: number) => {
    const newSelected = new Set(selectedTemplates)
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId)
    } else {
      newSelected.add(templateId)
    }
    setSelectedTemplates(newSelected)
  }

  const confirmDelete = async () => {
    if (!deletingTemplate) return

    try {
      await assignmentsApi.delete(deletingTemplate.id)
      setTemplates(templates.filter(t => t.id !== deletingTemplate.id))
      setShowDeleteConfirm(false)
      setDeletingTemplate(null)
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete assignment template'
      setError(errorMessage)
      setShowDeleteConfirm(false)
      setDeletingTemplate(null)
    }
  }

  const confirmArchive = async () => {
    if (!archivingTemplate) return
    try {
      await assignmentsApi.archiveTemplate(archivingTemplate.id)
      refetch()
    } catch (err) {
      setError('Failed to archive template')
    } finally {
      setShowArchiveConfirm(false)
      setArchivingTemplate(null)
    }
  }

  const handleStartAssignment = async (assignmentId: number) => {
    try {
      await assignmentsApi.startAssignment(assignmentId)
      refetch()
    } catch (err) {
      setError('Failed to start assignment')
    }
  }

  const handleCompleteAssignment = (assignment: StudentAssignment) => {
    if (assignment.status === 'in_progress') {
      setSubmittingAssignment(assignment)
      setShowSubmissionDialog(true)
    }
  }

  const handleSubmitAssignment = async (submissionData: {
    submission_notes?: string
    submission_artifacts?: string[]
  }) => {
    if (!submittingAssignment) return

    try {
      await assignmentsApi.updateStudentAssignment(submittingAssignment.id, {
        status: 'submitted',
        ...submissionData
      })
      setShowSubmissionDialog(false)
      setSubmittingAssignment(null)
      refetch()
    } catch (err) {
      setError('Failed to submit assignment')
    }
  }

  const handleArchiveStudentAssignment = async (assignment: StudentAssignment) => {
    try {
      await assignmentsApi.archiveStudentAssignment(assignment.id)
      refetch()
    } catch (err) {
      setError('Failed to archive assignment')
    }
  }

  const handleDeleteStudentAssignment = async (assignment: StudentAssignment) => {
    const student = students.find(s => s.id === assignment.student_id)
    const studentName = student ? `${student.first_name} ${student.last_name}` : 'this student'
    
    if (!confirm(`Are you sure you want to delete this assignment for ${studentName}?`)) {
      return
    }

    try {
      await assignmentsApi.deleteStudentAssignment(assignment.id)
      refetch()
    } catch (err) {
      setError('Failed to delete assignment')
    }
  }

  const handleGradeAssignment = (assignment: StudentAssignment) => {
    setGradingAssignment(assignment)
    setShowGradeModal(true)
  }

  const handleUpdateAssignmentStatus = async (assignmentId: number, status: string) => {
    try {
      await assignmentsApi.updateStudentAssignment(assignmentId, { status })
      refetch()
    } catch (err) {
      setError('Failed to update assignment status')
    }
  }

  const handleEditAssignment = (assignment: StudentAssignment) => {
    setEditingAssignment(assignment)
    setShowEditAssignmentModal(true)
  }

  // Status filter helpers
  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const isStatusSelected = (status: string) => selectedStatuses.includes(status)

  const clearAllStatusFilters = () => setSelectedStatuses([])

  const selectAllStatuses = () => {
    setSelectedStatuses(['not_started', 'in_progress', 'submitted', 'graded'])
  }

  const selectActiveStatuses = () => {
    setSelectedStatuses(['not_started', 'in_progress', 'submitted'])
  }

  // Apply filters
  const filteredTemplates = filterTemplates(templates)
  const filteredStudentAssignments = filterStudentAssignments(studentAssignments)
  const filteredAllAssignments = filterGradingAssignments(allAssignments)

  if (!user) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-2">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <AssignmentHeader
        isAdmin={isAdmin}
        adminViewMode={adminViewMode}
        setAdminViewMode={setAdminViewMode}
        onCreateTemplate={handleCreateTemplate}
        onImportTemplate={handleImportTemplate}
        onBulkExport={handleBulkExport}
        selectedTemplates={selectedTemplates}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Enhanced Filters */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        {isAdmin && adminViewMode === 'grading' ? (
          /* Enhanced Grading Filters */
          <div className="space-y-6">
            {/* Top Row - Search, Subject, Student, View */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Search Assignments</label>
                <input
                  type="text"
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Subject</label>
                <select
                  value={selectedSubject || ''}
                  onChange={(e) => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Student</label>
                <select
                  value={selectedStudent || ''}
                  onChange={(e) => setSelectedStudent(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="">All Students</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">View</label>
                <ViewDensitySelector
                  viewDensity={gradingViewDensity}
                  onViewDensityChange={setGradingViewDensity}
                />
              </div>
            </div>

            {/* Status Filter with Checkboxes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Assignment Status</label>
                <div className="flex space-x-2">
                  <button
                    onClick={selectActiveStatuses}
                    className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
                  >
                    Active Only
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button
                    onClick={selectAllStatuses}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                  >
                    All
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button
                    onClick={clearAllStatusFilters}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { 
                    value: 'not_started', 
                    label: 'Not Started',
                    selectedClasses: 'border-gray-500 bg-gray-50 dark:bg-gray-900',
                    checkboxClasses: 'text-gray-600 focus:ring-gray-500'
                  },
                  { 
                    value: 'in_progress', 
                    label: 'In Progress',
                    selectedClasses: 'border-blue-500 bg-blue-50 dark:bg-blue-900',
                    checkboxClasses: 'text-blue-600 focus:ring-blue-500'
                  },
                  { 
                    value: 'submitted', 
                    label: 'Submitted',
                    selectedClasses: 'border-purple-500 bg-purple-50 dark:bg-purple-900',
                    checkboxClasses: 'text-purple-600 focus:ring-purple-500'
                  },
                  { 
                    value: 'graded', 
                    label: 'Graded',
                    selectedClasses: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900',
                    checkboxClasses: 'text-indigo-600 focus:ring-indigo-500'
                  }
                ].map(status => (
                  <label
                    key={status.value}
                    className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isStatusSelected(status.value)
                        ? status.selectedClasses
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isStatusSelected(status.value)}
                      onChange={() => handleStatusToggle(status.value)}
                      className={`h-4 w-4 ${status.checkboxClasses} border-gray-300 rounded`}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {status.label}
                    </span>
                  </label>
                ))}
              </div>
              {selectedStatuses.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Showing {selectedStatuses.length} status{selectedStatuses.length !== 1 ? 'es' : ''}: {selectedStatuses.join(', ')}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Standard Template/Student Filters */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Search Assignments</label>
              <input
                type="text"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Subject</label>
              <select
                value={selectedSubject || ''}
                onChange={(e) => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All Subjects</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Lesson</label>
              <select
                value={selectedLesson || ''}
                onChange={(e) => setSelectedLesson(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All Lessons</option>
                {lessons
                  .filter(lesson => !selectedSubject || lesson.subjects.some(subject => subject.id === selectedSubject))
                  .map(lesson => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Type</label>
              <select
                value={selectedType || ''}
                onChange={(e) => setSelectedType(e.target.value || null)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All Types</option>
                <option value="homework">Homework</option>
                <option value="quiz">Quiz</option>
                <option value="test">Test</option>
                <option value="project">Project</option>
                <option value="essay">Essay</option>
                <option value="lab">Lab</option>
                <option value="presentation">Presentation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">View</label>
              <ViewDensitySelector
                viewDensity={templatesViewDensity}
                onViewDensityChange={setTemplatesViewDensity}
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading assignments...</span>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {isAdmin && adminViewMode === 'templates' ? (
            // Admin Templates View with CompactListLayout
            <CompactListLayout
              viewDensity={templatesViewDensity}
              items={
                templatesViewDensity === 'table'
                  ? [
                      <AssignmentTemplatesTable
                        key="templates-table"
                        templates={filteredTemplates}
                        subjects={subjects}
                        lessons={lessons}
                        selectedTemplates={selectedTemplates}
                        onTemplateSelectionToggle={toggleTemplateSelection}
                        onEditTemplate={handleEditTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        onAssignTemplate={handleAssignTemplate}
                        onArchiveTemplate={handleArchiveTemplate}
                        onExportTemplate={handleExportTemplate}
                        emptyMessage={
                          searchTerm || selectedSubject || selectedType 
                            ? 'No templates match your filters' 
                            : 'No assignment templates found'
                        }
                        emptyDescription={
                          searchTerm || selectedSubject || selectedType
                            ? 'Try adjusting your search terms or filters.'
                            : 'Get started by creating your first assignment template.'
                        }
                      />
                    ]
                  : templatesViewDensity === 'spacious' 
                  ? filteredTemplates.map((template) => (
                      <AssignmentTemplateCard
                        key={template.id}
                        template={template}
                        subject={getSubjectById(template.subject_id)}
                        lesson={template.lesson_id ? getLessonById(template.lesson_id) : undefined}
                        onEdit={handleEditTemplate}
                        onDelete={handleDeleteTemplate}
                        onAssign={handleAssignTemplate}
                        onArchive={handleArchiveTemplate}
                        onExport={handleExportTemplate}
                        isSelected={selectedTemplates.has(template.id)}
                        onSelectionToggle={toggleTemplateSelection}
                      />
                    ))
                  : filteredTemplates.map((template) => (
                      <AssignmentTemplateListItem
                        key={template.id}
                        template={template}
                        subject={getSubjectById(template.subject_id)}
                        lesson={template.lesson_id ? getLessonById(template.lesson_id) : undefined}
                        onEdit={() => handleEditTemplate(template)}
                        onDelete={() => handleDeleteTemplate(template)}
                        onAssign={() => handleAssignTemplate(template)}
                        onArchive={() => handleArchiveTemplate(template)}
                        onExport={() => handleExportTemplate(template)}
                        isSelected={selectedTemplates.has(template.id)}
                        onSelectionToggle={() => toggleTemplateSelection(template.id)}
                        viewDensity={templatesViewDensity}
                      />
                    ))
              }
              emptyMessage={
                searchTerm || selectedSubject || selectedType 
                  ? 'No templates match your filters' 
                  : 'No assignment templates found'
              }
              emptyDescription={
                searchTerm || selectedSubject || selectedType
                  ? 'Try adjusting your search terms or filters.'
                  : 'Get started by creating your first assignment template.'
              }
            />
          ) : isAdmin && adminViewMode === 'grading' ? (
            // Enhanced Admin Grading View with CompactListLayout
            <CompactListLayout
              viewDensity={gradingViewDensity}
              items={
                gradingViewDensity === 'table'
                  ? [
                      <GradingAssignmentsTable
                        key="grading-table"
                        assignments={filteredAllAssignments}
                        subjects={subjects}
                        students={students}
                        onGradeAssignment={handleGradeAssignment}
                        onEditAssignment={handleEditAssignment}
                        onArchiveAssignment={handleArchiveStudentAssignment}
                        onDeleteAssignment={handleDeleteStudentAssignment}
                        onUpdateAssignmentStatus={handleUpdateAssignmentStatus}
                        emptyMessage="No assignments found"
                        emptyDescription={
                          searchTerm || selectedSubject
                            ? 'No assignments match your current filters.'
                            : 'No assignments have been created yet.'
                        }
                      />
                    ]
                  : gradingViewDensity === 'spacious'
                  ? filteredAllAssignments.map((assignment) => (
                      <GradingAssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        subject={assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined}
                        student={students.find(s => s.id === assignment.student_id)}
                        onGrade={handleGradeAssignment}
                        onUpdateStatus={handleUpdateAssignmentStatus}
                        onEdit={handleEditAssignment}
                        onDelete={handleDeleteStudentAssignment}
                        onArchive={handleArchiveStudentAssignment}
                      />
                    ))
                  : filteredAllAssignments.map((assignment) => (
                      <GradingAssignmentListItem
                        key={assignment.id}
                        assignment={assignment}
                        subject={assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined}
                        student={students.find(s => s.id === assignment.student_id)}
                        onGrade={handleGradeAssignment}
                        onUpdateStatus={handleUpdateAssignmentStatus}
                        onEdit={handleEditAssignment}
                        onDelete={handleDeleteStudentAssignment}
                        onArchive={handleArchiveStudentAssignment}
                        viewDensity={gradingViewDensity}
                      />
                    ))
              }
              emptyMessage="No assignments found"
              emptyDescription={
                searchTerm || selectedSubject
                  ? 'No assignments match your current filters.'
                  : 'No assignments have been created yet.'
              }
            />
          ) : (
            // Student View - Keep as cards for now since it's primarily for individual students
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredStudentAssignments.length === 0 ? (
                <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="h-10 w-10 text-indigo-400 dark:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {searchTerm || selectedSubject || selectedType 
                      ? 'No assignments match your filters' 
                      : 'No assignments assigned yet'
                    }
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchTerm || selectedSubject || selectedType
                      ? 'Try adjusting your search terms or filters.'
                      : 'Your assigned work will appear here when your teacher creates assignments for you.'
                    }
                  </p>
                </div>
              ) : (
                filteredStudentAssignments.map((assignment) => (
                  <StudentAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    subject={assignment.template?.subject_id ? getSubjectById(assignment.template.subject_id) : undefined}
                    isAdmin={isAdmin}
                    onStart={handleStartAssignment}
                    onComplete={handleCompleteAssignment}
                    onArchive={handleArchiveStudentAssignment}
                    onDelete={handleDeleteStudentAssignment}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <CreateTemplateModal
          subjects={subjects}
          lessons={lessons}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            refetch()
          }}
        />
      )}

      {/* Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          subjects={subjects}
          lessons={lessons}
          onClose={() => {
            setShowEditModal(false)
            setEditingTemplate(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setEditingTemplate(null)
            refetch()
          }}
        />
      )}

      {/* Assign Template Modal */}
      {showAssignModal && assigningTemplate && (
        <AssignTemplateModal
          template={assigningTemplate}
          students={students}
          onClose={() => {
            setShowAssignModal(false)
            setAssigningTemplate(null)
          }}
          onSuccess={() => {
            setShowAssignModal(false)
            setAssigningTemplate(null)
            refetch()
          }}
        />
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && deletingTemplate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Assignment Template</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <span className="font-semibold">"{deletingTemplate.name}"</span>? This action cannot be undone.
              {deletingTemplate.total_assigned && deletingTemplate.total_assigned > 0 && (
                <span className="block mt-3 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-200 font-medium">
                  ⚠️ Warning: This template is currently assigned to {deletingTemplate.total_assigned} student(s).
                </span>
              )}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingTemplate(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm hover:shadow-md transition-all duration-200"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Archive Confirmation Modal */}
      {showArchiveConfirm && archivingTemplate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l6 6 6-6" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Archive Assignment Template</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to archive <span className="font-semibold">"{archivingTemplate.name}"</span>? This will hide it from the assignment creation list but preserve existing assignments.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowArchiveConfirm(false)
                  setArchivingTemplate(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmArchive}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 shadow-sm hover:shadow-md transition-all duration-200"
              >
                Archive Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportAssignmentModal
          isOpen={showExportModal}
          onClose={() => {
            setShowExportModal(false)
            setExportingTemplate(null)
            setSelectedTemplates(new Set())
          }}
          templateId={exportingTemplate?.id || 0}
          templateName={exportingTemplate?.name || ''}
          onExport={performTemplateExport}
          onBulkExport={performBulkExport}
          selectedTemplateIds={Array.from(selectedTemplates)}
          isBulkMode={!exportingTemplate && selectedTemplates.size > 0}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportAssignmentModal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false)
            refetch()
          }}
          onImport={performTemplateImport}
          subjects={subjects}
          lessons={lessons}
        />
      )}

      {/* Grade Assignment Modal */}
      {showGradeModal && gradingAssignment && (
        <GradeAssignmentModal
          assignment={gradingAssignment}
          student={students.find(s => s.id === gradingAssignment.student_id)}
          onClose={() => {
            setShowGradeModal(false)
            setGradingAssignment(null)
          }}
          onSuccess={() => {
            setShowGradeModal(false)
            setGradingAssignment(null)
            refetch()
          }}
        />
      )}

      {/* Edit Assignment Modal */}
      {showEditAssignmentModal && editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          student={students.find(s => s.id === editingAssignment.student_id)}
          onClose={() => {
            setShowEditAssignmentModal(false)
            setEditingAssignment(null)
          }}
          onSuccess={() => {
            setShowEditAssignmentModal(false)
            setEditingAssignment(null)
            refetch()
          }}
        />
      )}

      {/* Submission Dialog */}
      {showSubmissionDialog && submittingAssignment && (
        <SubmissionDialog
          assignment={submittingAssignment}
          isOpen={showSubmissionDialog}
          onClose={() => {
            setShowSubmissionDialog(false)
            setSubmittingAssignment(null)
          }}
          onSubmit={handleSubmitAssignment}
          loading={false}
        />
      )}
    </div>
  )
}

export default Assignments
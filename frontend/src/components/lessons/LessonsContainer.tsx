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

import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLessonData } from './hooks/useLessonData'
import { useLessonOperations } from './hooks/useLessonOperations'
import LessonsHeader from './shared/LessonsHeader'
import LessonsFilters from './shared/LessonsFilters'
import LessonCard from './shared/LessonCard'
import { ExportLessonModal } from './ExportLessonModal'
import { ImportLessonModal } from './ImportLessonModal'
import CreateLessonModal from './CreateLessonModal'
import EditLessonModal from './EditLessonModal'
import ManageAssignmentsModal from './ManageAssignmentsModal'
import AssignToStudentsModal from './AssignToStudentsModal'
import { Lesson } from '../../types'

const LessonsContainer: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  
  // Data and operations hooks
  const {
    lessons,
    subjects,
    loading,
    error,
    selectedSubject,
    searchTerm,
    expandedLessons,
    setSelectedSubject,
    setSearchTerm,
    toggleLessonExpansion,
    refreshData,
    getFilteredLessons
  } = useLessonData()
  
  const {
    error: operationError,
    deleteLesson,
    exportLesson,
    importLesson,
    clearError
  } = useLessonOperations()

  // Modal states
  const [showCreateLesson, setShowCreateLesson] = useState(false)
  const [showEditLesson, setShowEditLesson] = useState(false)
  const [showExportLesson, setShowExportLesson] = useState(false)
  const [showImportLesson, setShowImportLesson] = useState(false)
  const [showManageAssignments, setShowManageAssignments] = useState(false)
  const [showAssignToStudents, setShowAssignToStudents] = useState(false)
  
  // Current working lesson
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)

  // Get filtered lessons
  const filteredLessons = getFilteredLessons()

  // Handlers
  const handleCreateLesson = () => {
    setShowCreateLesson(true)
  }

  const handleEditLesson = (lesson: Lesson) => {
    setCurrentLesson(lesson)
    setShowEditLesson(true)
  }

  const handleDeleteLesson = async (lesson: Lesson) => {
    try {
      await deleteLesson(lesson.id)
      await refreshData()
    } catch (error) {
      // Error is handled by the hook
    }
  }

  const handleExportLesson = (lesson: Lesson) => {
    setCurrentLesson(lesson)
    setShowExportLesson(true)
  }

  const handleImportLesson = () => {
    setShowImportLesson(true)
  }

  const handleManageAssignments = (lesson: Lesson) => {
    setCurrentLesson(lesson)
    setShowManageAssignments(true)
  }

  const handleAssignToStudents = (lesson: Lesson) => {
    setCurrentLesson(lesson)
    setShowAssignToStudents(true)
  }

  const handleModalClose = () => {
    setShowCreateLesson(false)
    setShowEditLesson(false)
    setShowExportLesson(false)
    setShowImportLesson(false)
    setShowManageAssignments(false)
    setShowAssignToStudents(false)
    setCurrentLesson(null)
    clearError()
  }

  const handleLessonSuccess = async () => {
    handleModalClose()
    await refreshData()
  }


  // Show error state
  if (error || operationError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium">Error Loading Lessons</h3>
              <div className="mt-2 text-sm">
                {error || operationError}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <LessonsHeader
        onCreateLesson={handleCreateLesson}
        onImportLesson={handleImportLesson}
        onExportLesson={() => setShowExportLesson(true)}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <>
          <LessonsFilters
            subjects={subjects}
            selectedSubject={selectedSubject}
            searchTerm={searchTerm}
            onSubjectChange={setSelectedSubject}
            onSearchChange={setSearchTerm}
            totalLessons={lessons.length}
            filteredCount={filteredLessons.length}
          />

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading lessons...</span>
              </div>
            </div>
          )}

          {/* Lessons Grid */}
          {!loading && (
            <div className="space-y-6">
              {filteredLessons.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {lessons.length === 0 ? 'No lessons created yet' : 'No lessons match your filters'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {lessons.length === 0 
                      ? 'Create your first lesson to get started with teaching.'
                      : 'Try adjusting your search terms or subject filter.'
                    }
                  </p>
                </div>
              ) : (
                filteredLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    isExpanded={expandedLessons.has(lesson.id)}
                    onToggleExpansion={toggleLessonExpansion}
                    onEdit={handleEditLesson}
                    onDelete={handleDeleteLesson}
                    onExport={handleExportLesson}
                    onManageAssignments={handleManageAssignments}
                    onAssignToStudents={handleAssignToStudents}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showExportLesson && currentLesson && (
        <ExportLessonModal
          isOpen={showExportLesson}
          lessonId={currentLesson.id}
          lessonTitle={currentLesson.title}
          onClose={handleModalClose}
          onExport={exportLesson}
        />
      )}

      {showImportLesson && (
        <ImportLessonModal
          isOpen={showImportLesson}
          onClose={handleModalClose}
          onImport={importLesson}
          subjects={subjects}
        />
      )}

      {/* Create Lesson Modal */}
      {showCreateLesson && (
        <CreateLessonModal
          subjects={subjects}
          onClose={handleModalClose}
          onSuccess={handleLessonSuccess}
        />
      )}

      {/* Edit Lesson Modal */}
      {showEditLesson && currentLesson && (
        <EditLessonModal
          lesson={currentLesson}
          subjects={subjects}
          onClose={handleModalClose}
          onSuccess={handleLessonSuccess}
        />
      )}

      {/* Manage Assignments Modal */}
      {showManageAssignments && currentLesson && (
        <ManageAssignmentsModal
          lesson={currentLesson}
          onClose={handleModalClose}
          onSuccess={handleLessonSuccess}
        />
      )}

      {/* Assign to Students Modal */}
      {showAssignToStudents && currentLesson && (
        <AssignToStudentsModal
          lesson={currentLesson}
          onClose={handleModalClose}
          onSuccess={handleLessonSuccess}
        />
      )}
    </div>
  )
}

export default LessonsContainer
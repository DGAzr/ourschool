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

import React, { useState, useEffect } from 'react'
import { BookOpen, Plus, Edit, Trash2, Palette } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { lessonsApi } from '../services/lessons'
import { Subject } from '../types'
import { createCrudErrorHandlers } from '../utils/errorHandling'
import { PageLayout, usePageLayout } from '../components/layouts'

const Subjects: React.FC = () => {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const { loading, error, setLoading, setError } = usePageLayout({ initialLoading: true })
  const errorHandlers = createCrudErrorHandlers('subjects')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  })

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchSubjects()
    }
  }, [user])

  const fetchSubjects = async () => {
    try {
      setLoading(true)
      const data = await lessonsApi.getSubjects()
      setSubjects(data)
      setError(null)
    } catch (err) {
      setError(errorHandlers.load(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSubject = async () => {
    try {
      await lessonsApi.createSubject(subjectForm)
      resetForm()
      setShowCreateModal(false)
      fetchSubjects()
    } catch (err) {
      setError(errorHandlers.create(err))
    }
  }

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setSubjectForm({
      name: subject.name,
      description: subject.description || '',
      color: subject.color
    })
    setShowEditModal(true)
  }

  const handleUpdateSubject = async () => {
    if (!editingSubject) return
    
    try {
      await lessonsApi.updateSubject(editingSubject.id, subjectForm)
      resetForm()
      setEditingSubject(null)
      setShowEditModal(false)
      fetchSubjects()
    } catch (err) {
      setError(errorHandlers.update(err))
    }
  }

  const handleDeleteSubject = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this subject? This action cannot be undone.')) {
      try {
        await lessonsApi.deleteSubject(id)
        fetchSubjects()
      } catch (err) {
        setError(errorHandlers.delete(err))
      }
    }
  }

  const resetForm = () => {
    setSubjectForm({
      name: '',
      description: '',
      color: '#3B82F6'
    })
  }

  const getContrastColor = (hexColor: string): string => {
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(4, 6), 16)
    const b = parseInt(hexColor.slice(7, 9), 16)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 128 ? '#000000' : '#FFFFFF'
  }

  const headerActions = (
    <button 
      onClick={() => setShowCreateModal(true)}
      className="inline-flex items-center px-6 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 shadow-sm hover:shadow-md"
    >
      <Plus className="h-5 w-5 mr-2" />
      Add Subject
    </button>
  )

  return (
    <PageLayout
      title="Subjects"
      subtitle="Manage course subjects and categories"
      icon={BookOpen}
      headerColor="red"
      loading={loading}
      error={error}
      accessDenied={user?.role !== 'admin'}
      accessDeniedMessage="Only administrators can manage subjects."
      actions={headerActions}
    >
      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {subjects.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
            No subjects found. Create your first subject to get started!
          </div>
        ) : (
          subjects.map((subject) => (
            <div key={subject.id} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div 
                className="h-4"
                style={{ backgroundColor: subject.color }}
              ></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                    {subject.name}
                  </h3>
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ 
                      backgroundColor: subject.color,
                      color: getContrastColor(subject.color)
                    }}
                  >
                    <Palette className="h-4 w-4" />
                  </div>
                </div>
                
                {subject.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">{subject.description}</p>
                )}
                
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Created: {new Date(subject.created_at).toLocaleDateString()}
                </div>

                <div className="flex justify-end items-center">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditSubject(subject)}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Edit subject"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(subject.id)}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete subject"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Subject Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Add Subject</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject Name *</label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Mathematics, Science, History"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Subject description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
                <div className="mt-1 flex items-center space-x-3">
                  <input
                    type="color"
                    value={subjectForm.color}
                    onChange={(e) => setSubjectForm({ ...subjectForm, color: e.target.value })}
                    className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={subjectForm.color}
                    onChange={(e) => setSubjectForm({ ...subjectForm, color: e.target.value })}
                    className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubject}
                disabled={!subjectForm.name}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subject Modal */}
      {showEditModal && editingSubject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Edit Subject</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject Name *</label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Mathematics, Science, History"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Subject description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
                <div className="mt-1 flex items-center space-x-3">
                  <input
                    type="color"
                    value={subjectForm.color}
                    onChange={(e) => setSubjectForm({ ...subjectForm, color: e.target.value })}
                    className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={subjectForm.color}
                    onChange={(e) => setSubjectForm({ ...subjectForm, color: e.target.value })}
                    className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSubject(null)
                  resetForm()
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSubject}
                disabled={!subjectForm.name}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update Subject
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

export default Subjects
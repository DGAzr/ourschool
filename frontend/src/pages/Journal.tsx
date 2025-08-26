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
import { Plus, Edit2, Trash2, Search, User, Calendar, BookOpen, MessageSquare } from 'lucide-react'
import { journalApi } from '../services/journal'
import { JournalEntryWithAuthor, JournalEntryCreate, JournalEntryUpdate, JournalStudent } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import MarkdownRenderer from '../components/common/MarkdownRenderer'

const Journal: React.FC = () => {
  const { user } = useAuth()
  const [entries, setEntries] = useState<JournalEntryWithAuthor[]>([])
  const [students, setStudents] = useState<JournalStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<JournalEntryWithAuthor | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Helper function to get local date in YYYY-MM-DD format
  const getLocalDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [formData, setFormData] = useState<JournalEntryCreate>({
    title: '',
    content: '',
    entry_date: getLocalDateString(),
    student_id: undefined
  })

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (user) {
      fetchEntries()
      if (isAdmin) {
        fetchStudents()
      }
    }
  }, [selectedStudentId, user])

  const fetchEntries = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await journalApi.getAll(selectedStudentId || undefined)
      setEntries(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(`Failed to fetch journal entries: ${err.response?.data?.detail || err.message}`)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const data = await journalApi.getStudents()
      setStudents(Array.isArray(data) ? data : [])
    } catch (err: any) {
      // Only show error to user if it's not a permission issue
      if (err.response?.status !== 403) {
        setError(`Failed to fetch students: ${err.response?.data?.detail || err.message}`)
      }
      setStudents([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingEntry) {
        const updateData: JournalEntryUpdate = {
          title: formData.title,
          content: formData.content,
          entry_date: formData.entry_date ? new Date(formData.entry_date).toISOString() : undefined
        }
        await journalApi.update(editingEntry.id, updateData)
      } else {
        const createData: JournalEntryCreate = {
          ...formData,
          entry_date: formData.entry_date ? new Date(formData.entry_date).toISOString() : undefined
        }
        await journalApi.create(createData)
      }
      resetForm()
      fetchEntries()
    } catch (err: any) {
      setError(`Failed to save journal entry: ${err.response?.data?.detail || err.message}`)
    }
  }

  const handleEdit = (entry: JournalEntryWithAuthor) => {
    setEditingEntry(entry)
    setFormData({
      title: entry.title,
      content: entry.content,
      entry_date: entry.entry_date.split('T')[0],
      student_id: entry.student_id
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this journal entry?')) return

    try {
      await journalApi.delete(id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (err: any) {
      setError(`Failed to delete journal entry: ${err.response?.data?.detail || err.message}`)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      entry_date: getLocalDateString(),
      student_id: isAdmin ? selectedStudentId || undefined : undefined
    })
    setEditingEntry(null)
    setShowForm(false)
    setError(null)
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  // Helper function to determine if an entry is written by a student or admin
  const isStudentEntry = (entry: JournalEntryWithAuthor) => {
    // If student_id equals author_id, it's a student writing about themselves
    // If they're different, it's an admin writing about a student
    return entry.student_id === entry.author_id
  }

  // Helper function to get color styles for entries
  const getEntryColors = (entry: JournalEntryWithAuthor) => {
    const isStudent = isStudentEntry(entry)
    
    if (isStudent) {
      // Blue colors for student entries (student writing about themselves)
      return {
        title: { color: '#2563eb' }, // blue-600
        author: { color: '#3b82f6' }, // blue-500
        date: { color: '#3b82f6' }, // blue-500
        icon: { color: '#3b82f6' } // blue-500
      }
    } else {
      // Green colors for admin entries (admin writing about a student)
      return {
        title: { color: '#059669' }, // green-600
        author: { color: '#10b981' }, // green-500
        date: { color: '#10b981' }, // green-500
        icon: { color: '#10b981' } // green-500
      }
    }
  }

  const filteredEntries = (entries || []).filter(entry =>
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.author_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 rounded-xl shadow-lg">
        <div className="px-8 py-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-wide mb-1">
                  Journal
                </h1>
                <p className="text-indigo-100 text-lg">
                  {isAdmin 
                    ? 'Review and manage student journal entries'
                    : 'Track your learning journey and reflect on your progress'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowForm(true)
                // Fetch students when opening form if admin and students not loaded
                if (isAdmin && students.length === 0) {
                  fetchStudents()
                }
              }}
              className="inline-flex items-center px-6 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Entry
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* Student Filter (Admin only) */}
        {isAdmin && (
          <div className="flex-shrink-0">
            <select
              value={selectedStudentId || ''}
              onChange={(e) => setSelectedStudentId(e.target.value ? parseInt(e.target.value) : null)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Students</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search entries..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Journal Entries */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg">
          <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-10 w-10 text-indigo-400 dark:text-indigo-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {searchTerm ? 'No entries match your search' : 'No journal entries yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Start documenting your learning journey by creating your first journal entry.'
            }
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                setShowForm(true)
                // Fetch students when opening form if admin and students not loaded
                if (isAdmin && students.length === 0) {
                  fetchStudents()
                }
              }}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create First Entry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredEntries.map((entry) => {
            const colors = getEntryColors(entry)
            return (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200 dark:border-gray-700"
              >
                {/* Entry Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold" style={colors.title}>
                          {entry.title}
                        </h3>
                        <span 
                          className="px-2 py-1 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: isStudentEntry(entry) ? '#dbeafe' : '#d1fae5', // blue-100 or green-100
                            color: isStudentEntry(entry) ? '#1d4ed8' : '#047857' // blue-700 or green-700
                          }}
                        >
                          {isStudentEntry(entry) ? 'Student Entry' : 'Admin Entry'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" style={colors.icon} />
                          <span style={colors.author}>
                            {isAdmin ? `${entry.student_name} (by ${entry.author_name})` : entry.author_name}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" style={colors.icon} />
                          <span style={colors.date}>
                            {formatDate(entry.entry_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  
                  {(isAdmin || entry.is_own_entry) && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                        title="Edit entry"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Entry Content */}
              <div className="p-6">
                <MarkdownRenderer content={entry.content} />
                
                {entry.updated_at !== entry.created_at && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last updated: {format(parseISO(entry.updated_at), 'MMM d, yyyy \'at\' h:mm a')}
                    </p>
                  </div>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Journal Entry Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                {editingEntry ? 'Edit Journal Entry' : 'New Journal Entry'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Student Selection (Admin only) */}
                {isAdmin && !editingEntry && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Student</label>
                    <select
                      required
                      value={formData.student_id || ''}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        student_id: e.target.value ? parseInt(e.target.value) : undefined 
                      }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select a student</option>
                      {students.map(student => (
                        <option key={student.id} value={student.id}>
                          {student.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Entry title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entry Date</label>
                  <input
                    type="date"
                    required
                    value={formData.entry_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                  <textarea
                    required
                    rows={8}
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Write about your learning experience, thoughts, achievements, challenges, or reflections..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    {editingEntry ? 'Update Entry' : 'Create Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Journal
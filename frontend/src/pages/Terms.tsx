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
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, Edit2, Trash2, Circle, FileText } from 'lucide-react'
import { termsApi } from '../services/terms'
import { Term, TermCreate } from '../types'
import { format, parseISO } from 'date-fns'

const Terms: React.FC = () => {
  const navigate = useNavigate()
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<TermCreate>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    academic_year: '',
    term_type: 'semester',
    term_order: 1
  })
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})

  useEffect(() => {
    fetchTerms()
  }, [])

  const fetchTerms = async () => {
    try {
      setLoading(true)
      const data = await termsApi.getAll()
      
      if (Array.isArray(data)) {
        setTerms(data.sort((a, b) => a.term_order - b.term_order))
      } else {
        setTerms([])
      }
      setError(null)
    } catch (err: any) {
      setError(`Failed to fetch terms: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const validateAcademicYear = (academicYear: string): string | null => {
    if (!academicYear.trim()) {
      return 'Academic year is required'
    }

    // Pattern for single year (YYYY) or year range (YYYY-YYYY)
    const singleYearPattern = /^\d{4}$/
    const yearRangePattern = /^\d{4}-\d{4}$/

    if (singleYearPattern.test(academicYear)) {
      // Validate single year is reasonable
      const year = parseInt(academicYear)
      if (year < 1900 || year > 2100) {
        return 'Academic year must be between 1900 and 2100'
      }
      return null
    } else if (yearRangePattern.test(academicYear)) {
      // Validate year range
      const [startYear, endYear] = academicYear.split('-').map(y => parseInt(y))
      
      // Check years are reasonable
      if (startYear < 1900 || startYear > 2100 || endYear < 1900 || endYear > 2100) {
        return 'Academic years must be between 1900 and 2100'
      }
      
      // Check end year is after start year
      if (endYear <= startYear) {
        return 'End year must be after start year in academic year range'
      }
      
      // Check it's a reasonable range (typically 1-2 years)
      if (endYear - startYear > 5) {
        return 'Academic year range cannot exceed 5 years'
      }
      
      return null
    } else {
      return 'Academic year must be a single 4-digit year (e.g., "2025") or a year range (e.g., "2025-2026")'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous validation errors
    setValidationErrors({})
    
    // Validate academic year
    const academicYearError = validateAcademicYear(formData.academic_year)
    if (academicYearError) {
      setValidationErrors({ academic_year: academicYearError })
      return
    }

    try {
      if (editingTerm) {
        const updated = await termsApi.update(editingTerm.id, formData)
        setTerms(prev => prev.map(t => t.id === editingTerm.id ? updated : t))
      } else {
        const newTerm = await termsApi.create(formData)
        setTerms(prev => [...prev, newTerm].sort((a, b) => a.term_order - b.term_order))
      }
      resetForm()
    } catch (err: any) {
      // Handle backend validation errors
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail
        if (typeof detail === 'string' && detail.includes('Academic year')) {
          setValidationErrors({ academic_year: detail })
        } else {
          setError('Failed to save term: ' + detail)
        }
      } else {
        setError('Failed to save term')
      }
    }
  }

  const handleEdit = (term: Term) => {
    setEditingTerm(term)
    setFormData({
      name: term.name,
      description: term.description || '',
      start_date: term.start_date,
      end_date: term.end_date,
      academic_year: term.academic_year,
      term_type: term.term_type,
      term_order: term.term_order
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this term?')) return
    
    try {
      await termsApi.delete(id)
      setTerms(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setError('Failed to delete term')
    }
  }

  const handleActivate = async (id: number) => {
    try {
      await termsApi.activate(id)
      setTerms(prev => prev.map(t => ({ ...t, is_active: t.id === id })))
    } catch (err) {
      setError('Failed to activate term')
    }
  }

  const handleViewReports = () => {
    navigate('/reports')
  }

  const resetForm = () => {
    // Get the current academic year
    const currentYear = new Date().getFullYear()
    const defaultAcademicYear = `${currentYear}-${currentYear + 1}`
    
    // Find the highest term order for the default academic year
    const sameYearTerms = terms.filter(t => t.academic_year === defaultAcademicYear)
    const nextTermOrder = Math.max(...sameYearTerms.map(t => t.term_order), 0) + 1
    
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      academic_year: defaultAcademicYear,
      term_type: 'semester',
      term_order: nextTermOrder
    })
    setEditingTerm(null)
    setShowForm(false)
    setError(null)
    setValidationErrors({})
  }

  const handleAcademicYearChange = (academicYear: string) => {
    // Find the highest term order for this academic year
    const sameYearTerms = terms.filter(t => t.academic_year === academicYear)
    const nextTermOrder = Math.max(...sameYearTerms.map(t => t.term_order), 0) + 1
    
    setFormData(prev => ({
      ...prev,
      academic_year: academicYear,
      term_order: nextTermOrder
    }))
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  const calculateTermProgress = (startDate: string, endDate: string) => {
    try {
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      const now = new Date()
      
      if (now < start) return { progress: 0, daysRemaining: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) }
      if (now > end) return { progress: 100, daysRemaining: 0 }
      
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      const progress = Math.min(Math.max((elapsedDays / totalDays) * 100, 0), 100)
      
      return { progress: Math.round(progress), daysRemaining: Math.max(daysRemaining, 0) }
    } catch {
      return { progress: 0, daysRemaining: 0 }
    }
  }

  const getTermTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      semester: 'Semester',
      quarter: 'Quarter',
      trimester: 'Trimester',
      custom: 'Custom'
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Enhanced Header Section */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 rounded-xl shadow-lg">
        <div className="px-8 py-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-wide mb-1">
                  Academic Terms
                </h1>
                <p className="text-emerald-100 text-lg">
                  Manage academic terms and grading periods for your homeschool program
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-6 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Term
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Enhanced Terms Grid */}
      {terms.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-10 w-10 text-emerald-400 dark:text-emerald-500" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No academic terms found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Get started by creating your first academic term to organize your homeschool curriculum.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create First Term
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {terms.map((term) => (
            <div
              key={term.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border overflow-hidden ${
                term.is_active 
                  ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-100 dark:ring-emerald-900' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Term Header */}
              <div className={`px-6 py-4 ${
                term.is_active 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' 
                  : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-bold ${term.is_active ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                      {term.name}
                    </h3>
                    <div className="flex items-center space-x-4">
                      <p className={`text-sm ${term.is_active ? 'text-emerald-100' : 'text-gray-600 dark:text-gray-400'}`}>
                        {term.academic_year}
                      </p>
                      {term.is_active && (
                        <p className="text-sm text-emerald-100">
                          {calculateTermProgress(term.start_date, term.end_date).daysRemaining} days remaining
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {term.is_active && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white bg-opacity-20 text-white border border-white border-opacity-30">
                        Active
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      term.is_active 
                        ? 'bg-white bg-opacity-20 text-white border border-white border-opacity-30'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-500'
                    }`}>
                      {getTermTypeLabel(term.term_type)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar - only for active terms */}
              {term.is_active && (
                <div className="relative h-1 bg-gray-200 dark:bg-gray-700">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
                    style={{ width: `${calculateTermProgress(term.start_date, term.end_date).progress}%` }}
                  />
                </div>
              )}

              {/* Term Details */}
              <div className="p-6">
                {term.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{term.description}</p>
                )}
                
                <div className="space-y-3 mb-5">
                  <div className="flex items-center text-sm">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-3">
                      <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatDate(term.start_date)} - {formatDate(term.end_date)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Term duration</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center text-sm">
                    <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400">#{term.term_order}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">Term Order</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Sequence in academic year</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleViewReports}
                      className="inline-flex items-center px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                      title="View academic reports"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Reports
                    </button>
                    
                    {!term.is_active && (
                      <button
                        onClick={() => handleActivate(term.id)}
                        className="inline-flex items-center px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors"
                        title="Activate term"
                      >
                        <Circle className="h-3 w-3 mr-1" />
                        Activate
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEdit(term)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                      title="Edit term"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(term.id)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                      title="Delete term"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Term Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                {editingTerm ? 'Edit Term' : 'Add New Term'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Fall 2024"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Academic Year</label>
                  <input
                    type="text"
                    required
                    value={formData.academic_year}
                    onChange={(e) => {
                      handleAcademicYearChange(e.target.value)
                      // Clear validation error when user starts typing
                      if (validationErrors.academic_year) {
                        setValidationErrors(prev => ({ ...prev, academic_year: '' }))
                      }
                    }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      validationErrors.academic_year 
                        ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                    } text-gray-900 dark:text-gray-100`}
                    placeholder="e.g., 2025 or 2025-2026"
                  />
                  {validationErrors.academic_year && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {validationErrors.academic_year}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Enter a single year (e.g., "2025") or a year range (e.g., "2025-2026")
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Term Type</label>
                    <select
                      value={formData.term_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, term_type: e.target.value as any }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="semester">Semester</option>
                      <option value="quarter">Quarter</option>
                      <option value="trimester">Trimester</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Order</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.term_order}
                      onChange={(e) => setFormData(prev => ({ ...prev, term_order: parseInt(e.target.value) }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {editingTerm ? 'Update' : 'Create'}
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

export default Terms
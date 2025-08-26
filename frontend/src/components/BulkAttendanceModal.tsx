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
import { X, Users } from 'lucide-react'
import { attendanceApi } from '../services/attendance'
import { User } from '../types'

interface BulkAttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const BulkAttendanceModal: React.FC<BulkAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  // Helper function to get local date in YYYY-MM-DD format
  const getLocalDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [bulkRecord, setBulkRecord] = useState({
    date: getLocalDateString(),
    status: 'present' as const,
    notes: ''
  })

  useEffect(() => {
    if (isOpen) {
      fetchStudents()
      // Reset form when modal opens
      setBulkRecord({
        date: getLocalDateString(),
        status: 'present' as const,
        notes: ''
      })
      setSelectedStudents([])
      setError(null)
    }
  }, [isOpen])

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      const studentsData = await attendanceApi.getStudents()
      setStudents(studentsData)
      // Auto-select all students for quick "mark all present" workflow
      setSelectedStudents(studentsData.map((student: User) => student.id))
    } catch (err) {
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  const toggleStudentSelection = (studentId: number) => {
    setSelectedStudents(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const selectAllStudents = () => {
    setSelectedStudents(students.map(student => student.id))
  }

  const clearAllStudents = () => {
    setSelectedStudents([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedStudents.length === 0) {
      setError('Please select at least one student')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await attendanceApi.createBulk({
        student_ids: selectedStudents,
        date: bulkRecord.date,
        status: bulkRecord.status,
        notes: bulkRecord.notes
      })
      
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to record attendance')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <Users className="h-4 w-4 text-white" />
              </div>
              Quick Attendance
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
                  <input
                    type="date"
                    value={bulkRecord.date}
                    onChange={(e) => setBulkRecord({ ...bulkRecord, date: e.target.value })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                  <select
                    value={bulkRecord.status}
                    onChange={(e) => setBulkRecord({ ...bulkRecord, status: e.target.value as any })}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={bulkRecord.notes}
                  onChange={(e) => setBulkRecord({ ...bulkRecord, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional notes for this attendance record..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Students ({selectedStudents.length} selected)
                  </label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={selectAllStudents}
                      className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllStudents}
                      className="text-sm text-gray-600 hover:text-gray-500 font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading students...</p>
                  </div>
                ) : (
                  <div className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md max-h-60 overflow-y-auto">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                                  {student.first_name[0]}{student.last_name[0]}
                                </span>
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {student.first_name} {student.last_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {student.grade_level && `${student.grade_level} • `}{student.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedStudents.length === 0}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Recording...' : `Record Attendance (${selectedStudents.length})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BulkAttendanceModal
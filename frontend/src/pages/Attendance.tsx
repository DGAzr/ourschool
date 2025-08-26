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
import { Calendar, Check, X, Clock, AlertCircle, Loader, Plus, Users, Edit, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { attendanceApi } from '../services/attendance'
import { AttendanceRecord, User } from '../types'

const Attendance: React.FC = () => {
  const { user } = useAuth()
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [showBulkRecord, setShowBulkRecord] = useState(false)
  const [showEditRecord, setShowEditRecord] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null)

  // Helper function to get local date in YYYY-MM-DD format
  const getLocalDateString = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [newRecord, setNewRecord] = useState({
    student_id: 0,
    date: getLocalDateString(),
    status: 'present' as const,
    notes: ''
  })
  const [bulkRecord, setBulkRecord] = useState({
    date: getLocalDateString(),
    status: 'present' as const,
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [attendanceData, studentsData] = await Promise.all([
        attendanceApi.getAll(),
        attendanceApi.getStudents() // New endpoint to get students for attendance
      ])
      setAttendanceRecords(attendanceData)
      setStudents(studentsData)
      setError(null)
    } catch (err) {
      setError('Failed to load attendance data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRecord = async () => {
    try {
      await attendanceApi.create(newRecord)
      setNewRecord({
        student_id: 0,
        date: getLocalDateString(),
        status: 'present',
        notes: ''
      })
      setShowAddRecord(false)
      fetchData()
    } catch (error) {
      setError('Failed to create attendance record')
    }
  }

  const handleBulkRecord = async () => {
    if (selectedStudents.length === 0) {
      setError('Please select at least one student')
      return
    }

    try {
      await attendanceApi.createBulk({
        student_ids: selectedStudents,
        date: bulkRecord.date,
        status: bulkRecord.status,
        notes: bulkRecord.notes
      })
      setBulkRecord({
        date: getLocalDateString(),
        status: 'present',
        notes: ''
      })
      setSelectedStudents([])
      setShowBulkRecord(false)
      fetchData()
      setError(null)
    } catch (error) {
      setError('Failed to create bulk attendance records')
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
    setSelectedStudents(students.map(s => s.id))
  }

  const clearAllStudents = () => {
    setSelectedStudents([])
  }

  const handleEditRecord = (record: AttendanceRecord) => {
    setEditingRecord(record)
    setShowEditRecord(true)
  }

  const handleUpdateRecord = async () => {
    if (!editingRecord) return
    
    try {
      await attendanceApi.update(editingRecord.id, {
        status: editingRecord.status,
        notes: editingRecord.notes
      })
      setShowEditRecord(false)
      setEditingRecord(null)
      fetchData()
      setError(null)
    } catch (error) {
      setError('Failed to update attendance record')
    }
  }

  const handleDeleteRecord = (record: AttendanceRecord) => {
    setRecordToDelete(record)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return
    
    try {
      await attendanceApi.delete(recordToDelete.id)
      setShowDeleteConfirm(false)
      setRecordToDelete(null)
      fetchData()
      setError(null)
    } catch (error) {
      setError('Failed to delete attendance record')
    }
  }

  // Group attendance records by date
  const groupedAttendance = attendanceRecords.reduce((groups, record) => {
    const date = record.date
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(record)
    return groups
  }, {} as Record<string, AttendanceRecord[]>)


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <Check className="h-4 w-4 text-green-500" />
      case 'absent':
        return <X className="h-4 w-4 text-red-500" />
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'excused':
        return <AlertCircle className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
      case 'absent':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
      case 'late':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
      case 'excused':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    }
  }

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can manage attendance.</p>
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
                  Attendance
                </h1>
                <p className="text-emerald-100 text-lg">
                  Track daily attendance for all students
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => setShowAddRecord(true)}
                className="inline-flex items-center px-5 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus className="h-4 w-4 mr-2" />
                Individual Record
              </button>
              <button 
                onClick={() => setShowBulkRecord(true)}
                className="inline-flex items-center px-5 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Users className="h-4 w-4 mr-2" />
                Bulk Attendance
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading attendance...</span>
        </div>
      )}

      {/* Add Record Modal */}
      {showAddRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Add Attendance Record</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Student</label>
                <select
                  value={newRecord.student_id}
                  onChange={(e) => setNewRecord({ ...newRecord, student_id: parseInt(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <input
                  type="date"
                  value={newRecord.date}
                  onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={newRecord.status}
                  onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value as any })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddRecord(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRecord}
                disabled={newRecord.student_id === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Attendance Modal */}
      {showBulkRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Bulk Attendance Recording</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                  <input
                    type="date"
                    value={bulkRecord.date}
                    onChange={(e) => setBulkRecord({ ...bulkRecord, date: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <select
                    value={bulkRecord.status}
                    onChange={(e) => setBulkRecord({ ...bulkRecord, status: e.target.value as any })}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={bulkRecord.notes}
                  onChange={(e) => setBulkRecord({ ...bulkRecord, notes: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional notes..."
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
                      className="text-sm text-blue-600 hover:text-blue-500"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllStudents}
                      className="text-sm text-gray-600 hover:text-gray-500"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
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
                            <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
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
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowBulkRecord(false)
                  setSelectedStudents([])
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkRecord}
                disabled={selectedStudents.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Record Attendance for {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {showEditRecord && editingRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Edit Attendance Record</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Student</label>
                <div className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  {(() => {
                    const student = students.find(s => s.id === editingRecord.student_id)
                    return student ? `${student.first_name} ${student.last_name}` : 'Unknown Student'
                  })()}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                <div className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  {new Date(editingRecord.date + 'T00:00:00').toLocaleDateString()}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  value={editingRecord.status}
                  onChange={(e) => setEditingRecord({ ...editingRecord, status: e.target.value as any })}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={editingRecord.notes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditRecord(false)
                  setEditingRecord(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRecord}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Update Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && recordToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Delete Attendance Record</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete the attendance record for{' '}
              {(() => {
                const student = students.find(s => s.id === recordToDelete.student_id)
                return student ? `${student.first_name} ${student.last_name}` : 'this student'
              })()} on {new Date(recordToDelete.date + 'T00:00:00').toLocaleDateString()}?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setRecordToDelete(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRecord}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Records */}
      {!loading && (
        <div className="space-y-6">
          {Object.keys(groupedAttendance).length === 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Attendance Records</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Start tracking attendance by adding your first record!</p>
              <button 
                onClick={() => setShowAddRecord(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add First Record
              </button>
            </div>
          ) : (
            Object.entries(groupedAttendance)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([date, records]) => (
                <div key={date} className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                      <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mr-3">
                        <Calendar className="h-4 w-4 text-white" />
                      </div>
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {records.map((record) => {
                        const student = students.find(s => s.id === record.student_id)
                        if (!student) return null
                        
                        return (
                          <div
                            key={record.id}
                            className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 overflow-hidden"
                          >
                            <div className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center flex-1 min-w-0">
                                  <div className="flex-shrink-0 h-14 w-14">
                                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                                      <span className="text-lg font-bold text-white">
                                        {student.first_name[0]}{student.last_name[0]}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4 flex-1 min-w-0">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
                                      {student.first_name} {student.last_name}
                                    </h4>
                                    {student.grade_level && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {student.grade_level}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <button
                                    onClick={() => handleEditRecord(record)}
                                    className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                                    title="Edit record"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRecord(record)}
                                    className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                                    title="Delete record"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between mb-4">
                                <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${getStatusColor(record.status)}`}>
                                  {getStatusIcon(record.status)}
                                  <span className="ml-2 capitalize">{record.status}</span>
                                </span>
                              </div>
                              
                              {record.notes && (
                                <div className="bg-white dark:bg-gray-600 rounded-lg p-4 border border-gray-200 dark:border-gray-500">
                                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">Notes:</span> {record.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}

export default Attendance
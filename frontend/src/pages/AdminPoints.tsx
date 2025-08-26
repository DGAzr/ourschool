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
import { useAuth } from '../contexts/AuthContext'
import { pointsApi, type AdminPointsOverview, type StudentPoints, type PointsLedger } from '../services/points'
import { 
  Coins, 
  Shield, 
  Plus, 
  Eye, 
  TrendingUp,
  Users,
  Award,
  X,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// Admin Point Adjustment Modal Component
interface PointAdjustmentModalProps {
  student: StudentPoints | null
  onClose: () => void
  onSuccess: () => void
}

const PointAdjustmentModal: React.FC<PointAdjustmentModalProps> = ({ student, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!student || !amount || !notes.trim()) {
      setError('Please fill in all fields')
      return
    }

    const pointAmount = parseInt(amount)
    if (isNaN(pointAmount) || pointAmount === 0) {
      setError('Please enter a valid point amount')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await pointsApi.adjustPoints({
        student_id: student.student_id,
        amount: pointAmount,
        notes: notes.trim()
      })
      
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to adjust points')
    } finally {
      setLoading(false)
    }
  }

  if (!student) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Adjust Points for {student.student_name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Current Balance: <span className="font-semibold">{student.current_balance.toLocaleString()}</span> points
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Point Adjustment
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter points (positive to add, negative to subtract)"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use positive numbers to award points, negative numbers to deduct points
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason/Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain the reason for this point adjustment..."
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adjusting...' : 'Adjust Points'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Student Ledger Modal Component
interface StudentLedgerModalProps {
  student: StudentPoints | null
  onClose: () => void
}

const StudentLedgerModal: React.FC<StudentLedgerModalProps> = ({ student, onClose }) => {
  const [ledger, setLedger] = useState<PointsLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (student) {
      loadLedger(1)
    }
  }, [student])

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const loadLedger = async (page: number) => {
    if (!student) return

    try {
      setLoading(true)
      setError(null)
      const ledgerData = await pointsApi.getStudentLedger(student.student_id, page, 10)
      setLedger(ledgerData)
      setCurrentPage(page)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load student ledger')
    } finally {
      setLoading(false)
    }
  }

  const getTransactionIcon = (transactionType: string) => {
    switch (transactionType) {
      case 'assignment':
        return <Award className="h-4 w-4 text-green-500" />
      case 'admin_award':
        return <TrendingUp className="h-4 w-4 text-blue-500" />
      case 'admin_deduction':
        return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
      case 'spending':
        return <Coins className="h-4 w-4 text-purple-500" />
      default:
        return <Coins className="h-4 w-4 text-gray-500" />
    }
  }

  const formatAmount = (amount: number) => {
    const sign = amount >= 0 ? '+' : '-'
    const color = amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
    return (
      <span className={`font-semibold ${color}`}>
        {sign}{Math.abs(amount).toLocaleString()}
      </span>
    )
  }

  if (!student) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Points Ledger - {student.student_name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Current Balance: <span className="font-semibold text-yellow-600 dark:text-yellow-400">
                {student.current_balance.toLocaleString()} points
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-10rem)]">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg h-16"></div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => loadLedger(currentPage)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : ledger ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">Current Balance</p>
                  <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                    {ledger.student_points.current_balance.toLocaleString()}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">Total Earned</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">
                    {ledger.student_points.total_earned.toLocaleString()}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">Total Spent</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">
                    {ledger.student_points.total_spent.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Transactions */}
              <div className="space-y-3">
                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">Transaction History</h4>
                
                {ledger.transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Coins className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ledger.transactions.map((transaction) => (
                      <div key={transaction.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getTransactionIcon(transaction.transaction_type)}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {transaction.source_description || 'Points Transaction'}
                              </p>
                              {transaction.notes && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  {transaction.notes}
                                </p>
                              )}
                              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(transaction.created_at).toLocaleString()}
                                {transaction.admin_name && (
                                  <>
                                    <User className="h-3 w-3 ml-3 mr-1" />
                                    by {transaction.admin_name}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {formatAmount(transaction.amount)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {ledger.total_pages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Page {ledger.current_page} of {ledger.total_pages}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadLedger(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </button>
                      <button
                        onClick={() => loadLedger(currentPage + 1)}
                        disabled={currentPage === ledger.total_pages}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const AdminPoints: React.FC = () => {
  const { user } = useAuth()
  const [overview, setOverview] = useState<AdminPointsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [systemEnabled, setSystemEnabled] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showLedgerModal, setShowLedgerModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentPoints | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Check system status
      const status = await pointsApi.getSystemStatus()
      setSystemEnabled(status.enabled)
      
      if (status.enabled) {
        // Load admin overview
        const overviewData = await pointsApi.getAdminOverview()
        setOverview(overviewData)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load points data')
    } finally {
      setLoading(false)
    }
  }


  const handleAdjustPoints = (student: StudentPoints) => {
    setSelectedStudent(student)
    setShowAdjustModal(true)
  }

  const handleAdjustmentSuccess = () => {
    loadData() // Reload data after successful adjustment
  }

  const handleViewLedger = (student: StudentPoints) => {
    setSelectedStudent(student)
    setShowLedgerModal(true)
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can manage points.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg h-32"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg h-24"></div>
          ))}
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg h-96"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg shadow-lg">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Coins className="h-8 w-8 text-white mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Points Management
                </h1>
                <p className="text-yellow-100 text-lg mt-1">
                  Manage student points and system settings
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-yellow-100 text-sm">System Status</p>
              <p className="text-white font-semibold">
                {systemEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <p className="text-yellow-100 text-xs mt-1">
                Configure in System Settings
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!systemEnabled ? (
        <div className="text-center py-12">
          <Coins className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Points System Disabled</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Enable the points system to start tracking student points.
          </p>
        </div>
      ) : overview ? (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="bg-blue-500 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {overview.total_students}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {overview.total_students_with_points} with points
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="bg-green-500 p-3 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Points Awarded</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {overview.total_points_awarded.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="bg-purple-500 p-3 rounded-lg">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Points Spent</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {overview.total_points_spent.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Student Points Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Student Points Management
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                View and adjust individual student point balances
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Current Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total Earned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Total Spent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {overview.student_points.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Coins className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No students with points yet</p>
                      </td>
                    </tr>
                  ) : (
                    overview.student_points.map((studentPoints) => (
                      <tr key={studentPoints.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {studentPoints.student_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                            {studentPoints.current_balance.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-green-600 dark:text-green-400">
                            +{studentPoints.total_earned.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-red-600 dark:text-red-400">
                            -{studentPoints.total_spent.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleAdjustPoints(studentPoints)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Adjust
                            </button>
                            <button
                              onClick={() => handleViewLedger(studentPoints)}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Point Adjustment Modal */}
      {showAdjustModal && (
        <PointAdjustmentModal
          student={selectedStudent}
          onClose={() => setShowAdjustModal(false)}
          onSuccess={handleAdjustmentSuccess}
        />
      )}

      {/* Student Ledger Modal */}
      {showLedgerModal && (
        <StudentLedgerModal
          student={selectedStudent}
          onClose={() => setShowLedgerModal(false)}
        />
      )}
    </div>
  )
}

export default AdminPoints
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
import { pointsApi, type PointsLedger } from '../services/points'
import PointsDisplay from '../components/PointsDisplay'
import { 
  Coins, 
  Calendar, 
  User, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Award,
  ShoppingCart
} from 'lucide-react'

const MyPoints: React.FC = () => {
  const { user } = useAuth()
  const [ledger, setLedger] = useState<PointsLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [systemEnabled, setSystemEnabled] = useState(false)

  useEffect(() => {
    loadLedger(currentPage)
  }, [currentPage])

  const loadLedger = async (page: number) => {
    if (!user || user.role !== 'student') {
      setError('Only students can view their points ledger')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Check if points system is enabled
      const status = await pointsApi.getSystemStatus()
      setSystemEnabled(status.enabled)
      
      if (!status.enabled) {
        setError('Points system is currently disabled')
        return
      }

      const ledgerData = await pointsApi.getMyLedger(page, 20)
      setLedger(ledgerData)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load points ledger')
    } finally {
      setLoading(false)
    }
  }

  const getTransactionIcon = (transactionType: string) => {
    switch (transactionType) {
      case 'assignment':
        return <Award className="h-5 w-5 text-green-500" />
      case 'admin_award':
        return <TrendingUp className="h-5 w-5 text-blue-500" />
      case 'admin_deduction':
        return <TrendingDown className="h-5 w-5 text-red-500" />
      case 'spending':
        return <ShoppingCart className="h-5 w-5 text-purple-500" />
      default:
        return <Coins className="h-5 w-5 text-gray-500" />
    }
  }

  const getTransactionDescription = (transactionType: string) => {
    switch (transactionType) {
      case 'assignment':
        return 'Assignment Completion'
      case 'admin_award':
        return 'Admin Award'
      case 'admin_deduction':
        return 'Admin Deduction'
      case 'spending':
        return 'Point Spending'
      default:
        return 'Transaction'
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

  if (!user || user.role !== 'student') {
    return (
      <div className="text-center py-12">
        <Coins className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only students can view their points ledger.</p>
      </div>
    )
  }

  if (!systemEnabled) {
    return (
      <div className="text-center py-12">
        <Coins className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Points System Disabled</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">The points system is currently disabled by your administrator.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg h-32"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg h-20"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Coins className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Error</h2>
        <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>
        <button
          onClick={() => loadLedger(currentPage)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!ledger) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg shadow-lg">
        <div className="px-6 py-8">
          <div className="flex items-center">
            <Coins className="h-8 w-8 text-white mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-white">
                My Points Ledger
              </h1>
              <p className="text-yellow-100 text-lg mt-1">
                Track your earned points and spending history
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Points Balance Display */}
      <PointsDisplay />

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Transaction History
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Complete record of all point awards and spending
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {ledger.transactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Coins className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                Complete assignments to start earning points!
              </p>
            </div>
          ) : (
            ledger.transactions.map((transaction) => (
              <div key={transaction.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {transaction.source_description || getTransactionDescription(transaction.transaction_type)}
                        </p>
                      </div>
                      {transaction.notes && (
                        <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <FileText className="h-3 w-3 mr-1" />
                          {transaction.notes}
                        </div>
                      )}
                      <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
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
                  <div className="flex-shrink-0">
                    {formatAmount(transaction.amount)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {ledger.total_pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Page {ledger.current_page} of {ledger.total_pages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === ledger.total_pages}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyPoints
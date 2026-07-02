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

import { getErrorMessage } from '../services/api'
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { pointsApi, type PointsLedger } from '../services/points'
import { useAssignmentTypes } from '../contexts/AssignmentTypesContext'
import Icon from '../components/ui/Icon/Icon'
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
  ShoppingCart,
  BookOpen,
  Eye,
  EyeOff,
} from 'lucide-react'

const MyPoints: React.FC = () => {
  const { user } = useAuth()
  const { getTypeIcon, getTypeColor, getTypeLabel } = useAssignmentTypes()
  const [ledger, setLedger] = useState<PointsLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [systemEnabled, setSystemEnabled] = useState(false)
  const [balanceVisible, setBalanceVisible] = useState(true)

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

      const status = await pointsApi.getSystemStatus()
      setSystemEnabled(status.enabled)

      if (!status.enabled) {
        setError('Points system is currently disabled')
        return
      }

      const ledgerData = await pointsApi.getMyLedger(page, 20)
      setLedger(ledgerData)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load points ledger'))
    } finally {
      setLoading(false)
    }
  }

  const getTransactionIcon = (transactionType: string, assignmentTypeKey?: string) => {
    if (transactionType === 'assignment') {
      const iconName = getTypeIcon(assignmentTypeKey)
      const color = getTypeColor(assignmentTypeKey)
      return (
        <div
          className="w-8 h-8 rounded-field flex items-center justify-center flex-shrink-0"
          style={{ background: color ? `${color}22` : 'var(--pos-bg)', color: color ?? 'var(--pos-fg)' }}
        >
          <Icon name={iconName} size={15} />
        </div>
      )
    }
    if (transactionType === 'journal_submission') {
      return (
        <div className="w-8 h-8 rounded-field flex items-center justify-center flex-shrink-0 bg-[var(--exc-bg)] text-[var(--exc-fg)]">
          <BookOpen size={15} />
        </div>
      )
    }
    if (transactionType === 'admin_award') {
      return (
        <div className="w-8 h-8 rounded-field flex items-center justify-center flex-shrink-0 bg-[var(--pos-bg)] text-[var(--pos-fg)]">
          <TrendingUp size={15} />
        </div>
      )
    }
    if (transactionType === 'admin_deduction') {
      return (
        <div className="w-8 h-8 rounded-field flex items-center justify-center flex-shrink-0 bg-[var(--neg-bg)] text-[var(--neg-fg)]">
          <TrendingDown size={15} />
        </div>
      )
    }
    if (transactionType === 'spending') {
      return (
        <div className="w-8 h-8 rounded-field flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
          <ShoppingCart size={15} />
        </div>
      )
    }
    return (
      <div className="w-8 h-8 rounded-field flex items-center justify-center flex-shrink-0 bg-panel-2 text-muted">
        <Coins size={15} />
      </div>
    )
  }

  const getTransactionLabel = (transactionType: string, assignmentTypeKey?: string) => {
    if (transactionType === 'assignment') {
      return assignmentTypeKey ? getTypeLabel(assignmentTypeKey) : 'Assignment'
    }
    if (transactionType === 'journal_submission') return 'Journal'
    if (transactionType === 'admin_award') return 'Award'
    if (transactionType === 'admin_deduction') return 'Deduction'
    if (transactionType === 'spending') return 'Spending'
    return 'Transaction'
  }

  if (!user || user.role !== 'student') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Coins size={36} className="text-faint mb-3" />
        <p className="text-[15px] font-semibold text-ink">Access Denied</p>
        <p className="text-[13px] text-muted mt-1">Only students can view their points ledger.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-[13px] py-12">
        <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
        Loading…
      </div>
    )
  }

  if (!systemEnabled || error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Coins size={36} className="text-faint mb-3" />
        <p className="text-[15px] font-semibold text-ink">
          {!systemEnabled ? 'Points System Disabled' : 'Error'}
        </p>
        <p className="text-[13px] text-muted mt-1">
          {!systemEnabled
            ? 'The points system is currently disabled by your administrator.'
            : error}
        </p>
        {error && systemEnabled && (
          <button
            onClick={() => loadLedger(currentPage)}
            className="mt-4 px-4 py-2 rounded-field bg-accent text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        )}
      </div>
    )
  }

  if (!ledger) return null

  const { student_points: points } = ledger

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">Student</p>
        <h1 className="text-[26px] font-semibold text-ink tracking-[-0.02em]">My Points</h1>
      </div>

      {/* Balance card */}
      <div className="bg-panel border border-line rounded-card p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">
              Current Balance
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-bold text-ink tracking-[-0.03em] leading-none">
                {balanceVisible ? points.current_balance.toLocaleString() : '•••'}
              </span>
              <span className="text-[14px] text-muted font-medium">pts</span>
            </div>
          </div>
          <button
            onClick={() => setBalanceVisible(v => !v)}
            className="mt-0.5 p-1.5 rounded-field text-muted hover:text-ink hover:bg-panel-2 transition-colors"
            title={balanceVisible ? 'Hide balance' : 'Show balance'}
            aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
          >
            {balanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {balanceVisible && (
          <div className="mt-4 pt-4 border-t border-line flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-[13px]">
              <TrendingUp size={14} className="text-[var(--pos-fg)]" />
              <span className="text-muted">Earned</span>
              <span className="font-semibold text-ink font-mono">{points.total_earned.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px]">
              <ShoppingCart size={14} className="text-muted" />
              <span className="text-muted">Spent</span>
              <span className="font-semibold text-ink font-mono">{points.total_spent.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-panel border border-line rounded-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-panel-2">
          <p className="text-[12px] font-semibold text-faint uppercase tracking-[.06em]">Transaction History</p>
          {ledger.total_pages > 1 && (
            <span className="text-[12px] text-muted font-mono">
              Page {ledger.current_page} / {ledger.total_pages}
            </span>
          )}
        </div>

        {ledger.transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Award size={32} className="text-faint mb-3" />
            <p className="text-[14px] font-semibold text-ink">No transactions yet</p>
            <p className="text-[12px] text-muted mt-1">Complete assignments to start earning points!</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {ledger.transactions.map((transaction) => {
              const isPositive = transaction.amount >= 0
              return (
                <div key={transaction.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-panel-2 transition-colors">
                  {getTransactionIcon(transaction.transaction_type, transaction.assignment_type_key)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-ink truncate">
                        {transaction.source_description || getTransactionLabel(transaction.transaction_type, transaction.assignment_type_key)}
                      </span>
                      <span className="text-[11px] text-faint bg-panel-2 border border-line rounded px-1.5 py-0.5 shrink-0">
                        {getTransactionLabel(transaction.transaction_type, transaction.assignment_type_key)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Calendar size={10} />
                        {new Date(transaction.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                      {transaction.admin_name && (
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <User size={10} />
                          {transaction.admin_name}
                        </span>
                      )}
                      {transaction.notes && (
                        <span className="flex items-center gap-1 text-[11px] text-muted truncate">
                          <FileText size={10} />
                          {transaction.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className="text-[14px] font-bold font-mono shrink-0"
                    style={{ color: isPositive ? 'var(--pos-fg)' : 'var(--neg-fg)' }}
                  >
                    {isPositive ? '+' : ''}{transaction.amount.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {ledger.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-line bg-panel-2">
            <span className="text-[12px] text-muted">
              {ledger.transactions.length} of {ledger.total_pages * 20} transactions
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="w-8 h-8 flex items-center justify-center rounded-field border border-btn-border text-muted hover:text-ink hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === ledger.total_pages}
                aria-label="Next page"
                className="w-8 h-8 flex items-center justify-center rounded-field border border-btn-border text-muted hover:text-ink hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyPoints

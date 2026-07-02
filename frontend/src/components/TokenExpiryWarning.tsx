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

import React from 'react'
import { AlertTriangle, Clock, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface TokenExpiryWarningProps {
  onDismiss?: () => void
  onExtendSession?: () => void
}

const TokenExpiryWarning: React.FC<TokenExpiryWarningProps> = ({
  onDismiss,
  onExtendSession
}) => {
  const { timeRemaining, showExpiryWarning } = useAuth()

  if (!showExpiryWarning) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-warn-soft border border-warn-line rounded-card shadow-float p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-warn" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-[13px] font-semibold text-warn">
              Session Expiring Soon
            </h3>
            <div className="mt-1 text-[13px] text-warn">
              <p>Your session will expire in:</p>
              <div className="flex items-center mt-1">
                <Clock className="h-4 w-4 mr-1" />
                <span className="font-mono font-semibold">{timeRemaining}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {onExtendSession && (
                <button
                  onClick={onExtendSession}
                  className="text-[12px] font-semibold px-2 py-1 rounded-field border border-warn-line text-warn hover:bg-warn-line/40 transition-colors"
                >
                  Extend Session
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-[12px] text-warn hover:opacity-70 transition-opacity"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
          {onDismiss && (
            <div className="flex-shrink-0 ml-2">
              <button
                onClick={onDismiss}
                aria-label="Dismiss session expiry warning"
                className="text-warn hover:opacity-70 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TokenExpiryWarning
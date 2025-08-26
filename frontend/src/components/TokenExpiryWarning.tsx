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

export const TokenExpiryWarning: React.FC<TokenExpiryWarningProps> = ({
  onDismiss,
  onExtendSession
}) => {
  const { timeRemaining, showExpiryWarning } = useAuth()

  if (!showExpiryWarning) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Session Expiring Soon
            </h3>
            <div className="mt-1 text-sm text-yellow-700">
              <p>Your session will expire in:</p>
              <div className="flex items-center mt-1">
                <Clock className="h-4 w-4 mr-1" />
                <span className="font-mono font-semibold">{timeRemaining}</span>
              </div>
            </div>
            <div className="mt-3 flex space-x-2">
              {onExtendSession && (
                <button
                  onClick={onExtendSession}
                  className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 transition-colors"
                >
                  Extend Session
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-xs text-yellow-600 hover:text-yellow-800 transition-colors"
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
                className="text-yellow-400 hover:text-yellow-600 transition-colors"
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
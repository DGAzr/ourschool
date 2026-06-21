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
import { pointsApi, type StudentPoints } from '../services/points'
import { Coins, Eye, EyeOff } from 'lucide-react'

interface PointsDisplayProps {
  compact?: boolean
  className?: string
}

const PointsDisplay: React.FC<PointsDisplayProps> = ({ compact = false, className = '' }) => {
  const { user } = useAuth()
  const [points, setPoints] = useState<StudentPoints | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const [systemEnabled, setSystemEnabled] = useState(false)

  useEffect(() => {
    const loadPointsData = async () => {
      if (!user || user.role !== 'student') {
        setIsLoading(false)
        return
      }

      try {
        const status = await pointsApi.getSystemStatus()
        setSystemEnabled(status.enabled)

        if (status.enabled) {
          const pointsData = await pointsApi.getMyBalance()
          setPoints(pointsData)
        }
      } catch {
        setSystemEnabled(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadPointsData()
  }, [user])

  if (!user || user.role !== 'student' || !systemEnabled || isLoading || !points) {
    return null
  }

  const toggleVisibility = () => setIsVisible(v => !v)

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-panel-2 border border-line text-[12px] font-semibold text-ink">
          <Coins size={12} className="text-muted" />
          <span className="font-mono">{isVisible ? points.current_balance.toLocaleString() : '•••'}</span>
        </div>
        <button
          onClick={toggleVisibility}
          className="p-1 rounded text-muted hover:text-ink transition-colors"
          title={isVisible ? 'Hide points' : 'Show points'}
        >
          {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-panel border border-line rounded-card p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-field bg-panel-2 border border-line flex items-center justify-center text-muted">
            <Coins size={16} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em]">Balance</p>
            <p className="text-[22px] font-bold text-ink font-mono leading-none mt-0.5">
              {isVisible ? points.current_balance.toLocaleString() : '•••'}
            </p>
          </div>
        </div>
        <button
          onClick={toggleVisibility}
          className="p-1.5 rounded-field text-muted hover:text-ink hover:bg-panel-2 transition-colors"
          title={isVisible ? 'Hide points' : 'Show points'}
        >
          {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

export default PointsDisplay

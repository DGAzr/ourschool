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
import { Coins, TrendingUp, Eye, EyeOff } from 'lucide-react'

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
        // Check if points system is enabled
        const status = await pointsApi.getSystemStatus()
        setSystemEnabled(status.enabled)
        
        if (status.enabled) {
          const pointsData = await pointsApi.getMyBalance()
          setPoints(pointsData)
        }
      } catch (error) {
        // Failed to load points data
        setSystemEnabled(false)
      } finally {
        setIsLoading(false)
      }
    }

    loadPointsData()
  }, [user])

  // Don't render if not a student, system disabled, or still loading
  if (!user || user.role !== 'student' || !systemEnabled || isLoading) {
    return null
  }

  // Don't render if no points data
  if (!points) {
    return null
  }

  const toggleVisibility = () => {
    setIsVisible(!isVisible)
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full">
          <Coins className="h-4 w-4 mr-1" />
          <span className="font-medium">
            {isVisible ? points.current_balance.toLocaleString() : '***'}
          </span>
        </div>
        <button
          onClick={toggleVisibility}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          title={isVisible ? 'Hide points' : 'Show points'}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-500 p-2 rounded-lg">
            <Coins className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              My Points Balance
            </h3>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {isVisible ? points.current_balance.toLocaleString() : '***'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleVisibility}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
            title={isVisible ? 'Hide points' : 'Show points'}
          >
            {isVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      
      {isVisible && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
            <span>Earned: {points.total_earned.toLocaleString()}</span>
          </div>
          <div className="flex items-center">
            <span>Spent: {points.total_spent.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PointsDisplay
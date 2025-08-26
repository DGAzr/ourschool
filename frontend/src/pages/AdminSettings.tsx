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
import { settingsApi } from '../services/settings'
import { pointsApi, type PointsSystemStatus } from '../services/points'
import { Settings, Save, AlertTriangle, CheckCircle, Calendar, Coins, Key, ExternalLink } from 'lucide-react'

const AdminSettings: React.FC = () => {
  const { user } = useAuth()
  // Note: removed settings state as it was only used to extract required_days
  const [requiredDays, setRequiredDays] = useState<number>(180)
  const [pointsStatus, setPointsStatus] = useState<PointsSystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingPoints, setTogglingPoints] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can access system settings.</p>
      </div>
    )
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load attendance settings
      const groupedSettings = await settingsApi.getGroupedSettings()
      setRequiredDays(groupedSettings.attendance.required_days_of_instruction)
      
      // Load points system status
      const pointsSystemStatus = await pointsApi.getSystemStatus()
      setPointsStatus(pointsSystemStatus)
    } catch (err: any) {
      setError(`Failed to load settings: ${err.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const saveRequiredDays = async () => {
    if (requiredDays < 1 || requiredDays > 365) {
      setError('Required days must be between 1 and 365')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)
      
      await settingsApi.updateRequiredDaysOfInstruction(requiredDays)
      setSuccessMessage('Required days of instruction updated successfully!')
      
      // Reload settings to get the updated values
      await loadSettings()
    } catch (err: any) {
      setError(`Failed to update setting: ${err.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const togglePointsSystem = async () => {
    try {
      setTogglingPoints(true)
      setError(null)
      setSuccessMessage(null)
      
      const result = await pointsApi.toggleSystem()
      setSuccessMessage(`Points system ${result.enabled ? 'enabled' : 'disabled'} successfully!`)
      
      // Reload settings to get the updated status
      await loadSettings()
    } catch (err: any) {
      setError(`Failed to toggle points system: ${err.message || 'Unknown error'}`)
    } finally {
      setTogglingPoints(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Settings className="h-6 w-6 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Settings</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Configure system-wide settings that affect how OurSchool operates.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <span className="text-green-700 dark:text-green-300">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Attendance Settings */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Calendar className="h-5 w-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Attendance Settings</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="required-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Required Days of Instruction per Academic Year
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              This value is used to calculate attendance percentages. Most jurisdictions require between 160-200 instructional days per year.
            </p>
            <div className="flex items-center space-x-4">
              <input
                id="required-days"
                type="number"
                min="1"
                max="365"
                value={requiredDays}
                onChange={(e) => setRequiredDays(parseInt(e.target.value) || 180)}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
              <button
                onClick={saveRequiredDays}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* About Attendance Calculations */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">About Attendance Calculations</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Attendance percentages are calculated as: (Present Days + Late Days + Excused Days) ÷ Required Days of Instruction × 100%
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              This ensures compliance with educational requirements regardless of your actual term dates or calendar structure.
            </p>
          </div>
        </div>
      </div>

      {/* Points System Settings */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Coins className="h-5 w-5 text-yellow-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Points System</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enable Points System
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Control whether the gamification points system is active for students. When disabled, the Points Management section will be hidden from the Admin Center.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                  <p className={`font-semibold ${pointsStatus?.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {pointsStatus?.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                {pointsStatus?.can_toggle && (
                  <button
                    onClick={togglePointsSystem}
                    disabled={togglingPoints}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      pointsStatus?.enabled
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {togglingPoints ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                        {pointsStatus?.enabled ? 'Disabling...' : 'Enabling...'}
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4 inline mr-2" />
                        {pointsStatus?.enabled ? 'Disable' : 'Enable'} System
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Integration Settings */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Key className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API Integration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              External System Access
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Allow external applications to access OurSchool's API using secure API keys. This enables integrations with learning platforms, behavior tracking tools, and other educational software.
            </p>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Security Notice</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    API keys provide direct access to student data and system functions. Only create keys for trusted applications and review permissions carefully.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Manage API Keys</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create and manage API keys for external integrations</p>
              </div>
              <button
                onClick={() => window.open('/admin/api-keys', '_blank')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Key className="h-4 w-4 mr-2" />
                Manage API Keys
                <ExternalLink className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
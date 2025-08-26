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

import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { SystemBackupModal } from '../components/backup/SystemBackupModal'
import { backupApi } from '../services/backup'
import { 
  HardDrive, 
  Download, 
  Upload, 
  Shield,
  AlertTriangle,
  Info
} from 'lucide-react'

const AdminBackup: React.FC = () => {
  const { user } = useAuth()
  const [showBackupModal, setShowBackupModal] = useState(false)

  const handleExport = async () => {
    // Call the actual backup API
    return await backupApi.exportSystemBackup()
  }

  const handleImport = async (data: any) => {
    // Call the actual import API
    return await backupApi.importSystemBackup(data)
  }

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can access backup functionality.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-800 rounded-lg shadow-lg">
        <div className="px-6 py-8">
          <div className="flex items-center">
            <HardDrive className="h-8 w-8 text-white mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-white">
                System Backup & Recovery
              </h1>
              <p className="text-gray-100 text-lg mt-1">
                Manage system data exports and imports
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Important Backup Information
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Always ensure you have recent backups before making significant changes to the system. 
              Backup files contain sensitive data and should be stored securely.
            </p>
          </div>
        </div>
      </div>

      {/* Backup Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Data */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-green-500 p-3 rounded-lg">
                <Download className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Export System Data
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Create a complete backup of all system data
                </p>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Includes all users, students, lessons, and assignments
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Export format: JSON with full data integrity
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Recommended frequency: Weekly or before major updates
              </div>
            </div>
            
            <button
              onClick={() => setShowBackupModal(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Create System Backup
            </button>
          </div>
        </div>

        {/* Import Data */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Import System Data
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Restore from a previous backup file
                </p>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <strong>Warning:</strong> This will replace existing data
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Only import backup files from this system
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4 mr-2" />
                Create a backup before importing to restore if needed
              </div>
            </div>
            
            <button
              disabled
              className="w-full bg-gray-400 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed"
            >
              Import Feature Coming Soon
            </button>
          </div>
        </div>
      </div>

      {/* Backup History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Recent Backup Activity
          </h3>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Backup history tracking will be implemented in a future update.</p>
            <p className="text-sm mt-2">For now, please keep track of your backup files manually.</p>
          </div>
        </div>
      </div>

      {/* Backup Modal */}
      {showBackupModal && (
        <SystemBackupModal 
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          onExport={handleExport}
          onImport={handleImport}
        />
      )}
    </div>
  )
}

export default AdminBackup
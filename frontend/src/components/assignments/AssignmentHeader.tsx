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

interface AssignmentHeaderProps {
  isAdmin: boolean
  adminViewMode: 'templates' | 'grading'
  setAdminViewMode: (mode: 'templates' | 'grading') => void
  onCreateTemplate: () => void
  onImportTemplate: () => void
  onBulkExport: () => void
  selectedTemplates: Set<number>
}

const AssignmentHeader: React.FC<AssignmentHeaderProps> = ({
  isAdmin,
  adminViewMode,
  setAdminViewMode,
  onCreateTemplate,
  onImportTemplate,
  onBulkExport,
  selectedTemplates
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-xl shadow-lg">
      <div className="px-8 py-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-wide mb-1">
                {isAdmin ? 'Assignment Management' : 'My Assignments'}
              </h1>
              <p className="text-blue-100 text-lg">
                {isAdmin 
                  ? 'Create and manage assignment templates and student assignments'
                  : 'Track your assigned work and submissions'
                }
              </p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center space-x-4">
              {/* Admin View Mode Toggle */}
              <div className="flex bg-white bg-opacity-20 rounded-lg p-1">
                <button
                  onClick={() => setAdminViewMode('templates')}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                    adminViewMode === 'templates'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-white hover:bg-white hover:bg-opacity-20'
                  }`}
                >
                  Templates
                </button>
                <button
                  onClick={() => setAdminViewMode('grading')}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                    adminViewMode === 'grading'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-white hover:bg-white hover:bg-opacity-20'
                  }`}
                >
                  Grading
                </button>
              </div>

              {adminViewMode === 'templates' && (
                <div className="flex space-x-3">
                  <button 
                    onClick={onImportTemplate}
                    className="inline-flex items-center px-4 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-10 hover:bg-opacity-20 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import
                  </button>
                  {selectedTemplates.size > 0 && (
                    <button 
                      onClick={onBulkExport}
                      className="inline-flex items-center px-4 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-10 hover:bg-opacity-20 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export ({selectedTemplates.size})
                    </button>
                  )}
                  <button 
                    onClick={onCreateTemplate}
                    className="inline-flex items-center px-6 py-3 border border-white border-opacity-30 text-sm font-semibold rounded-lg text-white bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Template
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AssignmentHeader
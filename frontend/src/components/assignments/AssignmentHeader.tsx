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
import { Upload, Zap, Download, Plus } from 'lucide-react'

interface AssignmentHeaderProps {
  isAdmin: boolean
  adminViewMode: 'templates' | 'grading'
  setAdminViewMode: (mode: 'templates' | 'grading') => void
  onCreateTemplate: () => void
  onQuickAssign: () => void
  onImportTemplate: () => void
  onBulkExport: () => void
  selectedTemplates: Set<number>
  pendingGradesCount?: number
}

const AssignmentHeader: React.FC<AssignmentHeaderProps> = ({
  isAdmin,
  adminViewMode,
  setAdminViewMode,
  onCreateTemplate,
  onQuickAssign,
  onImportTemplate,
  onBulkExport,
  selectedTemplates,
  pendingGradesCount = 0,
}) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-1">
          {isAdmin ? 'Library' : 'My Work'}
        </p>
        <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em] leading-none">
          {isAdmin ? 'Assignments' : 'My Assignments'}
        </h1>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-panel-2 border border-line rounded-field p-0.5">
            <button
              onClick={() => setAdminViewMode('templates')}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-[6px] transition-colors ${
                adminViewMode === 'templates'
                  ? 'bg-panel text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setAdminViewMode('grading')}
              className={`relative px-3 py-1.5 text-[12px] font-semibold rounded-[6px] transition-colors ${
                adminViewMode === 'grading'
                  ? 'bg-panel text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Grading
              {pendingGradesCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-accent text-btn-primary-fg text-[9px] font-bold rounded-full flex items-center justify-center">
                  {pendingGradesCount}
                </span>
              )}
            </button>
          </div>

          {adminViewMode === 'templates' && (
            <>
              <button
                onClick={onQuickAssign}
                className="h-[34px] px-3 text-[13px] font-semibold rounded-field border border-btn-border bg-panel text-ink hover:bg-track transition-colors flex items-center gap-1.5"
              >
                <Zap size={13} />
                Quick Assign
              </button>
              <button
                onClick={onImportTemplate}
                className="h-[34px] px-3 text-[13px] font-semibold rounded-field border border-btn-border bg-panel text-ink hover:bg-track transition-colors flex items-center gap-1.5"
              >
                <Upload size={13} />
                Import
              </button>
              {selectedTemplates.size > 0 && (
                <button
                  onClick={onBulkExport}
                  className="h-[34px] px-3 text-[13px] font-semibold rounded-field border border-btn-border bg-panel text-ink hover:bg-track transition-colors flex items-center gap-1.5"
                >
                  <Download size={13} />
                  Export {selectedTemplates.size}
                </button>
              )}
              <button
                onClick={onCreateTemplate}
                className="h-[34px] px-4 text-[13px] font-semibold rounded-field bg-btn-primary-bg text-btn-primary-fg hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <Plus size={14} />
                New template
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AssignmentHeader

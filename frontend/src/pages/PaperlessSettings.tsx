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
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import PaperlessIntegrationPanel from '../components/paperless/PaperlessIntegrationPanel'

/**
 * Settings → Integrations → Paperless-NGX — the standalone, deep-linkable
 * page. The management UI itself lives in PaperlessIntegrationPanel, which is
 * also embedded in the Admin Center's Integrations shelf.
 */
const PaperlessSettings: React.FC = () => {
  const { user } = useAuth()

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <AlertTriangle size={40} className="text-neg-fg mx-auto mb-3" />
          <h2 className="text-[18px] font-semibold text-ink">Access Denied</h2>
          <p className="text-[13px] text-muted mt-1">
            Only administrators can manage integrations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[700px] mx-auto space-y-6">
      {/* Header + breadcrumb */}
      <div>
        <p className="flex items-center gap-1 text-[11px] font-semibold text-faint uppercase tracking-[.06em] mb-0.5">
          <Link to="/admin" className="hover:text-ink transition-colors">
            Settings
          </Link>
          <ChevronRight size={11} />
          <span>Integrations</span>
          <ChevronRight size={11} />
          <span className="text-muted">Paperless-NGX</span>
        </p>
        <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em]">
          Paperless-NGX
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          Pull scanned lesson materials from your document server into planning,
          the Materials library, and assignments.
        </p>
      </div>

      <PaperlessIntegrationPanel />
    </div>
  )
}

export default PaperlessSettings

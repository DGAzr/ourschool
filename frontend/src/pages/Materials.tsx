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

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FolderOpen, RefreshCw, Search } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { usePaperlessStatus } from '../hooks/usePaperlessStatus'
import { usePaperlessDocuments } from '../hooks/usePaperlessDocuments'
import { subjectsApi } from '../services/subjects'
import { getErrorMessage } from '../services/api'
import { Subject } from '../types/subject'
import { MaterialKind, PaperlessDocument } from '../types/paperless'
import { Button, EmptyState, Spinner, useToast } from '../components/ui'
import SyncPill from '../components/paperless/SyncPill'
import FacetRail from '../components/materials/FacetRail'
import DocumentCard from '../components/materials/DocumentCard'
import DocumentDetailDrawer from '../components/materials/DocumentDetailDrawer'
import {
  resultCountLabel,
  toggleFacetValue,
} from '../components/materials/materialsLogic'

/**
 * Materials — a browsable mirror of the Paperless-NGX library: facet rail
 * (document type + subject), full-text search, document grid, and a detail
 * drawer with "Add to a lesson".
 */
const Materials: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { status, loading: statusLoading, syncing, syncNow } = usePaperlessStatus()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedKinds, setSelectedKinds] = useState<MaterialKind[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [openDoc, setOpenDoc] = useState<PaperlessDocument | null>(null)

  const connected = status?.connected === true
  const {
    documents,
    facets,
    total,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
  } = usePaperlessDocuments({
    subjectIds: selectedSubjects,
    kinds: selectedKinds,
    query,
    enabled: connected,
  })

  useEffect(() => {
    subjectsApi
      .getAll()
      .then(setSubjects)
      .catch(() => setSubjects([]))
  }, [])

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <AlertTriangle size={40} className="text-neg-fg mx-auto mb-3" />
          <h2 className="text-[18px] font-semibold text-ink">Access Denied</h2>
          <p className="text-[13px] text-muted mt-1">
            Only administrators can browse the material library.
          </p>
        </div>
      </div>
    )
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted">
        <Spinner size="sm" />
        Loading…
      </div>
    )
  }

  if (!connected) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Connect Paperless-NGX to browse materials"
        subtext="The Materials library mirrors your document server — worksheets, tests and reference sheets, organized by subject."
        action={
          <Button onClick={() => navigate('/admin/settings/paperless')}>
            Set up the integration
          </Button>
        }
      />
    )
  }

  const handleSyncNow = async () => {
    try {
      const result = await syncNow()
      toast(
        result.truncated
          ? `Synced ${result.document_count} documents — partial sync, see Settings`
          : `Synced ${result.document_count} documents`
      )
      refresh()
    } catch (err) {
      toast(getErrorMessage(err, 'Sync failed'), 'danger')
    }
  }

  const subjectById = new Map(subjects.map((s) => [s.id, s]))

  return (
    // Break out of the page padding so the facet rail can run full height.
    // h-screen (not h-full) fills the viewport: with -m-7, h-full resolves to
    // 100vh minus the Layout padding and leaves a gap at the bottom.
    <div className="flex h-screen -m-7 min-h-0">
      <FacetRail
        facets={facets}
        subjects={subjects}
        selectedKinds={selectedKinds}
        selectedSubjects={selectedSubjects}
        onToggleKind={(kind) =>
          setSelectedKinds((prev) => toggleFacetValue(prev, kind))
        }
        onToggleSubject={(id) =>
          setSelectedSubjects((prev) => toggleFacetValue(prev, id))
        }
      />

      <div className="flex-1 min-w-0 overflow-y-auto px-8 pt-7 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[27px] font-bold text-ink tracking-[-0.02em]">
              Material Library
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              Everything on your Paperless server, organized for planning.
            </p>
          </div>
          <div className="flex items-center gap-2.5 pt-1.5">
            <SyncPill
              lastSyncAt={status?.last_sync_at}
              status={status?.last_sync_status}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncNow}
              loading={syncing}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Sync now
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-[420px] mt-5">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, text and curriculum…"
            className="w-full h-10 pl-9 pr-3 rounded-[10px] border border-field-border bg-panel text-[13px] text-ink placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <p className="mt-3 mb-4 text-[12px] text-faint">
          {loading ? 'Loading…' : resultCountLabel(total)}
        </p>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Grid */}
        {!loading && documents.length === 0 && !error ? (
          <p className="py-16 text-center text-[13.5px] text-faint">
            No documents match those filters.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-3.5">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  subject={
                    doc.subject_id ? subjectById.get(doc.subject_id) : undefined
                  }
                  onOpen={setOpenDoc}
                />
              ))}
            </div>
            {!loading && hasMore && (
              <div className="flex flex-col items-center gap-1.5 mt-6">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadMore}
                  loading={loadingMore}
                >
                  Load more
                </Button>
                <span className="text-[12px] text-faint">
                  Showing {documents.length} of {total}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <DocumentDetailDrawer
        doc={openDoc}
        subjects={subjects}
        onClose={() => setOpenDoc(null)}
        onAttached={refresh}
      />
    </div>
  )
}

export default Materials

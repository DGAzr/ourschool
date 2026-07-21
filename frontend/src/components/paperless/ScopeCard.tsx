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

import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Filter } from 'lucide-react'

import { Button, Spinner } from '../ui'
import { paperlessApi } from '../../services/paperless'
import { getErrorMessage } from '../../services/api'
import { PaperlessScopeOptions, PaperlessStatus } from '../../types/paperless'
import ScopeChecklist from './ScopeChecklist'
import { scopeEquals, scopeMatchesNothing, toggleId } from './scopeLogic'

interface ScopeCardProps {
  status: PaperlessStatus
  syncing: boolean
  onSave: (tagIds: number[], doctypeIds: number[]) => Promise<void>
}

/**
 * Edit the sync scope after connecting: live tag/doctype checklists from the
 * server, a draft selection diffed against the stored scope, and a single
 * "Save & re-sync" action (PATCH + POST /sync in the parent).
 */
const ScopeCard: React.FC<ScopeCardProps> = ({ status, syncing, onSave }) => {
  const [options, setOptions] = useState<PaperlessScopeOptions | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tagIds, setTagIds] = useState<number[]>(status.scope_tag_ids)
  const [doctypeIds, setDoctypeIds] = useState<number[]>(status.scope_doctype_ids)
  const [saving, setSaving] = useState(false)

  const loadOptions = useCallback(() => {
    return paperlessApi
      .getScopeOptions()
      .then((data) => {
        setOptions(data)
        setLoadError(null)
      })
      .catch((err) =>
        setLoadError(
          getErrorMessage(err, 'Couldn’t reach Paperless to load tags.')
        )
      )
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  const handleRetry = () => {
    setLoadError(null)
    setOptions(null)
    loadOptions()
  }

  const dirty = !scopeEquals(
    { tagIds, doctypeIds },
    { tagIds: status.scope_tag_ids, doctypeIds: status.scope_doctype_ids }
  )
  const matchesNothing =
    options !== null &&
    scopeMatchesNothing(tagIds, doctypeIds, options.tags, options.document_types)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(tagIds, doctypeIds)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-panel border border-line rounded-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Filter className="h-4 w-4 text-faint" />
        <h2 className="text-[15px] font-semibold text-ink">Sync scope</h2>
      </div>
      <p className="text-[13px] text-muted mb-4">
        Limit the import to the tags and document types that matter for
        school — everything else stays in Paperless.
      </p>

      {loadError ? (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{loadError}</span>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            Try again
          </Button>
        </div>
      ) : options === null ? (
        <div className="flex items-center gap-2 py-4 text-[13px] text-muted">
          <Spinner size="sm" />
          Loading tags and document types…
        </div>
      ) : (
        <>
          <ScopeChecklist
            tags={options.tags}
            documentTypes={options.document_types}
            selectedTagIds={tagIds}
            selectedDoctypeIds={doctypeIds}
            disabled={saving || syncing}
            onToggleTag={(id) => setTagIds((prev) => toggleId(prev, id))}
            onToggleDoctype={(id) => setDoctypeIds((prev) => toggleId(prev, id))}
          />
          {matchesNothing && (
            <p className="mt-2 text-[12.5px] text-warn">
              The selected items currently match 0 documents.
            </p>
          )}
          <div className="flex justify-end pt-3">
            <Button
              onClick={handleSave}
              loading={saving || syncing}
              disabled={!dirty}
            >
              {saving || syncing ? 'Re-syncing…' : 'Save & re-sync'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default ScopeCard

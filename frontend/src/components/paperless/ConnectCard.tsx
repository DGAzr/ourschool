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
import { AlertTriangle, CheckCircle } from 'lucide-react'

import { Button, Input } from '../ui'
import { paperlessApi } from '../../services/paperless'
import { getErrorMessage } from '../../services/api'
import { PaperlessTestResult } from '../../types/paperless'
import ScopeChecklist from './ScopeChecklist'
import { toggleId } from './scopeLogic'

interface ConnectCardProps {
  /** Reconnect mode: a connection exists but its token can't be decrypted. */
  needsReconnect?: boolean
  /** Edit mode: change the URL/token of an already-connected server. */
  editing?: boolean
  /** Prefill the server URL (edit mode — the token is never retrievable). */
  initialUrl?: string
  /** Stored scope to prefill on reconnect/edit (ids no longer on the server drop). */
  initialScope?: { tagIds: number[]; doctypeIds: number[] }
  /** Cancel out of edit mode without saving. */
  onCancel?: () => void
  onConnect: (
    url: string,
    token: string,
    scopeTagIds: number[],
    scopeDoctypeIds: number[]
  ) => Promise<unknown>
}

/**
 * First-run / disconnected state: server URL + API token inputs, a
 * "Test connection" step that reveals a verified banner plus the sync-scope
 * checklists, and the primary "Connect & import" action (which runs the
 * initial — scoped — sync server-side).
 *
 * Also serves the "edit connection" flow: `editing` prefills the URL and
 * re-labels the actions; the token still has to be re-entered.
 */
const ConnectCard: React.FC<ConnectCardProps> = ({
  needsReconnect,
  editing,
  initialUrl,
  initialScope,
  onCancel,
  onConnect,
}) => {
  const [urlDraft, setUrlDraft] = useState(initialUrl ?? '')
  const [tokenDraft, setTokenDraft] = useState('')
  const [testing, setTesting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [tested, setTested] = useState<PaperlessTestResult | null>(null)
  const [scopeTagIds, setScopeTagIds] = useState<number[]>([])
  const [scopeDoctypeIds, setScopeDoctypeIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const canSubmit = urlDraft.trim().length > 0 && tokenDraft.trim().length > 0

  const resetTested = () => {
    setTested(null)
    setScopeTagIds([])
    setScopeDoctypeIds([])
  }

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    resetTested()
    try {
      const result = await paperlessApi.test(urlDraft.trim(), tokenDraft.trim())
      setTested(result)
      // Reconnect: seed with the stored scope, minus ids the server no
      // longer knows.
      if (initialScope) {
        const tagIds = new Set(result.tags.map((t) => t.id))
        const doctypeIds = new Set(result.document_types.map((d) => d.id))
        setScopeTagIds(initialScope.tagIds.filter((id) => tagIds.has(id)))
        setScopeDoctypeIds(
          initialScope.doctypeIds.filter((id) => doctypeIds.has(id))
        )
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reach the Paperless server.'))
    } finally {
      setTesting(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      // Without a prior test the checklists never showed: empty scope =
      // import everything.
      await onConnect(
        urlDraft.trim(),
        tokenDraft.trim(),
        scopeTagIds,
        scopeDoctypeIds
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Connection failed.'))
      setConnecting(false)
    }
    // On success the parent swaps this card out; no local reset needed.
  }

  return (
    <div
      className={`bg-panel border border-line rounded-card p-6 ${
        tested ? 'max-w-[600px]' : 'max-w-[460px]'
      }`}
    >
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center font-mono text-[11px] font-bold text-white mb-4"
        style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)' }}
      >
        NGX
      </div>
      <h2 className="text-[17px] font-semibold text-ink">
        {editing
          ? 'Edit Paperless connection'
          : needsReconnect
            ? 'Reconnect Paperless-NGX'
            : 'Connect Paperless-NGX'}
      </h2>
      <p className="mt-1 mb-5 text-[13px] text-muted">
        {editing
          ? 'Update the server URL and re-enter your API token. Saving re-tests the connection and runs a fresh sync.'
          : needsReconnect
            ? 'The stored API token can no longer be read (the server secret changed). Enter your credentials again to reconnect.'
            : 'Pull scanned worksheets, tests and reference sheets from your document server straight into lesson planning.'}
      </p>

      <div className="space-y-4">
        <Input
          label="Server URL"
          placeholder="https://paperless.local:8000"
          value={urlDraft}
          onChange={(e) => {
            setUrlDraft(e.target.value)
            resetTested()
          }}
          autoComplete="off"
        />
        <Input
          label="API token"
          type="password"
          placeholder="Paste a read-scope token"
          helperText="Create one in Paperless under Settings → API Tokens. Read scope is enough."
          value={tokenDraft}
          onChange={(e) => {
            setTokenDraft(e.target.value)
            resetTested()
          }}
          autoComplete="off"
        />

        {tested && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-card text-[13px] text-pos-fg bg-pos-bg border border-pos-fg/20">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              Connection verified · found {tested.document_count} documents,{' '}
              {tested.tag_count} tags, {tested.document_type_count} document types.
            </span>
          </div>
        )}

        {tested && (
          <div className="pt-1">
            <p className="text-[13px] font-medium text-ink mb-2">
              Choose what to sync{' '}
              <span className="font-normal text-muted">(optional)</span>
            </p>
            <ScopeChecklist
              tags={tested.tags}
              documentTypes={tested.document_types}
              selectedTagIds={scopeTagIds}
              selectedDoctypeIds={scopeDoctypeIds}
              disabled={connecting}
              onToggleTag={(id) => setScopeTagIds((prev) => toggleId(prev, id))}
              onToggleDoctype={(id) =>
                setScopeDoctypeIds((prev) => toggleId(prev, id))
              }
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {editing && onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={testing || connecting}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={handleTest}
            loading={testing}
            disabled={!canSubmit || connecting}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </Button>
          <Button
            onClick={handleConnect}
            loading={connecting}
            disabled={!canSubmit || testing}
          >
            {connecting
              ? editing
                ? 'Saving…'
                : 'Importing…'
              : editing
                ? 'Save & re-sync'
                : 'Connect & import'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConnectCard

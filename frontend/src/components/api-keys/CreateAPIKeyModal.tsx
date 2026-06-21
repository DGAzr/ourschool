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

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  apiKeysApi,
  type APIKeyCreate,
  type APIKeyWithSecret,
  type AvailablePermissions,
  formatExpiration
} from '../../services/apiKeys'
import {
  Calendar,
  Lock,
  AlertTriangle,
  Key,
  Check,
  Copy
} from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-faintest w-full'
const LABEL = 'block text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5'

interface CreateAPIKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  error?: string | null
  setError?: (error: string | null) => void
}

const CreateAPIKeyModal: React.FC<CreateAPIKeyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  setError
}) => {
  const [createForm, setCreateForm] = useState<APIKeyCreate>({
    name: '',
    permissions: [],
    expires_at: undefined
  })

  const [availablePermissions, setAvailablePermissions] = useState<AvailablePermissions | null>(null)
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<APIKeyWithSecret | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleCreateAPIKey = useCallback(async () => {
    if (!createForm.name.trim()) { setError?.('API key name is required'); return }
    if (createForm.permissions.length === 0) { setError?.('At least one permission is required'); return }

    try {
      setCreating(true)
      setError?.(null)
      const newKey = await apiKeysApi.createAPIKey(createForm)
      setCreatedKey(newKey)
      onSuccess()
    } catch (err: any) {
      setError?.(err.message || 'Failed to create API key')
    } finally {
      setCreating(false)
    }
  }, [createForm, setError, onSuccess])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return
    switch (event.key) {
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          if (!createdKey) handleCreateAPIKey()
          else handleClose()
        }
        break
      case 'c':
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && createdKey) {
          event.preventDefault()
          copyAPIKey()
        }
        break
    }
  }, [isOpen, createdKey, handleCreateAPIKey])

  useEffect(() => {
    if (!isOpen) return
    if (!createdKey) {
      const timer = setTimeout(() => nameInputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, createdKey])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  useEffect(() => {
    if (isOpen && !availablePermissions) loadPermissions()
  }, [isOpen, availablePermissions])

  const loadPermissions = async () => {
    try {
      const permissions = await apiKeysApi.getAvailablePermissions()
      setAvailablePermissions(permissions)
    } catch (err: any) {
      setError?.(err.message || 'Failed to load permissions')
    }
  }

  const resetModal = () => {
    setCreateForm({ name: '', permissions: [], expires_at: undefined })
    setCreatedKey(null)
    setCopiedKey(false)
    setCreating(false)
    setError?.(null)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const copyAPIKey = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey.api_key)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = createdKey.api_key
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const togglePermission = (permission: string) => {
    setCreateForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  const toggleCategoryPermissions = (category: string) => {
    if (!availablePermissions) return
    const categoryPermissions = availablePermissions.permissions
      .filter(p => p.category === category)
      .map(p => p.permission)
    const allSelected = categoryPermissions.every(p => createForm.permissions.includes(p))
    setCreateForm(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !categoryPermissions.includes(p))
        : [...new Set([...prev.permissions, ...categoryPermissions])]
    }))
  }

  if (!createdKey) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Create API Key"
        icon={<Key size={15} />}
        iconVariant="accent"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleClose} disabled={creating}>Cancel</Button>
            <Button
              variant="primary"
              loading={creating}
              disabled={creating || !createForm.name.trim() || createForm.permissions.length === 0}
              onClick={handleCreateAPIKey}
            >
              Create API Key
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Security notice */}
          <div className="flex items-start gap-2.5 bg-warn-soft border border-warn-line rounded-[11px] p-4 text-[13px] text-ink-2">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-warn" />
            <div>
              <span className="font-semibold text-ink">Security Notice — </span>
              API keys provide direct access to your OurSchool data. Store them securely and only grant necessary permissions.
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="api-key-name" className={LABEL}>API Key Name *</label>
            <input
              ref={nameInputRef}
              id="api-key-name"
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCreateAPIKey() }}
              placeholder="e.g., Learning Management System Integration"
              className={FIELD}
            />
            <p className="text-[11px] text-faint mt-1">Choose a descriptive name to identify this key's purpose</p>
          </div>

          {/* Expiration */}
          <div>
            <label htmlFor="api-key-expires" className={LABEL}>Expiration Date (Optional)</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-faint pointer-events-none" />
              <input
                id="api-key-expires"
                type="date"
                value={createForm.expires_at ? createForm.expires_at.split('T')[0] : ''}
                onChange={(e) => setCreateForm(prev => ({
                  ...prev,
                  expires_at: e.target.value ? `${e.target.value}T23:59:59` : undefined
                }))}
                min={new Date().toISOString().split('T')[0]}
                className={`${FIELD} pl-9`}
              />
            </div>
            <p className="text-[11px] text-faint mt-1">Leave empty for no expiration. Recommended: set an expiration date.</p>
          </div>

          {/* Permissions */}
          <div>
            <label className={LABEL}>Permissions *</label>

            {availablePermissions ? (
              <div className="border border-field-border rounded-field overflow-hidden">
                <div className="max-h-60 overflow-y-auto divide-y divide-line p-4 space-y-4 bg-field-bg">
                  {availablePermissions.categories.map(category => {
                    const categoryPermissions = availablePermissions.permissions.filter(p => p.category === category)
                    const selectedCount = categoryPermissions.filter(p => createForm.permissions.includes(p.permission)).length
                    const allSelected = selectedCount === categoryPermissions.length
                    const someSelected = selectedCount > 0 && !allSelected

                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={input => { if (input) input.indeterminate = someSelected }}
                              onChange={() => toggleCategoryPermissions(category)}
                              className="h-3.5 w-3.5 accent-[var(--accent)] rounded"
                            />
                            <span className="text-[13px] font-semibold text-ink">{category}</span>
                          </label>
                          <span className="text-[11px] text-faint">{selectedCount}/{categoryPermissions.length}</span>
                        </div>
                        <div className="ml-5 space-y-1.5">
                          {categoryPermissions.map(permission => (
                            <label key={permission.permission} className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={createForm.permissions.includes(permission.permission)}
                                onChange={() => togglePermission(permission.permission)}
                                className="h-3 w-3 mt-0.5 accent-[var(--accent)] rounded flex-shrink-0"
                              />
                              <span className="text-[12px] text-ink">{permission.permission}</span>
                              <span className="text-[12px] text-faint">— {permission.description}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-6 border border-field-border rounded-field bg-field-bg">
                <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin" />
                <span className="text-[13px] text-muted">Loading permissions...</span>
              </div>
            )}

            <p className="text-[11px] text-faint mt-1.5">
              Selected: {createForm.permissions.length} permission{createForm.permissions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </Modal>
    )
  }

  // Success state
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="API Key Created"
      icon={<Check size={15} />}
      iconVariant="pos"
      size="lg"
      footer={
        <Button variant="primary" onClick={handleClose}>Done</Button>
      }
    >
      <div className="space-y-5">
        {/* Critical warning */}
        <div className="flex items-start gap-2.5 bg-danger-soft border border-danger-line rounded-[11px] p-4 text-[13px] text-ink-2">
          <Lock size={15} className="flex-shrink-0 mt-0.5 text-danger" />
          <div>
            <span className="font-semibold text-ink">Important: Save Your API Key — </span>
            This is the only time you'll see the full key. Copy it now and store it securely. If you lose it, you'll need to create a new one.
          </div>
        </div>

        {/* Key details */}
        <div className="bg-panel-2 border border-line rounded-[11px] p-4 space-y-4">
          <div>
            <p className={LABEL}>Key Name</p>
            <p className="text-[13px] text-ink">{createdKey.name}</p>
          </div>

          <div>
            <p className={LABEL}>API Key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-field-bg border border-field-border rounded-field px-3 py-2 text-[12px] font-mono text-ink break-all">
                {createdKey.api_key}
              </code>
              <button
                onClick={copyAPIKey}
                className={`flex-shrink-0 h-[34px] px-3 rounded-field text-[13px] font-medium flex items-center gap-1.5 transition-colors ${
                  copiedKey
                    ? 'bg-pos-soft text-pos border border-pos/20'
                    : 'bg-btn-primary-bg text-btn-primary-fg'
                }`}
              >
                {copiedKey ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </button>
            </div>
          </div>

          <div>
            <p className={LABEL}>Permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {createdKey.permissions.map(permission => (
                <span key={permission} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent">
                  {permission}
                </span>
              ))}
            </div>
          </div>

          {createdKey.expires_at && (
            <div>
              <p className={LABEL}>Expires</p>
              <p className="text-[13px] text-ink">{formatExpiration(createdKey.expires_at)}</p>
            </div>
          )}
        </div>

        {/* Usage instructions */}
        <div className="bg-panel-2 border border-line rounded-[11px] p-4">
          <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-3">Using Your API Key</h4>
          <p className="text-[13px] text-muted mb-2">Include this header in your API requests:</p>
          <code className="block bg-field-bg border border-field-border rounded-field px-3 py-2 text-[12px] font-mono text-ink mb-2 break-all">
            Authorization: Bearer {createdKey.api_key}
          </code>
          <p className="text-[13px] text-muted">
            Base URL: <code className="bg-field-bg border border-field-border px-1.5 py-0.5 rounded text-[11px] font-mono text-ink">{window.location.origin}/api</code>
          </p>
        </div>
      </div>
    </Modal>
  )
}

export default CreateAPIKeyModal

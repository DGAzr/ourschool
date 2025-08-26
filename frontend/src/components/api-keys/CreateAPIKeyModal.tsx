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
  X,
  Calendar,
  Lock,
  AlertTriangle,
  Key,
  Check,
  Copy
} from 'lucide-react'

interface CreateAPIKeyModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should be closed */
  onClose: () => void
  /** Callback when API key is successfully created */
  onSuccess: () => void
  /** Error message to display */
  error?: string | null
  /** Function to set error message */
  setError?: (error: string | null) => void
}

/**
 * Modal component for creating new API keys with comprehensive security features.
 * 
 * Features:
 * - Two-step process: creation form and success view
 * - Permission selection with category grouping
 * - Security warnings and best practices guidance
 * - Copy-to-clipboard functionality
 * - Usage instructions with example code
 * - Dark mode support
 */
const CreateAPIKeyModal: React.FC<CreateAPIKeyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  setError
}) => {
  // Form state
  const [createForm, setCreateForm] = useState<APIKeyCreate>({
    name: '',
    permissions: [],
    expires_at: undefined
  })
  
  // Modal state
  const [availablePermissions, setAvailablePermissions] = useState<AvailablePermissions | null>(null)
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<APIKeyWithSecret | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  
  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return

    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        handleClose()
        break
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          if (!createdKey) {
            handleCreateAPIKey()
          } else {
            handleClose()
          }
        }
        break
      case 'c':
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && createdKey) {
          event.preventDefault()
          copyAPIKey()
        }
        break
    }
  }, [isOpen, createdKey])

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    // Focus the name input when modal opens (only in creation mode)
    if (!createdKey) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen, createdKey])

  // Keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, handleKeyDown])

  // Load permissions when modal opens
  useEffect(() => {
    if (isOpen && !availablePermissions) {
      loadPermissions()
    }
  }, [isOpen, availablePermissions])

  const loadPermissions = async () => {
    try {
      const permissions = await apiKeysApi.getAvailablePermissions()
      setAvailablePermissions(permissions)
    } catch (err: any) {
      if (setError) {
        setError(err.response?.data?.detail || 'Failed to load permissions')
      }
    }
  }

  const resetModal = () => {
    setCreateForm({ name: '', permissions: [], expires_at: undefined })
    setCreatedKey(null)
    setCopiedKey(false)
    setCreating(false)
    if (setError) {
      setError(null)
    }
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handleCreateAPIKey = async () => {
    if (!createForm.name.trim()) {
      if (setError) {
        setError('API key name is required')
      }
      return
    }
    
    if (createForm.permissions.length === 0) {
      if (setError) {
        setError('At least one permission is required')
      }
      return
    }

    try {
      setCreating(true)
      if (setError) {
        setError(null)
      }
      
      const newKey = await apiKeysApi.createAPIKey(createForm)
      setCreatedKey(newKey)
      onSuccess()
    } catch (err: any) {
      if (setError) {
        setError(err.response?.data?.detail || 'Failed to create API key')
      }
    } finally {
      setCreating(false)
    }
  }

  const copyAPIKey = async () => {
    if (!createdKey) return
    
    try {
      await navigator.clipboard.writeText(createdKey.api_key)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = createdKey.api_key
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
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

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-api-key-title"
        aria-describedby="create-api-key-description"
      >
        {!createdKey ? (
          /* Creation Form */
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 
                id="create-api-key-title"
                className="text-xl font-semibold text-gray-900 dark:text-gray-100"
              >
                Create API Key
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close modal (Esc)"
                title="Close modal (Esc)"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Security Warning */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">Security Notice</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      API keys provide direct access to your OurSchool data. Store them securely and only grant necessary permissions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label htmlFor="api-key-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key Name *
                </label>
                <input
                  ref={nameInputRef}
                  id="api-key-name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      handleCreateAPIKey()
                    }
                  }}
                  placeholder="e.g., Learning Management System Integration"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                  aria-describedby="api-key-name-help"
                />
                <p 
                  id="api-key-name-help"
                  className="text-sm text-gray-500 dark:text-gray-400 mt-1"
                >
                  Choose a descriptive name to identify this API key's purpose
                </p>
              </div>

              {/* Expiration Date */}
              <div>
                <label htmlFor="api-key-expires" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expiration Date (Optional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    id="api-key-expires"
                    type="date"
                    value={createForm.expires_at ? createForm.expires_at.split('T')[0] : ''}
                    onChange={(e) => setCreateForm(prev => ({ 
                      ...prev, 
                      expires_at: e.target.value ? `${e.target.value}T23:59:59` : undefined 
                    }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Leave empty for no expiration. Recommended: Set an expiration date for security
                </p>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Permissions *
                </label>
                
                {availablePermissions ? (
                  <div className="space-y-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    {availablePermissions.categories.map(category => {
                      const categoryPermissions = availablePermissions.permissions.filter(p => p.category === category)
                      const selectedCount = categoryPermissions.filter(p => createForm.permissions.includes(p.permission)).length
                      const allSelected = selectedCount === categoryPermissions.length
                      const someSelected = selectedCount > 0 && selectedCount < categoryPermissions.length
                      
                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={input => {
                                  if (input) input.indeterminate = someSelected
                                }}
                                onChange={() => toggleCategoryPermissions(category)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                {category}
                              </span>
                            </label>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {selectedCount}/{categoryPermissions.length}
                            </span>
                          </div>
                          
                          <div className="ml-6 space-y-1">
                            {categoryPermissions.map(permission => (
                              <label key={permission.permission} className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={createForm.permissions.includes(permission.permission)}
                                  onChange={() => togglePermission(permission.permission)}
                                  className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                                  {permission.permission}
                                </span>
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">
                                  - {permission.description}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading permissions...</p>
                  </div>
                )}
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Selected: {createForm.permissions.length} permission{createForm.permissions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Keyboard Shortcuts</h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p><kbd className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">Esc</kbd> - Close modal</p>
                <p><kbd className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">Ctrl+Enter</kbd> - Create API key</p>
                <p><kbd className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">Tab</kbd> - Navigate between fields</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClose}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                title="Cancel (Esc)"
              >
                Cancel
              </button>
              <button
                ref={createButtonRef}
                onClick={handleCreateAPIKey}
                disabled={creating || !createForm.name.trim() || createForm.permissions.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                title="Create API Key (Ctrl+Enter)"
                aria-describedby="create-button-help"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Create API Key
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Success View */
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="bg-green-500 p-2 rounded-full mr-3">
                  <Check className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  API Key Created Successfully
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Critical Security Warning */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start">
                  <Lock className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Important: Save Your API Key</h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      This is the only time you'll see the full API key. Copy it now and store it securely. If you lose it, you'll need to regenerate a new one.
                    </p>
                  </div>
                </div>
              </div>

              {/* API Key Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Key Name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{createdKey.name}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Key
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm font-mono break-all">
                        {createdKey.api_key}
                      </code>
                      <button
                        onClick={copyAPIKey}
                        className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                          copiedKey
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        title="Copy API key (Ctrl+Shift+C)"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Permissions
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {createdKey.permissions.map(permission => (
                        <span key={permission} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>

                  {createdKey.expires_at && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Expires
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatExpiration(createdKey.expires_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Usage Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Using Your API Key</h4>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                  <p>Include this header in your API requests:</p>
                  <code className="block bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded px-3 py-2 text-xs font-mono">
                    Authorization: Bearer {createdKey.api_key}
                  </code>
                  <p>Base URL: <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded text-xs">{window.location.origin}/api</code></p>
                </div>
              </div>
              
              {/* Keyboard Shortcuts Help for Success View */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Keyboard Shortcuts</h4>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <p><kbd className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded text-xs">Esc</kbd> - Close modal</p>
                  <p><kbd className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded text-xs">Ctrl+Enter</kbd> - Close modal</p>
                  <p><kbd className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded text-xs">Ctrl+Shift+C</kbd> - Copy API key</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="Done (Esc or Ctrl+Enter)"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateAPIKeyModal
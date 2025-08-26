# API Key Management Components

This directory contains reusable React components for managing API keys in the OurSchool homeschool management system.

## Components

### `APIKeyTable`
Main table component for displaying and managing API keys.

**Features:**
- Sortable columns for key information
- Expandable rows showing detailed statistics
- Action buttons for enable/disable and delete
- Auto-refresh controls with 30-second intervals
- Status indicators with color coding
- Responsive design for mobile devices

**Props:**
- `apiKeys`: Array of API keys to display
- `expandedStats`: Set of expanded API key IDs
- `onToggleStatsExpanded`: Function to toggle stats expansion
- `onToggleActive`: Function to handle enable/disable
- `onDelete`: Function to handle deletion
- `refreshing`: Loading state for refresh operations
- `autoRefresh`: Auto-refresh enabled state
- `onToggleAutoRefresh`: Function to toggle auto-refresh
- `lastRefresh`: Timestamp of last data refresh
- `onRefresh`: Function to manually refresh data

### `CreateAPIKeyModal`
Modal component for creating new API keys with comprehensive security features.

**Features:**
- Two-step process: creation form and success view
- Permission selection with category grouping
- Security warnings and best practices guidance
- Copy-to-clipboard functionality with fallback
- Usage instructions with example code
- Optional expiration date picker
- Dark mode support throughout

**Props:**
- `isOpen`: Whether the modal is open
- `onClose`: Callback when modal should be closed
- `onSuccess`: Callback when API key is successfully created
- `error`: Error message to display
- `setError`: Function to set error message

### `APIKeyDetailsPanel`
Displays detailed usage statistics and information for a specific API key.

**Features:**
- Usage statistics (permissions count, creation date, last used)
- Permission list with visual badges
- Security monitoring notice
- Loading and error states
- Real-time data updates

**Props:**
- `apiKeyId`: The ID of the API key to display details for

## Hooks

### `useAPIKeys`
Custom hook for managing API key state and operations.

**Features:**
- Centralized state management for API keys and statistics
- Auto-refresh functionality with configurable intervals
- Error handling and loading states
- CRUD operations with optimistic updates
- Statistics tracking and expandable details

**Returns:**
- `apiKeys`: Array of API key objects
- `stats`: System-wide statistics object
- `loading`: Initial loading state
- `refreshing`: Refresh operation state
- `error`: Current error message
- `expandedStats`: Set of expanded API key IDs
- `autoRefresh`: Auto-refresh enabled state
- `lastRefresh`: Timestamp of last refresh
- `refreshData`: Function to refresh data
- `toggleAPIKeyActive`: Function to enable/disable keys
- `deleteAPIKey`: Function to delete keys with confirmation
- `toggleStatsExpanded`: Function to toggle detail panels
- `toggleAutoRefresh`: Function to toggle auto-refresh
- `clearError`: Function to clear current error
- `setError`: Function to set error message

## Utilities

### `apiKeyHelpers`
Collection of utility functions for API key management.

**Functions:**
- `formatLastUsed(date)`: Format date to "time ago" format
- `formatExpiration(date)`: Format expiration date
- `getStatusColor(apiKey)`: Get CSS color class for status
- `getStatusText(apiKey)`: Get human-readable status text
- `groupPermissionsByCategory(permissions)`: Group permissions by category
- `isValidPermission(permission)`: Validate permission format
- `getPermissionDescription(permission)`: Get human-readable description
- `calculateRiskLevel(permissions)`: Calculate security risk level
- `generateAPIKeyNameSuggestion(prefix)`: Generate name suggestions

**Constants:**
- `PERMISSION_CATEGORIES`: Object mapping categories to descriptions

## Security Considerations

### API Key Creation
- Comprehensive security warnings throughout the UI
- One-time display of full API key with copy functionality
- Permission-based access control with granular options
- Optional expiration dates for time-limited access
- Clear usage instructions and examples

### Permission System
- Granular permissions following "resource:action" format
- Category-based grouping for better organization
- Risk level calculation based on assigned permissions
- Validation of permission formats and availability

### Monitoring and Audit
- Real-time usage statistics and activity tracking
- Auto-refresh capabilities for continuous monitoring
- Detailed audit information (creation date, last used, etc.)
- Security alerts and monitoring recommendations

## Usage Example

```tsx
import React, { useState } from 'react'
import { useAPIKeys } from '../hooks/useAPIKeys'
import { APIKeyTable, CreateAPIKeyModal } from '../components/api-keys'

const APIKeyManagement: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  const {
    apiKeys,
    stats,
    loading,
    error,
    expandedStats,
    toggleAPIKeyActive,
    deleteAPIKey,
    toggleStatsExpanded,
    setError
  } = useAPIKeys()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <button onClick={() => setShowCreateModal(true)}>
        Create API Key
      </button>
      
      <APIKeyTable
        apiKeys={apiKeys}
        expandedStats={expandedStats}
        onToggleStatsExpanded={toggleStatsExpanded}
        onToggleActive={toggleAPIKeyActive}
        onDelete={deleteAPIKey}
      />
      
      <CreateAPIKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => setShowCreateModal(false)}
        error={error}
        setError={setError}
      />
    </div>
  )
}
```

## Testing

Each component is designed with testability in mind:
- Clear separation of concerns
- Minimal external dependencies
- Predictable prop interfaces
- Error boundary compatibility

## Accessibility

All components follow accessibility best practices:
- Proper ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Focus management in modals
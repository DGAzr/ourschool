# API Key Management Components

Reusable administrator UI for creating, listing, inspecting, disabling, and
deleting integration API keys.

## Components

### `APIKeyTable`

Displays key metadata, status, expandable details, refresh controls, and
enable/disable and delete actions. It receives state and callbacks from
`useAPIKeys`.

### `CreateAPIKeyModal`

Loads the server-advertised permission schema, creates a key, and shows the
secret once with copy instructions. Keys may have an optional expiration.

### `APIKeyDetailsPanel`

Loads statistics and permissions for one key. `APIKeyTable` uses it for an
expanded row; it is not part of the public barrel export.

## Hooks


`frontend/src/hooks/useAPIKeys.ts` owns list and statistics loading, optimistic
active-state updates, 30-second optional auto-refresh, expanded rows, and the
delete-confirmation lifecycle. Consumers must render a confirmation dialog
when `pendingDelete` is set, then call `confirmDeleteAPIKey` or
`cancelDeleteAPIKey`.

## Service and types

`frontend/src/services/apiKeys.ts` defines the API-key types, endpoint wrapper,
and date/status formatting helpers. Permission names and descriptions come
from `GET /api/admin/api-keys/permissions`; do not duplicate a static
permission list in the frontend.

## Security Considerations

- The full secret is returned only when a key is created or regenerated.
- Store only the `os_` key in the external client that needs it.
- Grant the minimum required permissions and use expirations where practical.
- API keys represent admin automation, not student sessions. Writes that need
  an actor can use the validated `X-On-Behalf-Of` header with an active admin.
- Never log or persist the one-time secret in frontend state longer than the
  creation result requires.

## Usage

```tsx
import { APIKeyTable, CreateAPIKeyModal } from '../components/api-keys'
import { useAPIKeys } from '../hooks/useAPIKeys'
```

The Admin page is the reference integration. Keep key secrets out of fixtures
and snapshots when adding tests.

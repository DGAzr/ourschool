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

import { config } from '../config/env'
import { STORAGE_KEYS } from '../constants/auth'

// Base API configuration
const API_BASE = config.api.baseUrl

// Event other parts of the app (AuthProvider) can listen for to react to a
// server-side session invalidation.
export const UNAUTHORIZED_EVENT = 'ourschool:unauthorized'

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/** Auth-only headers (no Content-Type) for multipart/FormData requests. */
export const getAuthOnlyHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

let redirecting = false
let epoch = 0
let transitioning = false
let ownedTransition: string | null = null
const activeReads = new Set<AbortController>()
const pendingWrites = new Set<Promise<void>>()

export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter = 0) {
    super(message)
  }
}

export const credentialIdentity = (token: string | null): string | null => {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.sid ? `${payload.sid}:${payload.gen}` : token
  } catch { return token }
}

/** Cancel protected reads and discard responses belonging to an earlier identity. */
export const clearProtectedRequests = () => {
  epoch += 1
  activeReads.forEach(controller => controller.abort())
  activeReads.clear()
}

export const beginSessionTransition = async () => {
  if (transitioning) throw new ApiError('An account switch is already in progress.', 409)
  transitioning = true
  if (localStorage.getItem(STORAGE_KEYS.TRANSITION)) {
    transitioning = false
    throw new ApiError('An account switch is already in progress in another tab.', 409)
  }
  await Promise.all([...pendingWrites])
  // Pause every tab before the server rotates credentials, preventing an old
  // request's 401 from clearing storage before the replacement token arrives.
  if (localStorage.getItem(STORAGE_KEYS.TRANSITION)) throw new ApiError('An account switch is already in progress in another tab.', 409)
  ownedTransition = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEYS.TRANSITION, JSON.stringify({ started: Date.now(), owner: ownedTransition }))
}
export const endSessionTransition = () => {
  transitioning = false
  const marker = localStorage.getItem(STORAGE_KEYS.TRANSITION)
  try {
    if (marker && JSON.parse(marker).owner === ownedTransition) localStorage.removeItem(STORAGE_KEYS.TRANSITION)
  } catch {
    // A malformed marker is handled by session validation; do not mask the
    // transition result or retain this tab's local transition lock.
  } finally { ownedTransition = null }
}

const handleUnauthorized = (token: string | null) => {
  // A late rejection of older credentials must never clear a replacement session.
  if (localStorage.getItem(STORAGE_KEYS.TOKEN) !== token) return
  localStorage.removeItem(STORAGE_KEYS.TOKEN)
  localStorage.removeItem(STORAGE_KEYS.USER)
  clearProtectedRequests()
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  if (!redirecting && window.location.pathname !== '/login') {
    redirecting = true
    window.location.assign('/login')
  }
}

const parseError = async (response: Response): Promise<string> => {
  let message = `API Error: ${response.status} ${response.statusText}`
  try {
    const text = await response.text()
    if (text) {
      const data = JSON.parse(text)
      if (data?.detail) {
        message =
          typeof data.detail === 'string'
            ? data.detail
            : JSON.stringify(data.detail)
      }
    }
  } catch {
    // Non-JSON body: keep the default status-based message.
  }
  return message
}

/** Shared transport, including streamed responses and generation-aware failures. */
export const authenticatedFetch = async (endpoint: string, init: RequestInit = {}, jsonHeaders = true): Promise<Response> => {
  const isAuth = endpoint.startsWith('/auth/')
  if ((transitioning || localStorage.getItem(STORAGE_KEYS.TRANSITION)) && (!isAuth || endpoint === '/auth/extend-session')) throw new Error('An account switch is in progress.')
  const capturedToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
  const capturedEpoch = epoch
  const controller = new AbortController()
  const write = !['GET', 'HEAD'].includes(init.method ?? 'GET') && !isAuth
  let finishWrite: (() => void) | undefined
  if (write) {
    const completed = new Promise<void>(resolve => { finishWrite = resolve })
    pendingWrites.add(completed)
    void completed.then(() => pendingWrites.delete(completed))
  } else {
    activeReads.add(controller)
  }
  const abort = () => controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  if (init.signal?.aborted) controller.abort()
  const release = () => {
    activeReads.delete(controller)
    init.signal?.removeEventListener('abort', abort)
    finishWrite?.()
  }
  const guard = () => {
    if (controller.signal.aborted || capturedEpoch !== epoch || credentialIdentity(capturedToken) !== credentialIdentity(localStorage.getItem(STORAGE_KEYS.TOKEN))) {
      throw new DOMException('The account changed or the request was cancelled.', 'AbortError')
    }
  }
  const headers = init.body instanceof FormData || !jsonHeaders ? getAuthOnlyHeaders() : getAuthHeaders()
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...init, cache: 'no-store', signal: controller.signal,
      headers: { ...headers, ...(init.headers || {}) },
    })
    guard()
    if (response.status === 401) {
      handleUnauthorized(capturedToken)
      throw new ApiError('Your session has expired. Please log in again.', 401)
    }
    if (!response.ok) {
      throw new ApiError(await parseError(response), response.status, Number(response.headers.get('Retry-After') ?? 0))
    }
    if (!response.body) { release(); return response }
    // Keep cancellation and identity checks alive through the last response chunk.
    // This also preserves progress reporting for large Paperless downloads.
    const reader = response.body.getReader()
    const stream = new ReadableStream({
      async pull(output) {
        try {
          guard()
          const { done, value } = await reader.read()
          guard()
          if (done) { output.close(); release(); reader.releaseLock() }
          else output.enqueue(value)
        } catch (error) {
          output.error(error)
          void reader.cancel().catch(() => undefined)
          release()
        }
      },
      cancel() {
        controller.abort()
        release()
        return reader.cancel()
      },
    })
    return new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers })
  } catch (error) { release(); throw error }
}

const request = async (endpoint: string, init: RequestInit = {}) => {
  const response = await authenticatedFetch(endpoint, init)
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

/**
 * Extract a human-readable message from an unknown thrown value.
 * Every error raised by this API client is a plain `Error` whose message
 * already contains the parsed backend detail, so narrowing on `Error`
 * covers the real cases; anything else falls back to the provided text.
 */
export const getErrorMessage = (
  err: unknown,
  fallback = 'An unexpected error occurred'
): string => (err instanceof Error && err.message ? err.message : fallback)

export const api = {
  get: (endpoint: string, signal?: AbortSignal) =>
    request(endpoint, { method: 'GET', signal }),

  post: (endpoint: string, data?: unknown, signal?: AbortSignal) =>
    request(endpoint, { method: 'POST', body: JSON.stringify(data ?? {}), signal }),

  put: (endpoint: string, data?: unknown) =>
    request(endpoint, { method: 'PUT', body: JSON.stringify(data ?? {}) }),

  patch: (endpoint: string, data?: unknown) =>
    request(endpoint, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),

  // Multipart upload: pass a FormData; request() omits the JSON Content-Type
  // so the browser sets the multipart boundary.
  postForm: (endpoint: string, form: FormData) =>
    request(endpoint, { method: 'POST', body: form }),

  delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),

  // Authenticated binary fetch (e.g. streamed document content). Returns a
  // Blob; callers turn it into an object URL for inline viewing/downloads.
  getBlob: async (endpoint: string, signal?: AbortSignal): Promise<Blob> =>
    (await authenticatedFetch(endpoint, { method: 'GET', signal }, false)).blob(),

  extendSession: () => request('/auth/extend-session', { method: 'POST' }),
}

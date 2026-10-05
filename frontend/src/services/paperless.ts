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

import { api, authenticatedFetch } from './api'
import { config } from '../config/env'
import {
  MaterialKind,
  PaperlessDocumentDetail,
  PaperlessDocumentList,
  PaperlessMaterial,
  PaperlessScopeOptions,
  PaperlessSettingsUpdate,
  PaperlessStatus,
  PaperlessSyncResult,
  PaperlessTestResult,
} from '../types/paperless'

const BASE = '/integrations/paperless'

export interface DocumentListParams {
  subject_ids?: number[]
  kinds?: MaterialKind[]
  q?: string
  lesson_id?: number
  limit?: number
  offset?: number
}

const listQuery = (params: DocumentListParams): string => {
  const search = new URLSearchParams()
  for (const id of params.subject_ids ?? [])
    search.append('subject_id', String(id))
  for (const kind of params.kinds ?? []) search.append('kind', kind)
  if (params.q) search.set('q', params.q)
  if (params.lesson_id != null)
    search.set('lesson_id', String(params.lesson_id))
  if (params.limit != null) search.set('limit', String(params.limit))
  if (params.offset != null) search.set('offset', String(params.offset))
  const q = search.toString()
  return q ? `?${q}` : ''
}

export const paperlessApi = {
  test: (url: string, token: string): Promise<PaperlessTestResult> =>
    api.post(`${BASE}/test`, { url, token }),

  connect: (
    url: string,
    token: string,
    scopeTagIds: number[] = [],
    scopeDoctypeIds: number[] = [],
    scopeMode: 'all' | 'selected' = 'selected',
    libraryId?: string
  ): Promise<{ status: PaperlessStatus; job: PaperlessSyncResult }> =>
    api.post(`${BASE}/connect`, {
      url,
      token,
      scope_tag_ids: scopeTagIds,
      scope_doctype_ids: scopeDoctypeIds,
      scope_mode: scopeMode,
      library_id: libraryId,
    }),

  documentAvailability: (documentId: number): Promise<{ available: boolean; reason: string | null }> =>
    api.get(`${BASE}/documents/${documentId}/availability`),

  getStatus: (): Promise<PaperlessStatus> => api.get(`${BASE}/status`),

  // Live tag/doctype lists (with counts) for editing the sync scope.
  getScopeOptions: (): Promise<PaperlessScopeOptions> =>
    api.get(`${BASE}/scope-options`),

  updateSettings: (update: PaperlessSettingsUpdate): Promise<PaperlessStatus> =>
    api.patch(`${BASE}/settings`, update),

  disconnect: (): Promise<null> => api.delete(`${BASE}/connection`),

  syncNow: (): Promise<PaperlessSyncResult> => api.post(`${BASE}/sync`),

  listDocuments: (
    params: DocumentListParams = {},
    signal?: AbortSignal
  ): Promise<PaperlessDocumentList> =>
    api.get(`${BASE}/documents${listQuery(params)}`, signal),

  getSyncJob: (id: string): Promise<PaperlessSyncResult> =>
    api.get(`${BASE}/sync-jobs/${id}`),

  attachBatch: (
    target: 'lessons' | 'templates' | 'student-assignments',
    parentId: number,
    ids: number[]
  ): Promise<PaperlessMaterial[]> =>
    api.post(`${BASE}/${target}/${parentId}/materials/batch`, {
      document_ids: ids,
    }),

  getDocument: (id: number): Promise<PaperlessDocumentDetail> =>
    api.get(`${BASE}/documents/${id}`),

  attachToLesson: (
    lessonId: number,
    documentId: number
  ): Promise<PaperlessMaterial> =>
    api.post(`${BASE}/lessons/${lessonId}/materials`, {
      document_id: documentId,
    }),

  detachFromLesson: (lessonId: number, documentId: number): Promise<null> =>
    api.delete(`${BASE}/lessons/${lessonId}/materials/${documentId}`),

  attachToTemplate: (
    templateId: number,
    documentId: number
  ): Promise<PaperlessMaterial> =>
    api.post(`${BASE}/templates/${templateId}/materials`, {
      document_id: documentId,
    }),

  detachFromTemplate: (templateId: number, documentId: number): Promise<null> =>
    api.delete(`${BASE}/templates/${templateId}/materials/${documentId}`),

  // One-off materials on a single assignment instance (on top of the
  // template's permanent ones).
  attachToAssignment: (
    assignmentId: number,
    documentId: number
  ): Promise<PaperlessMaterial> =>
    api.post(`${BASE}/student-assignments/${assignmentId}/materials`, {
      document_id: documentId,
    }),

  detachFromAssignment: (
    assignmentId: number,
    documentId: number
  ): Promise<null> =>
    api.delete(
      `${BASE}/student-assignments/${assignmentId}/materials/${documentId}`
    ),

  // Protected images are fetched with authorization and shown through object URLs.
  fetchThumbnail: (externalId: string, signal?: AbortSignal): Promise<Blob> =>
    api.getBlob(`${BASE}/documents/${externalId}/thumbnail`, signal),

  previewUrl: (documentId: number): string =>
    `${config.api.baseUrl}${BASE}/documents/${documentId}/content`,

  download: async (
    documentId: number,
    signal: AbortSignal,
    progress: (loaded: number, total: number) => void
  ): Promise<{ blob: Blob; filename: string }> => {
    const response = await authenticatedFetch(
      `${BASE}/documents/${documentId}/content?disposition=attachment`,
      { signal }, false
    )
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.detail ?? `Download failed (${response.status})`)
    }
    const total = Number(response.headers.get('content-length') ?? 0)
    const chunks: ArrayBuffer[] = []
    const reader = response.body?.getReader()
    if (!reader) throw new Error('The download could not be started')
    let loaded = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value.slice().buffer as ArrayBuffer)
        loaded += value.length
        progress(loaded, total)
      }
    } finally {
      reader.releaseLock()
    }
    const disposition = response.headers.get('content-disposition') ?? ''
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    const plain = disposition.match(/filename="([^"]+)"/i)?.[1]
    let filename = plain || 'document'
    if (encoded) {
      try {
        filename = decodeURIComponent(encoded)
      } catch {
        /* Keep safe fallback */
      }
    }
    return {
      blob: new Blob(chunks, {
        type:
          response.headers.get('content-type') ?? 'application/octet-stream',
      }),
      filename,
    }
  },
}

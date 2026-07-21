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

import { api } from './api'
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
  for (const id of params.subject_ids ?? []) search.append('subject_id', String(id))
  for (const kind of params.kinds ?? []) search.append('kind', kind)
  if (params.q) search.set('q', params.q)
  if (params.lesson_id != null) search.set('lesson_id', String(params.lesson_id))
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
    scopeDoctypeIds: number[] = []
  ): Promise<PaperlessStatus> =>
    api.post(`${BASE}/connect`, {
      url,
      token,
      scope_tag_ids: scopeTagIds,
      scope_doctype_ids: scopeDoctypeIds,
    }),

  getStatus: (): Promise<PaperlessStatus> => api.get(`${BASE}/status`),

  // Live tag/doctype lists (with counts) for editing the sync scope.
  getScopeOptions: (): Promise<PaperlessScopeOptions> =>
    api.get(`${BASE}/scope-options`),

  updateSettings: (update: PaperlessSettingsUpdate): Promise<PaperlessStatus> =>
    api.patch(`${BASE}/settings`, update),

  disconnect: (): Promise<null> => api.delete(`${BASE}/connection`),

  syncNow: (): Promise<PaperlessSyncResult> => api.post(`${BASE}/sync`),

  listDocuments: (params: DocumentListParams = {}): Promise<PaperlessDocumentList> =>
    api.get(`${BASE}/documents${listQuery(params)}`),

  getDocument: (id: number): Promise<PaperlessDocumentDetail> =>
    api.get(`${BASE}/documents/${id}`),

  attachToLesson: (
    lessonId: number,
    documentId: number
  ): Promise<PaperlessMaterial> =>
    api.post(`${BASE}/lessons/${lessonId}/materials`, { document_id: documentId }),

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

  detachFromAssignment: (assignmentId: number, documentId: number): Promise<null> =>
    api.delete(`${BASE}/student-assignments/${assignmentId}/materials/${documentId}`),

  // Capability URL for <img src> (no auth header needed — the external_id is
  // unguessable; mirrors shopApi.imageUrl).
  thumbnailUrl: (externalId: string): string =>
    `${config.api.baseUrl}${BASE}/documents/${externalId}/thumbnail`,

  // Authenticated binary fetch of the document itself. `inline` streams the
  // PDF preview (for the in-app viewer); `attachment` the original download.
  fetchContentBlob: (
    documentId: number,
    disposition: 'inline' | 'attachment' = 'inline'
  ): Promise<Blob> =>
    api.getBlob(
      `${BASE}/documents/${documentId}/content?disposition=${disposition}`
    ),
}

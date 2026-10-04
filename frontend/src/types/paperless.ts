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

export type MaterialKind =
  'worksheet' | 'test' | 'reading' | 'reference' | 'form' | 'other'

export interface PaperlessTagMap {
  paperless_tag_id: number
  paperless_tag_name: string
  subject_id?: number | null
  auto_matched: boolean
}

export interface PaperlessDoctypeMap {
  paperless_doctype_id: number
  paperless_doctype_name: string
  material_kind: MaterialKind
}

// One Paperless tag or document type offered in the sync-scope pickers.
export interface PaperlessScopeOption {
  id: number
  name: string
  document_count: number
}

export interface PaperlessScopeOptions {
  tags: PaperlessScopeOption[]
  document_types: PaperlessScopeOption[]
}

export interface PaperlessStatus {
  connected: boolean
  library_id?: string | null
  libraries?: { id: string; url: string | null }[]
  cache_available?: boolean
  sync_interval_minutes?: number
  api_version?: number
  next_sync_at?: string | null
  last_success_at?: string | null
  active_job?: PaperlessSyncResult | null
  // A connection row exists but its token can't be decrypted any more
  // (SECRET_KEY rotated) — show "reconnect required".
  needs_reconnect: boolean
  url?: string | null
  token_masked?: string | null
  auto_import: boolean
  index_ocr: boolean
  mapped_only: boolean
  last_sync_at?: string | null
  last_sync_status?: string | null
  last_sync_error?: string | null
  document_count: number
  tag_count: number
  doctype_count: number
  mapped_subject_count: number
  // Sync scope (union semantics: any scoped tag OR a scoped doctype).
  // Empty on both axes = explicit whole-library scope; mappings include
  // tags outside roots carried by imported documents.
  scope_tag_ids: number[]
  scope_doctype_ids: number[]
  tag_maps: PaperlessTagMap[]
  doctype_maps: PaperlessDoctypeMap[]
}

export interface PaperlessTestResult {
  ok: boolean
  api_version?: number
  server_version?: string | null
  document_count: number
  tag_count: number
  document_type_count: number
  tags: PaperlessScopeOption[]
  document_types: PaperlessScopeOption[]
}

export interface PaperlessSyncResult {
  id: string
  library_id: string
  state: 'queued' | 'running' | 'ok' | 'error' | 'cancelled'
  phase: string
  processed: number
  counts: Record<string, number>
  attempt: number
  created_at: string
  started_at?: string | null
  finished_at?: string | null
  error?: string | null
}

export interface PaperlessSettingsUpdate {
  sync_interval_minutes?: number
  auto_import?: boolean
  index_ocr?: boolean
  mapped_only?: boolean
  // undefined = unchanged, [] = clear that axis. Takes effect on next sync.
  scope_tag_ids?: number[]
  scope_doctype_ids?: number[]
  tag_maps?: { paperless_tag_id: number; subject_id: number | null }[]
  doctype_maps?: { paperless_doctype_id: number; material_kind: MaterialKind }[]
}

export interface PaperlessDocument {
  id: number
  external_id: string
  paperless_id: number
  asn?: string | null
  title: string
  correspondent?: string | null
  material_kind: MaterialKind
  subject_id?: number | null
  page_count?: number | null
  paperless_modified?: string | null
  paperless_added?: string | null
  used_in_count: number
  // Present only when the list was ranked against a lesson (lesson_id param).
  match_reasons?: string[]
  attached?: boolean | null
}

export interface PaperlessDocumentFacets {
  kinds: Record<string, number>
  subjects: Record<string, number>
}

export interface PaperlessDocumentList {
  total: number
  items: PaperlessDocument[]
  facets: PaperlessDocumentFacets
}

// Referenced only through PaperlessDocumentDetail (not exported — knip).
interface DocumentLessonUsage {
  lesson_id: number
  lesson_title: string
  subject_id?: number | null
  date: string | null
}

interface DocumentTemplateUsage {
  template_id: number
  template_name: string
}

export interface PaperlessDocumentDetail extends PaperlessDocument {
  used_in: DocumentLessonUsage[]
  used_in_templates: DocumentTemplateUsage[]
}

// An attached document link (on a lesson or an assignment template) with
// display fields snapshotted at attach time. `external_id` is the linked
// document's authenticated thumbnail identifier.
export interface PaperlessMaterial {
  id: number
  document_id: number
  external_id?: string | null
  title: string
  asn?: string | null
  material_kind: MaterialKind
  subject_id?: number | null
  page_count?: number | null
  correspondent?: string | null
}

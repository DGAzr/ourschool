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

/**
 * Pure logic for assignment materials — merging a template's permanent
 * Paperless materials with an instance's one-off ones, and the assign-flow's
 * local-accumulate picker. Extracted for unit testing (mirrors
 * paperlessPickerLogic.ts).
 */

import { PaperlessMaterial } from '../../types/paperless'

export interface CombinedMaterial {
  material: PaperlessMaterial
  fromTemplate: boolean
  fromInstance: boolean
}

/**
 * One merged display list: template materials first, then instance-only
 * ones; a document attached at both levels appears once with both flags.
 */
export const combinedMaterials = (
  template: PaperlessMaterial[],
  instance: PaperlessMaterial[]
): CombinedMaterial[] => {
  const instanceIds = new Set(instance.map((m) => m.document_id))
  const combined: CombinedMaterial[] = template.map((material) => ({
    material,
    fromTemplate: true,
    fromInstance: instanceIds.has(material.document_id),
  }))
  const templateIds = new Set(template.map((m) => m.document_id))
  for (const material of instance) {
    if (!templateIds.has(material.document_id)) {
      combined.push({ material, fromTemplate: false, fromInstance: true })
    }
  }
  return combined
}

/** Union of attached document ids — the picker's exclusion list. */
export const attachedIds = (
  template: PaperlessMaterial[],
  instance: PaperlessMaterial[]
): number[] => [
  ...new Set([...template, ...instance].map((m) => m.document_id)),
]

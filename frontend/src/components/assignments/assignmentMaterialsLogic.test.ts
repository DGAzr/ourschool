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

import { describe, expect, it } from 'vitest'

import { attachedIds, combinedMaterials } from './assignmentMaterialsLogic'
import { PaperlessMaterial } from '../../types/paperless'

const makeMaterial = (
  over: Partial<PaperlessMaterial> = {}
): PaperlessMaterial => ({
  id: 1,
  document_id: 10,
  external_id: 'ext-10',
  title: 'Worksheet',
  material_kind: 'worksheet',
  ...over,
})

describe('combinedMaterials', () => {
  it('lists template materials first, then instance-only ones', () => {
    const template = [makeMaterial({ id: 1, document_id: 10 })]
    const instance = [makeMaterial({ id: 2, document_id: 20, title: 'Extra' })]
    const combined = combinedMaterials(template, instance)
    expect(combined.map((c) => c.material.document_id)).toEqual([10, 20])
    expect(combined[0]).toMatchObject({ fromTemplate: true, fromInstance: false })
    expect(combined[1]).toMatchObject({ fromTemplate: false, fromInstance: true })
  })

  it('dedupes a document attached at both levels with both flags', () => {
    const template = [makeMaterial({ id: 1, document_id: 10 })]
    const instance = [makeMaterial({ id: 2, document_id: 10 })]
    const combined = combinedMaterials(template, instance)
    expect(combined).toHaveLength(1)
    expect(combined[0]).toMatchObject({ fromTemplate: true, fromInstance: true })
  })

  it('handles empty inputs', () => {
    expect(combinedMaterials([], [])).toEqual([])
  })
})

describe('attachedIds', () => {
  it('unions document ids without duplicates', () => {
    const template = [
      makeMaterial({ document_id: 10 }),
      makeMaterial({ document_id: 20 }),
    ]
    const instance = [
      makeMaterial({ document_id: 20 }),
      makeMaterial({ document_id: 30 }),
    ]
    expect(attachedIds(template, instance)).toEqual([10, 20, 30])
  })
})

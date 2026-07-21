import { describe, expect, it } from 'vitest'

import {
  attachButtonLabel,
  docToPendingMaterial,
  pickerFooterLabel,
  pruneSelection,
  toggleSelection,
  topSuggestions,
  withAttachedFlags,
} from './paperlessPickerLogic'
import { PaperlessDocument } from '../../types/paperless'

const makeDoc = (over: Partial<PaperlessDocument> = {}): PaperlessDocument => ({
  id: 1,
  external_id: 'x',
  paperless_id: 10,
  title: 'Doc',
  material_kind: 'worksheet',
  used_in_count: 0,
  ...over,
})

describe('toggleSelection', () => {
  it('toggles ids in and out', () => {
    expect(toggleSelection([], 3)).toEqual([3])
    expect(toggleSelection([3], 5)).toEqual([3, 5])
    expect(toggleSelection([3, 5], 3)).toEqual([5])
  })
})

describe('pruneSelection', () => {
  it('drops ids that are attached or no longer in the list', () => {
    const docs = [
      makeDoc({ id: 1 }),
      makeDoc({ id: 2, attached: true }),
      makeDoc({ id: 3 }),
    ]
    expect(pruneSelection([1, 2, 3, 4], docs)).toEqual([1, 3])
  })
})

describe('withAttachedFlags', () => {
  it('merges caller-side attachment ids into the flags', () => {
    const docs = [makeDoc({ id: 1 }), makeDoc({ id: 2 })]
    const flagged = withAttachedFlags(docs, [2])
    expect(flagged[0].attached).toBeUndefined()
    expect(flagged[1].attached).toBe(true)
  })

  it('returns the same array when there is nothing to merge', () => {
    const docs = [makeDoc({ id: 1 })]
    expect(withAttachedFlags(docs, [])).toBe(docs)
  })
})

describe('labels', () => {
  it('pickerFooterLabel names the subject scope when known', () => {
    expect(pickerFooterLabel(2, 6, 'Mathematics')).toBe(
      '2 selected · 6 in Mathematics'
    )
    expect(pickerFooterLabel(0, 3, null)).toBe('0 selected · 3 available')
  })

  it('attachButtonLabel reads "Select documents" when empty', () => {
    expect(attachButtonLabel(0)).toBe('Select documents')
    expect(attachButtonLabel(1)).toBe('Attach 1 to lesson')
    expect(attachButtonLabel(3, 'assignment')).toBe('Attach 3 to assignment')
  })
})

describe('topSuggestions', () => {
  it('takes the first N unattached docs (list is already ranked)', () => {
    const docs = [
      makeDoc({ id: 1, attached: true }),
      makeDoc({ id: 2 }),
      makeDoc({ id: 3 }),
      makeDoc({ id: 4 }),
      makeDoc({ id: 5 }),
    ]
    expect(topSuggestions(docs).map((d) => d.id)).toEqual([2, 3, 4])
    expect(topSuggestions(docs, 2).map((d) => d.id)).toEqual([2, 3])
  })
})

describe('docToPendingMaterial', () => {
  it('maps document fields onto a material keyed by document_id', () => {
    const doc: PaperlessDocument = {
      id: 42,
      external_id: 'ext-42',
      paperless_id: 420,
      title: 'Fractions',
      asn: '101',
      material_kind: 'worksheet',
      subject_id: 3,
      page_count: 4,
      correspondent: 'Saxon Math',
      used_in_count: 0,
    }
    expect(docToPendingMaterial(doc)).toEqual({
      id: 42,
      document_id: 42,
      external_id: 'ext-42',
      title: 'Fractions',
      asn: '101',
      material_kind: 'worksheet',
      subject_id: 3,
      page_count: 4,
      correspondent: 'Saxon Math',
    })
  })
})

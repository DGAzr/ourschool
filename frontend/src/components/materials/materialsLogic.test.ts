import { describe, expect, it } from 'vitest'

import {
  MATERIAL_KIND_ORDER,
  documentMeta,
  formatRelativeTime,
  groupLessonsByDate,
  kindBadge,
  lessonDateLabel,
  resultCountLabel,
  toggleFacetValue,
  usageLabel,
} from './materialsLogic'
import { PaperlessDocument } from '../../types/paperless'
import { Lesson } from '../../types/lesson'

const makeDoc = (over: Partial<PaperlessDocument> = {}): PaperlessDocument => ({
  id: 1,
  external_id: 'x',
  paperless_id: 10,
  title: 'Fractions worksheet',
  material_kind: 'worksheet',
  used_in_count: 0,
  ...over,
})

describe('toggleFacetValue', () => {
  it('adds a missing value', () => {
    expect(toggleFacetValue<string>([], 'worksheet')).toEqual(['worksheet'])
    expect(toggleFacetValue(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('removes a present value (empty selection = all)', () => {
    expect(toggleFacetValue(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleFacetValue(['a'], 'a')).toEqual([])
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-11T12:00:00Z')

  it('handles missing and invalid values', () => {
    expect(formatRelativeTime(null, now)).toBe('never')
    expect(formatRelativeTime(undefined, now)).toBe('never')
    expect(formatRelativeTime('not-a-date', now)).toBe('never')
  })

  it('buckets into just now / minutes / hours / days', () => {
    expect(formatRelativeTime('2026-07-11T11:59:30Z', now)).toBe('just now')
    expect(formatRelativeTime('2026-07-11T11:56:00Z', now)).toBe('4m ago')
    expect(formatRelativeTime('2026-07-11T09:00:00Z', now)).toBe('3h ago')
    expect(formatRelativeTime('2026-07-09T12:00:00Z', now)).toBe('2d ago')
  })

  it('clamps future timestamps to just now', () => {
    expect(formatRelativeTime('2026-07-11T12:05:00Z', now)).toBe('just now')
  })
})

describe('labels', () => {
  it('kindBadge uppercases the kind label', () => {
    expect(kindBadge('worksheet')).toBe('WORKSHEET')
    expect(kindBadge('reference')).toBe('REFERENCE')
  })

  it('documentMeta includes page count only when present', () => {
    expect(documentMeta(makeDoc())).toBe('WORKSHEET')
    expect(documentMeta(makeDoc({ page_count: 4 }))).toBe('WORKSHEET · 4 pp')
  })

  it('usageLabel pluralizes correctly', () => {
    expect(usageLabel(0)).toBe('Not yet used')
    expect(usageLabel(1)).toBe('Used in 1 lesson')
    expect(usageLabel(3)).toBe('Used in 3 lessons')
  })

  it('resultCountLabel pluralizes correctly', () => {
    expect(resultCountLabel(1)).toBe('1 document')
    expect(resultCountLabel(14)).toBe('14 documents')
  })

  it('kind order covers all six kinds', () => {
    expect(MATERIAL_KIND_ORDER).toHaveLength(6)
    expect(new Set(MATERIAL_KIND_ORDER).size).toBe(6)
  })
})

const makeLesson = (over: Partial<Lesson> = {}): Lesson =>
  ({
    id: 1,
    external_id: 'l',
    position: 0,
    title: 'Lesson',
    date: '2026-07-11',
    status: 'planned',
    created_at: '',
    updated_at: '',
    templates: [],
    students: [],
    materials: [],
    resources: [],
    paperless_materials: [],
    ...over,
  }) as Lesson

describe('lessonDateLabel', () => {
  const today = '2026-07-11'

  it('labels the current day as Today', () => {
    expect(lessonDateLabel('2026-07-11', today)).toBe('Today · Jul 11')
  })

  it('labels other days with weekday and month-day', () => {
    // 2026-07-14 is a Tuesday.
    expect(lessonDateLabel('2026-07-14', today)).toBe('Tue · Jul 14')
  })

  it('returns the raw string for an invalid date', () => {
    expect(lessonDateLabel('nope', today)).toBe('nope')
  })
})

describe('groupLessonsByDate', () => {
  const today = '2026-07-11'

  it('sorts by date then position and groups per day', () => {
    const lessons = [
      makeLesson({ id: 3, date: '2026-07-14', position: 1, title: 'Science' }),
      makeLesson({ id: 1, date: '2026-07-11', position: 0, title: 'Math' }),
      makeLesson({ id: 2, date: '2026-07-14', position: 0, title: 'Reading' }),
    ]
    const groups = groupLessonsByDate(lessons, today)
    expect(groups.map((g) => g.date)).toEqual(['2026-07-11', '2026-07-14'])
    expect(groups[0].label).toBe('Today · Jul 11')
    expect(groups[1].lessons.map((l) => l.title)).toEqual(['Reading', 'Science'])
  })

  it('returns an empty array for no lessons', () => {
    expect(groupLessonsByDate([], today)).toEqual([])
  })
})

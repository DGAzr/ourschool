import { describe, expect, it } from 'vitest'

import {
  clampDaysShown,
  generateDays,
  prepLabel,
  rangeLabel,
  readiness,
  stepRange,
  studentInitials,
  subjectTint,
} from './lessonPlanning'
import { Lesson } from '../types/lesson'

const makeLesson = (over: Partial<Lesson>): Lesson => ({
  id: 1,
  external_id: 'x',
  position: 0,
  title: 'L',
  date: '2026-06-22',
  status: 'planned',
  templates: [],
  students: [],
  materials: [],
  resources: [],
  paperless_materials: [],
  created_at: '',
  updated_at: '',
  ...over,
})

describe('generateDays', () => {
  it('skips weekends and rolls into the next week (7 school days from a Thursday)', () => {
    // 2026-06-18 is a Thursday.
    const days = generateDays('2026-06-18', 7, true)
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.weekdayLabel)).toEqual([
      'Thu', 'Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri',
    ])
    expect(days.every((d) => !d.isWeekend)).toBe(true)
  })

  it('includes weekends (flagged) when skipWeekends is false', () => {
    const days = generateDays('2026-06-18', 7, false)
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.weekdayLabel)).toEqual([
      'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed',
    ])
    const weekend = days.filter((d) => d.isWeekend)
    expect(weekend.map((d) => d.weekdayLabel)).toEqual(['Sat', 'Sun'])
  })

  it('honors an explicitly selected weekend while skipping later weekends', () => {
    const days = generateDays('2026-06-20', 5, true)
    expect(days.map((day) => day.iso)).toEqual([
      '2026-06-20',
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
    ])
    expect(days[0].isWeekend).toBe(true)
  })

  it('marks today when the range includes it and not otherwise', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const todayIso = `${y}-${m}-${d}`

    const including = generateDays(todayIso, 3, false)
    expect(including[0].isToday).toBe(true)

    // A range far in the past never contains today.
    const past = generateDays('2020-01-06', 5, false)
    expect(past.some((day) => day.isToday)).toBe(false)
  })
})

describe('stepRange', () => {
  it('forward then backward is the identity (skip weekends)', () => {
    const start = '2026-06-22' // Monday
    const forward = stepRange(start, 7, true, 1)
    const back = stepRange(forward, 7, true, -1)
    expect(back).toBe(start)
  })

  it('forward then backward is the identity (7-day mode)', () => {
    const start = '2026-06-22'
    const forward = stepRange(start, 7, false, 1)
    const back = stepRange(forward, 7, false, -1)
    expect(back).toBe(start)
    // Full 7-day windows are contiguous.
    expect(forward).toBe('2026-06-29')
  })

  it('forward advances past the last visible day', () => {
    // 7 school days from Mon 06-22 → last is Tue 06-30; next school day Wed 07-01.
    const forward = stepRange('2026-06-22', 7, true, 1)
    expect(forward).toBe('2026-07-01')
  })
})

describe('clampDaysShown', () => {
  it('clamps below and above the range and rounds', () => {
    expect(clampDaysShown(2)).toBe(5)
    expect(clampDaysShown(99)).toBe(21)
    expect(clampDaysShown(7)).toBe(7)
    expect(clampDaysShown(7.4)).toBe(7)
    expect(clampDaysShown(NaN)).toBe(7)
  })
})

describe('readiness', () => {
  it('counts ready/taught and material gaps', () => {
    const lessons = [
      makeLesson({ status: 'ready', materials: [{ id: 1, label: 'a', is_gathered: true, position: 0 }] }),
      makeLesson({ status: 'taught' }),
      makeLesson({ status: 'planned', materials: [{ id: 2, label: 'b', is_gathered: false, position: 0 }] }),
    ]
    expect(readiness(lessons)).toEqual({ readyOrTaught: 2, total: 3, needMaterials: 1 })
  })

  it('is empty for no lessons', () => {
    expect(readiness([])).toEqual({ readyOrTaught: 0, total: 0, needMaterials: 0 })
  })
})

describe('prepLabel', () => {
  it('reflects material state', () => {
    expect(prepLabel(makeLesson({ materials: [] }))).toBe('No prep')
    expect(
      prepLabel(makeLesson({ materials: [{ id: 1, label: 'a', is_gathered: true, position: 0 }] }))
    ).toBe('Materials ready')
    expect(
      prepLabel(
        makeLesson({
          materials: [
            { id: 1, label: 'a', is_gathered: false, position: 0 },
            { id: 2, label: 'b', is_gathered: false, position: 1 },
          ],
        })
      )
    ).toBe('2 to gather')
  })
})

describe('rangeLabel', () => {
  it('formats same-month and cross-month ranges', () => {
    expect(rangeLabel(generateDays('2026-06-22', 7, false))).toBe('Jun 22–28')
    expect(rangeLabel(generateDays('2026-06-29', 7, false))).toBe('Jun 29 – Jul 5')
  })

  it('is empty for no days', () => {
    expect(rangeLabel([])).toBe('')
  })
})

describe('subjectTint', () => {
  it('uses the hex as ink and mixes soft/line against tokens', () => {
    const tint = subjectTint('#3D6098')
    expect(tint['--subject-ink']).toBe('#3D6098')
    expect(tint['--subject-soft']).toContain('#3D6098')
    expect(tint['--subject-soft']).toContain('var(--panel)')
  })

  it('falls back to the accent token when no color', () => {
    expect(subjectTint(null)['--subject-ink']).toBe('var(--accent)')
  })
})

describe('studentInitials', () => {
  it('builds from first/last, falls back to username', () => {
    expect(studentInitials({ first_name: 'Ada', last_name: 'Byte' })).toBe('AB')
    expect(studentInitials({ username: 'ada' })).toBe('A')
  })
})

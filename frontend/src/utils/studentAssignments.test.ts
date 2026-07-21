import { describe, expect, it } from 'vitest'

import {
  bucketTab,
  effectiveDueDate,
  inTerm,
  isOverdue,
  urgencyGroup,
} from './studentAssignments'
import { StudentAssignment } from '../types/assignment'
import { Term } from '../types/term'

const TODAY = '2026-07-12'

const makeAssignment = (over: Partial<StudentAssignment>): StudentAssignment => ({
  id: 1,
  template_id: 1,
  student_id: 1,
  assigned_date: '2026-07-01',
  status: 'not_started',
  is_graded: false,
  time_spent_minutes: 0,
  assigned_by: 1,
  created_at: '',
  updated_at: '',
  ...over,
})

const makeTerm = (over: Partial<Term>): Term => ({
  id: 1,
  name: 'Term',
  start_date: '2026-07-01',
  end_date: '2026-12-18',
  academic_year: '2026-2027',
  term_type: 'semester',
  is_active: true,
  created_at: '',
  updated_at: '',
  created_by: 1,
  ...over,
})

describe('effectiveDueDate', () => {
  it('prefers the extension over the original due date', () => {
    const a = makeAssignment({ due_date: '2026-07-10', extended_due_date: '2026-07-20' })
    expect(effectiveDueDate(a)).toBe('2026-07-20')
    expect(effectiveDueDate(makeAssignment({ due_date: '2026-07-10' }))).toBe('2026-07-10')
    expect(effectiveDueDate(makeAssignment({}))).toBeUndefined()
  })
})

describe('isOverdue', () => {
  it('flags unfinished work past its effective due date', () => {
    expect(isOverdue(makeAssignment({ due_date: '2026-07-11' }), TODAY)).toBe(true)
    expect(isOverdue(makeAssignment({ due_date: '2026-07-12' }), TODAY)).toBe(false)
    expect(isOverdue(makeAssignment({}), TODAY)).toBe(false)
  })

  it('respects extensions and terminal statuses', () => {
    const extended = makeAssignment({
      due_date: '2026-07-01',
      extended_due_date: '2026-07-30',
    })
    expect(isOverdue(extended, TODAY)).toBe(false)
    const submitted = makeAssignment({ due_date: '2026-07-01', status: 'submitted' })
    expect(isOverdue(submitted, TODAY)).toBe(false)
    const graded = makeAssignment({ due_date: '2026-07-01', status: 'graded' })
    expect(isOverdue(graded, TODAY)).toBe(false)
  })

  it('trusts dates over a stale stored status', () => {
    // Stored OVERDUE whose due date was extended into the future.
    const stale = makeAssignment({
      status: 'overdue',
      due_date: '2026-07-01',
      extended_due_date: '2026-08-01',
    })
    expect(isOverdue(stale, TODAY)).toBe(false)
  })
})

describe('bucketTab', () => {
  it('splits statuses across the three tabs', () => {
    expect(bucketTab(makeAssignment({ status: 'not_started' }))).toBe('todo')
    expect(bucketTab(makeAssignment({ status: 'in_progress' }))).toBe('todo')
    expect(bucketTab(makeAssignment({ status: 'overdue' }))).toBe('todo')
    expect(bucketTab(makeAssignment({ status: 'submitted' }))).toBe('submitted')
    expect(bucketTab(makeAssignment({ status: 'graded', is_graded: true }))).toBe('done')
    expect(bucketTab(makeAssignment({ status: 'excused' }))).toBe('done')
  })

  it('treats graded-but-stale-status rows as done', () => {
    expect(bucketTab(makeAssignment({ status: 'submitted', is_graded: true }))).toBe('done')
  })
})

describe('urgencyGroup', () => {
  it('sections the to-do list by due date', () => {
    expect(urgencyGroup(makeAssignment({ due_date: '2026-07-10' }), TODAY)).toBe('overdue')
    expect(urgencyGroup(makeAssignment({ due_date: '2026-07-12' }), TODAY)).toBe('today')
    expect(urgencyGroup(makeAssignment({ due_date: '2026-07-19' }), TODAY)).toBe('week')
    expect(urgencyGroup(makeAssignment({ due_date: '2026-07-20' }), TODAY)).toBe('later')
    expect(urgencyGroup(makeAssignment({}), TODAY)).toBe('undated')
  })

  it('handles month boundaries in the 7-day window', () => {
    expect(urgencyGroup(makeAssignment({ due_date: '2026-08-02' }), '2026-07-28')).toBe('week')
    expect(urgencyGroup(makeAssignment({ due_date: '2026-08-05' }), '2026-07-28')).toBe('later')
  })
})

describe('inTerm', () => {
  const term = makeTerm({})

  it('uses due date, falling back to assigned date', () => {
    expect(inTerm(makeAssignment({ due_date: '2026-07-15' }), term)).toBe(true)
    expect(inTerm(makeAssignment({ due_date: '2026-06-30' }), term)).toBe(false)
    expect(inTerm(makeAssignment({ assigned_date: '2026-08-01' }), term)).toBe(true)
    expect(inTerm(makeAssignment({ assigned_date: '2025-05-01' }), term)).toBe(false)
  })

  it('ignores extensions, matching the backend filter', () => {
    const a = makeAssignment({ due_date: '2026-06-01', extended_due_date: '2026-07-05' })
    expect(inTerm(a, term)).toBe(false)
  })

  it('is inclusive of term boundaries', () => {
    expect(inTerm(makeAssignment({ due_date: '2026-07-01' }), term)).toBe(true)
    expect(inTerm(makeAssignment({ due_date: '2026-12-18' }), term)).toBe(true)
  })
})

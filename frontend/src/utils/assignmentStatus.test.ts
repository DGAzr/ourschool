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
import { isOverdue } from './assignmentStatus'

const past = '2000-01-01'
const future = '2999-01-01'

describe('isOverdue', () => {
  it('is true for past-due open work', () => {
    expect(isOverdue({ due_date: past, status: 'not_started' })).toBe(true)
    expect(isOverdue({ due_date: past, status: 'in_progress' })).toBe(true)
  })
  it('is false for submitted, graded, and excused work', () => {
    expect(isOverdue({ due_date: past, status: 'submitted' })).toBe(false)
    expect(isOverdue({ due_date: past, status: 'graded' })).toBe(false)
    expect(isOverdue({ due_date: past, status: 'excused' })).toBe(false)
    expect(isOverdue({ due_date: past, status: 'in_progress', is_graded: true })).toBe(false)
  })
  it('is false without a due date or before it', () => {
    expect(isOverdue({ due_date: null, status: 'not_started' })).toBe(false)
    expect(isOverdue({ due_date: future, status: 'not_started' })).toBe(false)
  })
})

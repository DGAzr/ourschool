import { describe, expect, it } from 'vitest'
import { activityReturnPath, dayProgress, lessonProgress, orderedActivities } from './studentPlan'
import { StudentActivity, StudentDay, StudentLesson } from '../types/lesson'

export const activity = (id: number, status: StudentActivity['status'] = 'not_started'): StudentActivity => ({
  id, template_id: id, lesson_id: 1, student_id: 2, name: `Activity ${id}`, status,
  is_graded: status === 'graded', time_spent_minutes: 0, help_requested: false,
})
export const lesson: StudentLesson = { id: 1, title: 'Math', date: '2026-11-17', position: 0, status: 'planned', templates: [], resources: [], paperless_materials: [], assignments: [] }
export const emptyDay: StudentDay = { date: '2026-11-17', lessons: [], standalone: [], earlier: { items: [], total: 0 }, other: { items: [], total: 0 } }

describe('student plan progress', () => {
  it('returns the next task to its own lesson while preserving a work-list origin', () => {
    expect(activityReturnPath({lesson_id:2}, '/my-lessons/1?from=%2F')).toBe('/my-lessons/2?from=%2F')
    expect(activityReturnPath({lesson_id:2}, '/#lesson-1')).toBe('/#lesson-2')
    expect(activityReturnPath({lesson_id:2}, '/assignments?tab=todo')).toBe('/assignments?tab=todo')
  })
  it('does not complete empty, instruction-only, or unassigned plans automatically', () => {
    expect(dayProgress(emptyDay).complete).toBe(false)
    expect(dayProgress({...emptyDay, lessons: [lesson]})).toMatchObject({ total: 1, finished: 0, complete: false })
    const waiting = {...lesson, status: 'taught' as const, templates: [{id: 1, template_id: 1}]}
    expect(dayProgress({...emptyDay, lessons: [waiting]})).toMatchObject({ waiting: 1, complete: false })
  })
  it('counts submitted and excused work independently of teacher delivery and counts ids once', () => {
    const work = [activity(1, 'submitted'), activity(2, 'excused')]
    expect(dayProgress({...emptyDay, lessons: [{...lesson, assignments: work}], standalone: work})).toMatchObject({ total: 2, finished: 2, complete: true })
    expect(lessonProgress({...lesson, status: 'taught', assignments: [activity(1)]}).complete).toBe(false)
    expect(dayProgress({...emptyDay, lessons: [{...lesson, status: 'taught'}]}).complete).toBe(true)
  })
  it('uses template order and recommends active work within the plan', () => {
    const planned = {...lesson, templates: [{id: 1, template_id: 2}, {id: 2, template_id: 1}], assignments: [activity(1), activity(2, 'in_progress')]}
    expect(orderedActivities(planned).map(a => a.id)).toEqual([2, 1])
    expect(dayProgress({...emptyDay, lessons: [planned], other: {items: [activity(7, 'in_progress')], total: 1}}).next?.id).toBe(2)
  })
})

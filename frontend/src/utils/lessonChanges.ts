import { Lesson, LessonCreate } from '../types/lesson'
import { addDays } from './dates'

export function lessonDraft(lesson: Lesson, date: string | null, copyOffset?: number): LessonCreate {
  return {
    title: lesson.title, date, subject_id: lesson.subject_id, objective: lesson.objective,
    duration_minutes: lesson.duration_minutes, notes: lesson.notes,
    status: copyOffset == null ? lesson.status : 'planned', student_ids: lesson.students.map(s => s.id),
    templates: lesson.templates.filter(link => link.template_id != null).map(link => ({
      template_id: link.template_id!, assignment_timing: link.assignment_timing ?? 'on_schedule',
      due_offset_days: link.due_offset_days ?? 0,
      custom_due_date: link.custom_due_date && copyOffset != null ? addDays(link.custom_due_date, copyOffset) : link.custom_due_date,
      custom_max_points: link.custom_max_points, custom_instructions: link.custom_instructions,
    })),
    materials: lesson.materials.map(m => ({label: m.label, is_gathered: copyOffset == null && m.is_gathered})),
    resources: lesson.resources.map(r => ({label:r.label, url:r.url})),
  }
}

/** Fill visible ordering slots while leaving filtered-out cards in place. */
export function mergeLessonOrder(all: Lesson[], date: string | null, visibleIds: number[]): number[] {
  const remaining = [...visibleIds]
  const visible = new Set(visibleIds)
  const order: number[] = []
  for (const lesson of all.filter(l => l.date === date).sort((a,b) => a.position-b.position || a.id-b.id)) {
    if (visible.has(lesson.id)) { const next = remaining.shift(); if (next != null) order.push(next) }
    else order.push(lesson.id)
  }
  return [...order,...remaining]
}

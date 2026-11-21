import { StudentActivity, StudentDay, StudentLessonDetail } from '../types/lesson'
import { assignmentProgress } from './studentAssignments'

export const workStateLabel = (work: Parameters<typeof assignmentProgress>[0]): string => ({
  not_started: 'Ready to start', in_progress: 'Working on it', submitted: 'Ready for teacher',
  graded: 'Reviewed', excused: 'You can skip this',
})[assignmentProgress(work)]

export const activityOpen = (work: Parameters<typeof assignmentProgress>[0]) =>
  ['not_started', 'in_progress'].includes(assignmentProgress(work))

/** Advancing to another lesson keeps Back attached to that activity's lesson. */
export function activityReturnPath(activity: Pick<StudentActivity, 'lesson_id'>, from: string) {
  const base = from.split('#')[0]
  const lesson = base.match(/^\/my-lessons\/[1-9]\d*(\?.*)?$/)
  if (lesson) return activity.lesson_id ? `/my-lessons/${activity.lesson_id}${lesson[1] ?? ''}` : '/my-lessons'
  if (activity.lesson_id && (base === '/' || base.startsWith('/?') || base === '/my-lessons' || base.startsWith('/my-lessons?'))) return `${base}#lesson-${activity.lesson_id}`
  return from
}

export function orderedActivities(lesson: StudentLessonDetail): StudentActivity[] {
  const rank = new Map(lesson.templates.map((link, index) => [link.template_id, index]))
  return [...new Map((lesson.assignments ?? []).map(a => [a.id, a])).values()]
    .sort((a, b) => (rank.get(a.template_id) ?? Infinity) - (rank.get(b.template_id) ?? Infinity) || a.id - b.id)
}

export function lessonProgress(lesson: StudentLessonDetail) {
  const activities = orderedActivities(lesson)
  const waiting = lesson.templates.filter(link => link.template_id && !activities.some(a => a.template_id === link.template_id))
  const instructionOnly = activities.length === 0 && waiting.length === 0
  const finished = activities.filter(a => !activityOpen(a)).length
  return {
    activities, waiting, instructionOnly, finished,
    complete: instructionOnly ? lesson.status === 'taught' : finished === activities.length && waiting.length === 0,
  }
}

export function nextAvailableActivity(activities: StudentActivity[], currentId?: number) {
  const available = activities.filter(activity =>
    activity.id !== currentId && activityOpen(activity) && !activity.help_requested
  )
  return available.find(activity => assignmentProgress(activity) === 'in_progress') ?? available[0]
}

/** Counts canonical assignment ids once; empty/unassigned lessons cannot pass as done. */
export function dayProgress(day: StudentDay) {
  const activities = [...new Map([...day.lessons.flatMap(orderedActivities), ...day.standalone].map(a => [a.id, a])).values()]
  const instructions = day.lessons.filter(l => lessonProgress(l).instructionOnly)
  const waiting = day.lessons.reduce((sum, l) => sum + lessonProgress(l).waiting.length, 0)
  const total = activities.length + instructions.length
  const finished = activities.filter(a => !activityOpen(a)).length + instructions.filter(l => l.status === 'taught').length
  const next = nextAvailableActivity(activities)
  return { activities, total, finished, waiting, next, complete: total > 0 && total === finished && waiting === 0 }
}

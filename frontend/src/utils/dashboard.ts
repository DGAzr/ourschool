import { addDays, parseISO } from './dates'
import { ReviewFilter } from '../types/dashboard'

export const reviewFilters: { value: ReviewFilter; label: string }[] = [
  { value: 'review', label: 'Combined' },
  { value: 'needs', label: 'Submitted' },
  { value: 'awaiting', label: 'Awaiting' },
  { value: 'overdue', label: 'Overdue' },
]
export const isReviewFilter = (value: string | null): value is ReviewFilter =>
  reviewFilters.some((f) => f.value === value)
export function savedReviewFilter(teacherId?: number): ReviewFilter
export function savedReviewFilter(teacherId: number | undefined, desk: 'grading'): ReviewFilter | 'all'
export function savedReviewFilter(teacherId?: number, desk?: 'grading'): ReviewFilter | 'all' {
  try {
    const value = localStorage.getItem(`ourschool.review-filter.${teacherId}`)
    if (desk && localStorage.getItem(`ourschool.grading-all.${teacherId}`) === 'true') return 'all'
    return isReviewFilter(value) ? value : 'needs'
  } catch {
    return 'needs'
  }
}
export function saveReviewFilter(
  teacherId: number | undefined,
  value: ReviewFilter | 'all',
  desk?: 'grading',
) {
  try {
    if (desk) localStorage.setItem(`ourschool.grading-all.${teacherId}`, String(value === 'all'))
    if (value !== 'all') localStorage.setItem(`ourschool.review-filter.${teacherId}`, value)
  } catch {
    /* Device preferences are optional. */
  }
}
export function dashboardDates(today: string, scope: string) {
  const day = parseISO(today).getDay()
  const start =
    scope === 'week' ? addDays(today, -(day === 0 ? 6 : day - 1)) : today
  return { start, end: scope === 'week' ? addDays(start, 6) : today }
}
export const dashboardHref = (
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
) => {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  )
  return `${path}${query.size ? `?${query}` : ''}`
}

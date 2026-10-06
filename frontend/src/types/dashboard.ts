export type ReviewFilter = 'review' | 'needs' | 'awaiting' | 'overdue'
export type InboxCategory =
  | 'all'
  | 'journals'
  | 'approvals'
  | 'pickups'
  | 'help'
interface DashboardPerson {
  id: number
  first_name: string
  last_name: string
}
export interface DashboardLesson {
  id: number
  title: string
  date: string
  status: 'planned' | 'ready' | 'taught'
  students: DashboardPerson[]
  materials: { id: number; label: string; is_gathered: boolean }[]
}
export interface DashboardPage<T> {
  items: T[]
  total: number
  has_more: boolean
  offset: number
}
export interface DashboardSchedule extends DashboardPage<DashboardLesson> {
  start_date: string
  end_date: string
  taught: number
  today_planned: number
  materials_remaining: number
  attendance: {
    total: number
    recorded: number
    records: { student_id: number; status: string }[]
  }
}
export interface DashboardPreparation extends DashboardPage<DashboardLesson> {
  date: string | null
  taught: number
  materials_remaining: number
}
export interface InboxItem {
  id: number
  student_id: number
  student_name: string
  title: string
  created_at: string
  preview?: string
  entry_date?: string
  cost_points?: number
  pickup_instructions?: string
  assignment_id?: number
}
export interface DashboardInbox {
  groups: Partial<
    Record<
      Exclude<InboxCategory, 'all'>,
      { items: InboxItem[]; total: number; has_more: boolean }
    >
  >
  offset: number
}
export interface DashboardStudent extends DashboardPerson {
  attendance: string | null
  work: Partial<Record<ReviewFilter, number>>
  schedule: { lessons?: number; taught?: number }
  inbox: Partial<Record<Exclude<InboxCategory, 'all'>, number>>
}

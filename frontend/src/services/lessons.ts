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

import { api } from './api'
import {
  Lesson,
  LessonCreate,
  LessonDeleteResponse,
  LessonReorderResponse,
  LessonRolloverResponse,
  LessonStatus,
  LessonUpdate,
  LessonWriteResponse,
  StudentLesson,
} from '../types/lesson'

interface DateRange {
  start_date?: string
  end_date?: string
}

const rangeQuery = (range?: DateRange): string => {
  if (!range) return ''
  const params = new URLSearchParams()
  if (range.start_date) params.set('start_date', range.start_date)
  if (range.end_date) params.set('end_date', range.end_date)
  const q = params.toString()
  return q ? `?${q}` : ''
}

export const lessonsApi = {
  list: (range?: DateRange): Promise<Lesson[]> =>
    api.get(`/lessons/${rangeQuery(range)}`),

  drawer: (): Promise<Lesson[]> => api.get('/lessons/drawer'),

  rollover: (currentDate: string): Promise<LessonRolloverResponse> =>
    api.post('/lessons/rollover', { current_date: currentDate }),

  get: (id: number): Promise<Lesson> => api.get(`/lessons/${id}`),

  // Current student's schedule; defaults to today-forward server-side.
  myLessons: (range?: DateRange): Promise<StudentLesson[]> =>
    api.get(`/lessons/my-lessons${rangeQuery(range)}`),

  create: (data: LessonCreate): Promise<LessonWriteResponse> =>
    api.post('/lessons/', data),

  update: (id: number, data: LessonUpdate): Promise<LessonWriteResponse> =>
    api.put(`/lessons/${id}`, data),

  remove: (id: number): Promise<LessonDeleteResponse> =>
    api.delete(`/lessons/${id}`),

  toggleMaterial: (
    lessonId: number,
    materialId: number,
    isGathered: boolean
  ): Promise<Lesson> =>
    api.patch(`/lessons/${lessonId}/materials/${materialId}`, {
      is_gathered: isGathered,
    }),

  setStatus: (id: number, status: LessonStatus): Promise<Lesson> =>
    api.patch(`/lessons/${id}/status`, { status }),

  reorder: (
    date: string | null,
    lessonIds: number[]
  ): Promise<LessonReorderResponse> =>
    api.patch('/lessons/reorder', { date, lesson_ids: lessonIds }),
}

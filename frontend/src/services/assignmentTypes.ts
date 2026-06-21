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
import type {
  AssignmentTypeConfig,
  AssignmentTypeCreate,
  AssignmentTypeUpdate,
} from '../types/assignment'

export const assignmentTypesApi = {
  getAll: (includeInactive = true): Promise<AssignmentTypeConfig[]> =>
    api.get(`/assignment-types/?include_inactive=${includeInactive}`),

  create: (data: AssignmentTypeCreate): Promise<AssignmentTypeConfig> =>
    api.post('/assignment-types/', data),

  update: (id: number, data: AssignmentTypeUpdate): Promise<AssignmentTypeConfig> =>
    api.put(`/assignment-types/${id}`, data),

  delete: (id: number): Promise<void> =>
    api.delete(`/assignment-types/${id}`).then(() => undefined),
}

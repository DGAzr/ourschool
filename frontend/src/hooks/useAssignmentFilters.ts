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

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Filter state is shared; matching rows and counts come from the page API. */
export const useAssignmentFilters = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [params, setParams] = useSearchParams()
  const readId = (key: string) => { const value = Number(params.get(key)); return Number.isSafeInteger(value) && value > 0 ? value : null }
  const selectedSubject = readId('subject_id')
  const selectedStudent = readId('student_id')
  const setId = (key: string, value: number | null) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, String(value)); else next.delete(key); return next }, { replace: true })
  const setSelectedSubject = (value: number | null) => setId('subject_id', value)
  const setSelectedStudent = (value: number | null) => setId('student_id', value)
  const [selectedType, setSelectedType] = useState<string | null>(null)

  return {
    searchTerm, setSearchTerm,
    selectedSubject, setSelectedSubject,
    selectedType, setSelectedType,
    selectedStudent, setSelectedStudent,
  }
}

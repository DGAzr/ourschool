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

import React from 'react'
import { Search } from 'lucide-react'
import { Subject } from '../../types'

const FIELD = 'bg-field-bg border border-field-border rounded-field px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent'

interface AssignmentFiltersProps {
  searchTerm: string
  setSearchTerm: (term: string) => void
  selectedSubject: number | null
  setSelectedSubject: (id: number | null) => void
  selectedType: string | null
  setSelectedType: (type: string | null) => void
  selectedDifficulty: string | null
  setSelectedDifficulty: (difficulty: string | null) => void
  subjects: Subject[]
}

const AssignmentFilters: React.FC<AssignmentFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  selectedSubject,
  setSelectedSubject,
  selectedType,
  setSelectedType,
  selectedDifficulty,
  setSelectedDifficulty,
  subjects
}) => {
  return (
    <div className="bg-panel border border-line rounded-card-lg p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-faint h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Search templates…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${FIELD} pl-8 w-full`}
            />
          </div>
        </div>

        <select
          value={selectedSubject || ''}
          onChange={(e) => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
          className={FIELD}
        >
          <option value="">All Subjects</option>
          {subjects.map(subject => (
            <option key={subject.id} value={subject.id}>{subject.name}</option>
          ))}
        </select>

        <select
          value={selectedType || ''}
          onChange={(e) => setSelectedType(e.target.value || null)}
          className={FIELD}
        >
          <option value="">All Types</option>
          <option value="homework">Homework</option>
          <option value="project">Project</option>
          <option value="test">Test</option>
          <option value="quiz">Quiz</option>
          <option value="essay">Essay</option>
          <option value="presentation">Presentation</option>
          <option value="worksheet">Worksheet</option>
          <option value="reading">Reading</option>
          <option value="practice">Practice</option>
        </select>

        <select
          value={selectedDifficulty || ''}
          onChange={(e) => setSelectedDifficulty(e.target.value || null)}
          className={FIELD}
        >
          <option value="">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
    </div>
  )
}

export default AssignmentFilters

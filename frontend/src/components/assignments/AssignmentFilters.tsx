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
    <div className="bg-white shadow rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Subject Filter */}
        <div>
          <select
            value={selectedSubject || ''}
            onChange={(e) => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        {/* Assignment Type Filter */}
        <div>
          <select
            value={selectedType || ''}
            onChange={(e) => setSelectedType(e.target.value || null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
        </div>

        {/* Difficulty Filter */}
        <div>
          <select
            value={selectedDifficulty || ''}
            onChange={(e) => setSelectedDifficulty(e.target.value || null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default AssignmentFilters
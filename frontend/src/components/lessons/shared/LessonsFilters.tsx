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

import { Search, Filter, X } from 'lucide-react'
import { Select, Input, Button, Card } from '../../ui'
import { Subject } from '../../../types'

interface LessonsFiltersProps {
  subjects: Subject[]
  selectedSubject: number | null
  searchTerm: string
  onSubjectChange: (subjectId: number | null) => void
  onSearchChange: (term: string) => void
  totalLessons: number
  filteredCount: number
}

const LessonsFilters: React.FC<LessonsFiltersProps> = ({
  subjects,
  selectedSubject,
  searchTerm,
  onSubjectChange,
  onSearchChange,
  totalLessons,
  filteredCount
}) => {
  const handleClearFilters = () => {
    onSubjectChange(null)
    onSearchChange('')
  }

  const hasActiveFilters = selectedSubject !== null || searchTerm.trim() !== ''

  return (
    <Card className="mb-6">
      <Card.Content className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Filter Lessons
            </h3>
            {hasActiveFilters && (
              <span className="ml-2 text-sm text-gray-500">
                ({filteredCount} of {totalLessons} lessons)
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearFilters}
              icon={<X className="h-4 w-4" />}
            >
              Clear Filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Search lessons..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={selectedSubject || ''}
            onChange={(e) => onSubjectChange(e.target.value ? parseInt(e.target.value) : null)}
            options={[
              { value: '', label: 'All Subjects' },
              ...subjects.map(subject => ({
                value: subject.id,
                label: subject.name
              }))
            ]}
            placeholder="Filter by subject"
          />
        </div>

        {!hasActiveFilters && (
          <p className="text-sm text-gray-500 mt-3">
            Showing all {totalLessons} lessons
          </p>
        )}
      </Card.Content>
    </Card>
  )
}

export default LessonsFilters
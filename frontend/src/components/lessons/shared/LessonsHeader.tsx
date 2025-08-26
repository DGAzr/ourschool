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

import { BookOpen, Plus, Upload, Download } from 'lucide-react'
import { Button, Card } from '../../ui'

interface LessonsHeaderProps {
  onCreateLesson: () => void
  onImportLesson: () => void
  onExportLesson: () => void
  isAdmin: boolean
}

const LessonsHeader: React.FC<LessonsHeaderProps> = ({
  onCreateLesson,
  onImportLesson,
  onExportLesson,
  isAdmin
}) => {
  if (!isAdmin) {
    return (
      <Card className="text-center py-12">
        <Card.Content>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Only administrators can manage lessons.</p>
        </Card.Content>
      </Card>
    )
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 rounded-xl shadow-lg">
      <div className="px-8 py-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mr-4">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-wide mb-1">
                Lesson Management
              </h1>
              <p className="text-purple-100 text-lg">
                Create, organize and manage educational content and learning materials
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={onImportLesson}
              icon={<Upload className="h-4 w-4" />}
              className="text-white border-white border-opacity-30 hover:bg-white hover:bg-opacity-20"
            >
              Import
            </Button>
            <Button
              variant="outline"
              onClick={onExportLesson}
              icon={<Download className="h-4 w-4" />}
              className="text-white border-white border-opacity-30 hover:bg-white hover:bg-opacity-20"
            >
              Export
            </Button>
            <Button
              variant="primary"
              onClick={onCreateLesson}
              icon={<Plus className="h-5 w-5" />}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 border border-white border-opacity-30"
            >
              Create Lesson
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LessonsHeader
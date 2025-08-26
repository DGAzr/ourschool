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
import { ExternalLink } from 'lucide-react'

const LicenseNotice: React.FC = () => {
  return (
    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>© 2025 Dustan Ashley</span>
        <span>•</span>
        <a 
          href="https://www.gnu.org/licenses/agpl-3.0.html" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          AGPL v3 <ExternalLink className="h-3 w-3" />
        </a>
        <span>•</span>
        <a 
          href="https://github.com/DGAzr/ourschool" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          Source Code <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-center">
        This is free software: you are free to change and redistribute it.
        There is NO WARRANTY, to the extent permitted by law.
      </p>
    </div>
  )
}

export default LicenseNotice
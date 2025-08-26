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

import { Download } from 'lucide-react'
import { Button } from '../../ui'

interface ExportButtonProps {
  onExport: () => void
  loading?: boolean
  disabled?: boolean
  text?: string
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  loading = false,
  disabled = false,
  text = 'Export PDF',
  variant = 'outline',
  size = 'md'
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onExport}
      loading={loading}
      disabled={disabled}
      icon={<Download className="h-4 w-4" />}
    >
      {text}
    </Button>
  )
}

export default ExportButton
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

import { BarChart3 } from 'lucide-react'
import { StudentReport, AdminReport } from '../../../types'
import ReportHeader from '../shared/ReportHeader'
import OverviewMetrics from './OverviewMetrics'
import OverviewPerformance from './OverviewPerformance'

interface OverviewReportProps {
  data: StudentReport | AdminReport | null
  isAdmin: boolean
  loading?: boolean
}

const OverviewReport: React.FC<OverviewReportProps> = ({ 
  data, 
  isAdmin, 
  loading = false 
}) => {
  return (
    <div className="space-y-6">
      <ReportHeader
        title="Overview Report"
        subtitle={
          isAdmin 
            ? 'System-wide performance and activity summary'
            : 'Your academic progress and performance summary'
        }
        icon={<BarChart3 className="h-6 w-6" />}
      />

      {loading ? (
        <div className="space-y-6">
          {/* Loading skeleton for metrics */}
          <OverviewMetrics data={null} isAdmin={isAdmin} />
          
          {/* Loading skeleton for performance */}
          <OverviewPerformance data={null} isAdmin={isAdmin} />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <OverviewMetrics data={data} isAdmin={isAdmin} />

          {/* Recent Performance */}
          <OverviewPerformance data={data} isAdmin={isAdmin} />
        </>
      )}
    </div>
  )
}

export default OverviewReport
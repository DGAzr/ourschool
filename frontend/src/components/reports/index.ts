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

// Main container
export { default as ReportsContainer } from './ReportsContainer'

// Overview components
export { default as OverviewReport } from './overview/OverviewReport'
export { default as OverviewMetrics } from './overview/OverviewMetrics'
export { default as OverviewPerformance } from './overview/OverviewPerformance'

// Shared components
export { default as ReportHeader } from './shared/ReportHeader'
export { default as ReportsNavigation } from './shared/ReportsNavigation'
export { default as ExportButton } from './shared/ExportButton'
export { default as LoadingSpinner } from './shared/LoadingSpinner'

// Hooks
export { useReportsData } from './hooks/useReportsData'
export { useAttendanceReport } from './hooks/useAttendanceReport'
export { useAssignmentReport } from './hooks/useAssignmentReport'
export { useReportCard } from './hooks/useReportCard'
export type { ReportView } from './hooks/useReportsData'
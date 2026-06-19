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

import { useAuth } from '../../contexts/AuthContext'
import { useReportsData } from './hooks/useReportsData'
import ReportsNavigation from './shared/ReportsNavigation'
import OverviewReport from './overview/OverviewReport'
import TermReport from './terms/TermReport'
import AttendanceReport from './attendance/AttendanceReport'
import AssignmentReport from './assignments/AssignmentReport'
import StudentsReport from './students/StudentsReport'
import ReportCard from './reportcard/ReportCard'

const ReportsContainer: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  
  const {
    loading,
    error,
    selectedView,
    setSelectedView,
    overviewData,
    termGrades,
    studentProgress,
    academicYears,
    selectedAcademicYear,
    setSelectedAcademicYear,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    useCustomDates,
    setUseCustomDates,
    attendanceReport,
    bulkAttendanceReport,
    attendanceLoading,
    generateAttendanceReport,
    assignmentReport,
    assignmentLoading,
    reportCard,
    reportCardStudentId,
    setReportCardStudentId,
    reportCardTermId,
    setReportCardTermId,
    reportCardAsOfDate,
    setReportCardAsOfDate,
    reportCardLoading,
    availableStudentsForReportCard,
    availableTermsForReportCard,
    generateReportCard,
    terms,
    selectedTermId,
    setSelectedTermId
  } = useReportsData()

  if (error) {
    return (
      <div className="px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20 mb-4">
        {error}
      </div>
    )
  }

  return (
    <div>
      <ReportsNavigation
        selectedView={selectedView}
        onViewChange={setSelectedView}
        isAdmin={isAdmin}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <>
          {selectedView === 'overview' && (
            <OverviewReport
              data={overviewData}
              isAdmin={isAdmin}
              loading={loading}
            />
          )}

          {selectedView === 'terms' && !isAdmin && (
            <TermReport
              termGrades={termGrades}
              loading={loading}
            />
          )}

          {selectedView === 'attendance' && (
            <AttendanceReport
              academicYears={academicYears}
              selectedAcademicYear={selectedAcademicYear}
              setSelectedAcademicYear={setSelectedAcademicYear}
              customStartDate={customStartDate}
              setCustomStartDate={setCustomStartDate}
              customEndDate={customEndDate}
              setCustomEndDate={setCustomEndDate}
              useCustomDates={useCustomDates}
              setUseCustomDates={setUseCustomDates}
              attendanceReport={attendanceReport}
              bulkAttendanceReport={bulkAttendanceReport}
              attendanceLoading={attendanceLoading}
              generateAttendanceReport={generateAttendanceReport}
              isAdmin={isAdmin}
            />
          )}

          {selectedView === 'assignments' && isAdmin && (
            <AssignmentReport
              assignmentReport={assignmentReport}
              loading={assignmentLoading}
            />
          )}

          {selectedView === 'students' && isAdmin && (
            <StudentsReport
              studentProgress={studentProgress}
              terms={terms}
              loading={loading}
              selectedTermId={selectedTermId || undefined}
              onTermChange={setSelectedTermId}
            />
          )}

          {selectedView === 'reportcard' && (
            <ReportCard
              reportCard={reportCard}
              reportCardStudentId={reportCardStudentId}
              setReportCardStudentId={setReportCardStudentId}
              reportCardTermId={reportCardTermId}
              setReportCardTermId={setReportCardTermId}
              reportCardAsOfDate={reportCardAsOfDate}
              setReportCardAsOfDate={setReportCardAsOfDate}
              reportCardLoading={reportCardLoading}
              availableStudentsForReportCard={availableStudentsForReportCard}
              availableTermsForReportCard={availableTermsForReportCard}
              generateReportCard={generateReportCard}
              isAdmin={isAdmin}
            />
          )}
        </>
      )}
    </div>
  )
}

export default ReportsContainer
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
import { useReportsData, ReportView } from './hooks/useReportsData'
import ReportsNavigation from './shared/ReportsNavigation'
import OverviewReport from './overview/OverviewReport'
import TermReport from './terms/TermReport'
import AttendanceReport from './attendance/AttendanceReport'
import AssignmentReport from './assignments/AssignmentReport'
import StudentsReport from './students/StudentsReport'
import ReportCard from './reportcard/ReportCard'
import { AdminReport, StudentReport } from '../../types'

const VIEW_TITLES: Record<ReportView, string> = {
  overview: 'Overview',
  students: 'Student Progress',
  attendance: 'Attendance',
  assignments: 'Assignments',
  terms: 'Terms',
  subjects: 'Subjects',
  reportcard: 'Report Cards',
}

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
    reportCardLoading,
    availableStudentsForReportCard,
    availableTermsForReportCard,
    generateReportCard,
    terms,
    selectedTermId,
    setSelectedTermId,
  } = useReportsData()

  const handleExport = () => {
    if (selectedView === 'reportcard') {
      window.print()
    } else if (selectedView === 'attendance') {
      // Trigger the download from the Attendance view via a custom event
      document.dispatchEvent(new CustomEvent('reports:export'))
    }
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-card text-[13px] text-neg-fg bg-neg-bg border border-neg-fg/20 mb-4">
        {error}
      </div>
    )
  }

  return (
    <div>
      {/* Header — matches prototype: eyebrow + title + term select + Export */}
      <div className="no-print flex items-flex-end justify-between gap-5 mb-5">
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--faint)',
              marginBottom: 6,
            }}
          >
            Reports
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: '-.02em',
              color: 'var(--ink)',
            }}
          >
            {VIEW_TITLES[selectedView]}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Term filter — shown on all views except attendance/reportcard which have their own controls */}
          {selectedView !== 'attendance' && selectedView !== 'reportcard' && terms.length > 0 && (
            <select
              value={selectedTermId ?? ''}
              onChange={(e) => setSelectedTermId(e.target.value ? Number(e.target.value) : null)}
              style={{
                height: 36,
                padding: '0 30px 0 12px',
                border: '1px solid var(--field-border)',
                background: 'var(--field-bg)',
                borderRadius: 9,
                fontSize: 13,
                fontFamily: 'inherit',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="">Current term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.academic_year})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleExport}
            style={{
              height: 36,
              padding: '0 14px',
              border: '1px solid var(--btn-border)',
              background: 'var(--panel)',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            Export
          </button>
        </div>
      </div>

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
              data={overviewData as AdminReport | StudentReport | null}
              isAdmin={isAdmin}
              loading={loading}
              onSelectStudent={(_id) => { setSelectedView('students') }}
            />
          )}

          {selectedView === 'terms' && !isAdmin && (
            <TermReport termGrades={termGrades} loading={loading} />
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

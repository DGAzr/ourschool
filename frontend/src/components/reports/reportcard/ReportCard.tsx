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
import { FileText, Download, Printer, User, Calendar, Award, BookOpen } from 'lucide-react'
import { ReportCard as ReportCardType, ReportCardSubjectGrade } from '../../../types/reports'
import { formatAttendanceRate } from '../../../utils/formatters'

interface ReportCardProps {
  reportCard: ReportCardType | null
  reportCardStudentId: string
  setReportCardStudentId: (id: string) => void
  reportCardTermId: string
  setReportCardTermId: (id: string) => void
  reportCardAsOfDate: string
  setReportCardAsOfDate: (date: string) => void
  reportCardLoading: boolean
  availableStudentsForReportCard: Array<{id: number, name: string}>
  availableTermsForReportCard: Array<{id: number, name: string, academic_year: string}>
  generateReportCard: () => Promise<void>
  isAdmin: boolean
}

const ReportCard: React.FC<ReportCardProps> = ({
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
  isAdmin
}) => {
  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = () => {
    // This would be implemented when PDF generation is available
  }

  return (
    <div className="space-y-6">
      {/* Report Card Generator */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Generate Report Card
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Student Selection */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student
              </label>
              <select
                value={reportCardStudentId}
                onChange={(e) => setReportCardStudentId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Student</option>
                {availableStudentsForReportCard.map((student, index) => (
                  <option key={`student-${student.id}-${index}`} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Term Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Term
            </label>
            <select
              value={reportCardTermId}
              onChange={(e) => setReportCardTermId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Term</option>
              {availableTermsForReportCard.map((term, index) => (
                <option key={`term-${term.id}-${index}`} value={term.id}>
                  {term.name} ({term.academic_year})
                </option>
              ))}
            </select>
          </div>

          {/* As Of Date Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Report Date (Excludes Future Assignments)
            </label>
            <input
              type="date"
              value={reportCardAsOfDate}
              onChange={(e) => setReportCardAsOfDate(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Only assignments due on or before this date will be included in grade calculations.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={generateReportCard}
            disabled={reportCardLoading || !reportCardTermId || (!reportCardStudentId && isAdmin)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reportCardLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report Card
              </>
            )}
          </button>
        </div>
      </div>

      {/* Report Card Display */}
      {reportCard && (
        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl overflow-hidden print:shadow-none print:border-2 print:border-gray-800">
          {/* Print-specific styles */}
          <style>{`
            @media print {
              .no-print { display: none !important; }
              .print-page { page-break-after: always; }
              body { background: white !important; }
              .bg-white { background: white !important; }
              .text-gray-900 { color: black !important; }
              .border-gray-200 { border-color: #e5e7eb !important; }
            }
          `}</style>

          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 px-8 py-6 border-b-4 border-blue-900 print:bg-white print:border-gray-300">
            <div className="flex justify-between items-start">
              <div className="text-white print:text-gray-900">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mr-4 print:bg-gray-100">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-wide">OFFICIAL REPORT CARD</h1>
                    <p className="text-blue-100 text-lg print:text-gray-600">Academic Performance Report</p>
                  </div>
                </div>
                <div className="border-t border-blue-400 pt-2 print:border-gray-300">
                  <p className="text-blue-100 print:text-gray-600 font-medium">{reportCard.academic_year} Academic Year</p>
                </div>
              </div>
              <div className="text-right print:hidden">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-4 py-2 bg-white text-blue-700 font-medium rounded-lg shadow-lg hover:bg-blue-50 transition-colors mr-2"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center px-4 py-2 bg-white text-blue-700 font-medium rounded-lg shadow-lg hover:bg-blue-50 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Report Card Content */}
          <div className="p-8">
            {/* Student Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl print:bg-gray-50">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center print:text-gray-900">
                  <User className="h-5 w-5 mr-2" />
                  Student Information
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600">Name:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-semibold print:text-gray-900">{reportCard.student_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600">Grade Level:</span>
                    <span className="text-gray-900 dark:text-gray-100 print:text-gray-900">Grade {reportCard.student_grade_level || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600">Student ID:</span>
                    <span className="text-gray-900 dark:text-gray-100 print:text-gray-900">{reportCard.student_id}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl print:bg-gray-50">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center print:text-gray-900">
                  <Calendar className="h-5 w-5 mr-2" />
                  Term Information
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600">Term:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-semibold print:text-gray-900">{reportCard.term_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600">Period:</span>
                    <span className="text-gray-900 dark:text-gray-100 print:text-gray-900">{reportCard.term_start_date} to {reportCard.term_end_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600">Generated:</span>
                    <span className="text-gray-900 dark:text-gray-100 print:text-gray-900">{new Date(reportCard.generated_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600">Report Date:</span>
                    <span className="text-gray-900 dark:text-gray-100 print:text-gray-900">{new Date(reportCardAsOfDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Summary */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 p-6 rounded-xl mb-8 print:bg-gray-50">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center print:text-gray-900">
                <Award className="h-5 w-5 mr-2" />
                Overall Performance Summary
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 print:text-gray-600 italic">
                Based on assignments due through {new Date(reportCardAsOfDate).toLocaleDateString()}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 print:text-blue-600">{reportCard.summary.overall_percentage.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">Overall Grade</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 print:text-gray-900">{reportCard.summary.overall_letter_grade}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 print:text-green-600">{reportCard.summary.completed_assignments}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">Completed</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 print:text-gray-500">of {reportCard.summary.total_assignments} assignments</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 print:text-purple-600">{reportCard.summary.subjects_count}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">Subjects</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 print:text-orange-600">{formatAttendanceRate(reportCard.summary.attendance_rate)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">Attendance</p>
                </div>
              </div>
            </div>

            {/* Subject Grades */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 print:text-gray-900">Subject Performance</h4>
              <div className="grid gap-4">
                {reportCard.subject_grades?.map((subject: ReportCardSubjectGrade, index: number) => {
                  // Use a compound key that's guaranteed to be unique
                  const uniqueKey = `report-${reportCard.student_id}-${reportCard.term_id}-subject-${subject.subject_id}-${index}`;
                  return (
                    <div key={uniqueKey} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 print:border-gray-300">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: subject.subject_color || '#6B7280' }}
                        />
                        <h5 className="font-semibold text-gray-900 dark:text-gray-100 print:text-gray-900">{subject.subject_name}</h5>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                          subject.percentage_grade >= 90 ? 'bg-green-100 text-green-800' :
                          subject.percentage_grade >= 80 ? 'bg-blue-100 text-blue-800' :
                          subject.percentage_grade >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          subject.percentage_grade >= 60 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        } print:bg-gray-100 print:text-gray-800`}>
                          {subject.letter_grade} ({subject.percentage_grade.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 print:text-gray-600">Assignments</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 print:text-gray-900">{subject.assignments_completed} / {subject.assignments_total}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 print:text-gray-600">Points</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 print:text-gray-900">{subject.points_earned} / {subject.points_possible}</p>
                      </div>
                    </div>
                    {subject.comments && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 print:border-gray-300">
                        <p className="text-sm text-gray-700 dark:text-gray-300 print:text-gray-700 italic">{subject.comments}</p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Teacher Comments */}
            {reportCard.teacher_comments && (
              <div className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900 rounded-xl print:bg-gray-50">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 print:text-gray-900">Teacher Comments</h4>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed print:text-gray-800">{reportCard.teacher_comments}</p>
              </div>
            )}

            {/* Signature Section */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-8 print:border-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="border-b border-gray-400 dark:border-gray-500 pb-1 mb-2 print:border-gray-400">
                    <div className="h-8"></div>
                  </div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">Teacher/Instructor Signature</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 print:text-gray-600">Date: ___________</p>
                </div>
                {reportCard.parent_signature_line && (
                  <div>
                    <div className="border-b border-gray-400 dark:border-gray-500 pb-1 mb-2 print:border-gray-400">
                      <div className="h-8"></div>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 print:text-gray-700">Parent/Guardian Signature</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 print:text-gray-600">Date: ___________</p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600 text-center print:border-gray-300">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic print:text-gray-500">
                  This report card is an official academic document. Please retain for your records.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 print:text-gray-400">
                  OurSchool Homeschool Management System • Academic Report Card
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Loading State */}
      {reportCardLoading && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-12 text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mx-auto mb-4 flex items-center justify-center">
              <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-bounce" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Generating Report Card</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Please wait while we compile your academic report...</p>
            <div className="mt-6">
              <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse transition-all duration-1000" style={{ width: '75%' }}></div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Calculating grades and formatting report...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportCard
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

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Users, Calendar, BookOpen, ClipboardList, TrendingUp, Eye, Activity, Clock, Award, X } from 'lucide-react'
import { reportsApi } from '../services/reports'
import { lessonsApi } from '../services/lessons'
import { pointsApi, type StudentPoints } from '../services/points'
import { activityApi, type ActivityItem } from '../services/activity'
import { termsApi } from '../services/terms'
import { AdminReport, StudentReport, Lesson, Term } from '../types'
import { Subject } from '../types/lesson'
import { DashboardLayout, usePageLayout } from '../components/layouts'
import BulkAttendanceModal from '../components/BulkAttendanceModal'
import QuickCreateTemplateModal from '../components/QuickCreateTemplateModal'
import AssignmentDetailModal from '../components/assignments/AssignmentDetailModal'

// Quick Award Points Modal Component
interface QuickAwardModalProps {
  onClose: () => void
  onSuccess: () => void
}

const QuickAwardModal: React.FC<QuickAwardModalProps> = ({ onClose, onSuccess }) => {
  const [students, setStudents] = useState<StudentPoints[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStudents()
  }, [])

  // ESC key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const loadStudents = async () => {
    try {
      setLoadingStudents(true)
      const overview = await pointsApi.getAdminOverview()
      setStudents(overview.student_points)
    } catch (err: any) {
      setError('Failed to load students')
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedStudentId || !amount || !notes.trim()) {
      setError('Please fill in all fields')
      return
    }

    const pointAmount = parseInt(amount)
    if (isNaN(pointAmount) || pointAmount <= 0) {
      setError('Please enter a valid positive point amount')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await pointsApi.adjustPoints({
        student_id: parseInt(selectedStudentId),
        amount: pointAmount,
        notes: notes.trim()
      })
      
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to award points')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
            <Award className="h-5 w-5 mr-2 text-yellow-500" />
            Quick Award Points
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Student
            </label>
            {loadingStudents ? (
              <div className="bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md h-10"></div>
            ) : (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Choose a student...</option>
                {students.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.student_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Points to Award
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter number of points"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Award
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why you're awarding these points..."
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingStudents}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              {loading ? 'Awarding...' : 'Award Points'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { loading, setLoading } = usePageLayout({ initialLoading: true })
  const [adminReport, setAdminReport] = useState<AdminReport | null>(null)
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null)
  const [activeTerm, setActiveTerm] = useState<Term | null>(null)
  const [, setUpcomingLessons] = useState<Lesson[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [showRecentActivity, setShowRecentActivity] = useState(false)
  const [activityLoading, setActivityLoading] = useState(true)
  const [showAwardModal, setShowAwardModal] = useState(false)
  const [showBulkAttendanceModal, setShowBulkAttendanceModal] = useState(false)
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false)
  const [showAssignmentDetailModal, setShowAssignmentDetailModal] = useState(false)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  
  const isAdmin = user?.role === 'admin'

  const handleAwardSuccess = () => {
    // Could show a success message here if needed
  }

  const handleAttendanceSuccess = () => {
    // Optionally refresh dashboard data or show success message
  }

  const handleTemplateSuccess = () => {
    // Optionally refresh dashboard data or show success message
  }

  const handleActivityClick = (activity: ActivityItem) => {
    // Check if this is an assignment-related activity and has assignment_id
    const assignmentId = activity.details?.assignment_id || activity.details?.student_assignment_id
    if (assignmentId) {
      setSelectedAssignmentId(assignmentId)
      setShowAssignmentDetailModal(true)
    }
  }

  const isAssignmentActivity = (activity: ActivityItem) => {
    // Check if this activity is assignment-related
    return activity.activity_type?.includes('assignment') || 
           activity.details?.assignment_id || 
           activity.details?.student_assignment_id ||
           activity.description?.toLowerCase().includes('assignment')
  }

  // Helper function to get subject color
  const getSubjectColor = (subjectName: string) => {
    const subject = subjects.find(s => s.name === subjectName)
    return subject?.color || '#6B7280' // Default to gray-500 if not found
  }

  // Helper function to get local date in YYYY-MM-DD format
  const getLocalDateString = (daysOffset = 0) => {
    const date = new Date()
    // Use proper date arithmetic that handles month boundaries correctly
    date.setTime(date.getTime() + (daysOffset * 24 * 60 * 60 * 1000))
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Calculate days remaining in active term
  const calculateDaysRemaining = (term: Term | null) => {
    if (!term) return null
    
    // Use date-only comparison to avoid timezone issues
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset to start of day
    
    const endDate = new Date(term.end_date)
    endDate.setHours(0, 0, 0, 0) // Reset to start of day
    
    // Calculate difference in days using date-only math
    const timeDiff = endDate.getTime() - today.getTime()
    const daysDiff = Math.round(timeDiff / (1000 * 3600 * 24))
    
    return daysDiff
  }

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)
        
        if (isAdmin) {
          // Load admin data
          const [adminData, lessonsData, subjectsData, termData] = await Promise.all([
            reportsApi.getAdminReport(),
            lessonsApi.getAll({
              start_date: getLocalDateString(),
              end_date: getLocalDateString(7)
            }),
            lessonsApi.getSubjects(),
            termsApi.getActive()
          ])
          
          setAdminReport(adminData)
          setUpcomingLessons(lessonsData || [])
          setSubjects(subjectsData || [])
          setActiveTerm(termData)
        } else {
          // Load student data
          const [studentData, subjectsData, termData] = await Promise.all([
            reportsApi.getStudentReport(),
            lessonsApi.getSubjects(),
            termsApi.getActive()
          ])
          setStudentReport(studentData)
          setSubjects(subjectsData || [])
          setActiveTerm(termData)
        }
      } catch (error) {
      } finally {
        setLoading(false)
      }
    }
    
    loadDashboardData()
  }, [isAdmin])

  // Load activity data separately
  useEffect(() => {
    const loadActivityData = async () => {
      try {
        setActivityLoading(true)
        const activities = await activityApi.getDashboardActivity()
        setRecentActivity(activities || [])
      } catch (error) {
        // Fallback to empty array on error
        setRecentActivity([])
      } finally {
        setActivityLoading(false)
      }
    }
    
    if (user?.id) {
      loadActivityData()
    }
  }, [user?.id])
  
  // Calculate stats based on loaded data
  const stats = isAdmin && adminReport ? [
    {
      name: 'Active Students',
      value: adminReport.total_students.toString(),
      icon: Users,
      color: 'bg-blue-500',
      link: '/users',
    },
    {
      name: 'Active Assignments',
      value: adminReport.active_assignments.toString(),
      icon: ClipboardList,
      color: 'bg-green-500',
      link: '/assignments',
    },
    {
      name: 'Pending Grades',
      value: adminReport.pending_grades.toString(),
      icon: BookOpen,
      color: 'bg-purple-500',
      link: '/assignments?view=grading',
    },
    {
      name: 'Days Remaining in Term',
      value: (() => {
        const days = calculateDaysRemaining(activeTerm)
        if (days === null) return 'No term'
        if (days < 0) return 'Term ended'
        if (days === 0) return 'Last day'
        return days.toString()
      })(),
      icon: Calendar,
      color: 'bg-orange-500',
      link: '/terms',
    },
  ] : studentReport ? [
    {
      name: 'Active Assignments',
      value: studentReport.in_progress_assignments.toString(),
      icon: ClipboardList,
      color: 'bg-blue-500',
      link: '/assignments',
    },
    {
      name: 'Completed',
      value: studentReport.completed_assignments.toString(),
      icon: BookOpen,
      color: 'bg-green-500',
      link: '/assignments',
    },
    {
      name: 'In Progress',
      value: studentReport.in_progress_assignments.toString(),
      icon: Calendar,
      color: 'bg-purple-500',
      link: '/assignments',
    },
    {
      name: 'Days Remaining in Term',
      value: (() => {
        const days = calculateDaysRemaining(activeTerm)
        if (days === null) return 'No term'
        if (days < 0) return 'Term ended'
        if (days === 0) return 'Last day'
        return days.toString()
      })(),
      icon: Calendar,
      color: 'bg-orange-500',
      link: '/terms',
    },
  ] : []

  return (
    <DashboardLayout
      title="Welcome back"
      subtitle="Here's what's happening with your homeschool program today."
      userName={user?.first_name}
      stats={stats}
      loading={loading}
    >

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Recent Activity */}
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-600 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                Recent Activity
              </h3>
              <button
                onClick={() => setShowRecentActivity(!showRecentActivity)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Eye className="h-4 w-4 mr-1" />
                {showRecentActivity ? 'Hide' : 'View All'}
              </button>
            </div>
          </div>
          <div className="p-6">
            {activityLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-start space-x-3 animate-pulse">
                    <div className="flex-shrink-0 w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-gray-300 rounded mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity to display</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Activity will appear here as you use the system</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(showRecentActivity ? recentActivity : recentActivity.slice(0, 3)).map((activity, index) => {
                  const isClickable = isAssignmentActivity(activity)
                  return (
                    <div 
                      key={index} 
                      className={`flex items-start space-x-4 p-3 rounded-lg transition-colors ${
                        isClickable 
                          ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer hover:shadow-sm' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => isClickable && handleActivityClick(activity)}
                      title={isClickable ? 'Click to view assignment details' : undefined}
                    >
                      <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-1.5 shadow-sm ${
                        isClickable 
                          ? 'bg-gradient-to-r from-green-500 to-green-600' 
                          : 'bg-gradient-to-r from-blue-500 to-blue-600'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold mb-1 ${
                          isClickable 
                            ? 'text-green-800 dark:text-green-200' 
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {activity.description}
                          {isClickable && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">📋 View Details</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {activity.student_name && `${activity.student_name} • `}{activity.time_ago}
                        </p>
                        {activity.details?.subject && (
                          <span 
                            className="inline-block mt-1 px-2 py-1 text-xs rounded-full text-white font-medium shadow-sm"
                            style={{ 
                              backgroundColor: getSubjectColor(activity.details.subject),
                              opacity: 0.9
                            }}
                          >
                            {activity.details.subject}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {!showRecentActivity && recentActivity.length > 3 && (
                  <div className="text-center pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {recentActivity.length - 3} more activities...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Quick Actions */}
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-600 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-t-xl">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              Quick Actions
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {isAdmin ? (
                <>
                  <button 
                    onClick={() => setShowAwardModal(true)}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-700 dark:hover:text-yellow-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-yellow-200 dark:hover:border-yellow-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                      <Award className="h-4 w-4 text-yellow-600" />
                    </div>
                    Award Points to Student
                  </button>
                  <button 
                    onClick={() => setShowBulkAttendanceModal(true)}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    Mark Today's Attendance
                  </button>
                  <button 
                    onClick={() => navigate('/lessons')}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-200 dark:hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <BookOpen className="h-4 w-4 text-purple-600" />
                    </div>
                    Create New Lesson
                  </button>
                  <button 
                    onClick={() => setShowCreateTemplateModal(true)}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-200 dark:hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <ClipboardList className="h-4 w-4 text-green-600" />
                    </div>
                    Create Assignment Template
                  </button>
                  <button 
                    onClick={() => navigate('/users')}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700 dark:hover:text-orange-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-orange-200 dark:hover:border-orange-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                      <Users className="h-4 w-4 text-orange-600" />
                    </div>
                    Manage Students
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => navigate('/assignments')}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                    </div>
                    View My Assignments
                  </button>
                  <button 
                    onClick={() => navigate('/lessons')}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-purple-200 dark:hover:border-purple-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <BookOpen className="h-4 w-4 text-purple-600" />
                    </div>
                    View Lessons
                  </button>
                  <button 
                    onClick={() => navigate('/reports')}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-200 dark:hover:border-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    View Progress Reports
                  </button>
                  <button 
                    onClick={() => navigate('/profile')}
                    className="w-full flex items-center px-4 py-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-700 dark:hover:text-orange-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-orange-200 dark:hover:border-orange-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                      <Users className="h-4 w-4 text-orange-600" />
                    </div>
                    Update Profile
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Award Points Modal */}
      {showAwardModal && (
        <QuickAwardModal
          onClose={() => setShowAwardModal(false)}
          onSuccess={handleAwardSuccess}
        />
      )}

      {/* Bulk Attendance Modal */}
      <BulkAttendanceModal
        isOpen={showBulkAttendanceModal}
        onClose={() => setShowBulkAttendanceModal(false)}
        onSuccess={handleAttendanceSuccess}
      />

      {/* Quick Create Template Modal */}
      <QuickCreateTemplateModal
        isOpen={showCreateTemplateModal}
        onClose={() => setShowCreateTemplateModal(false)}
        onSuccess={handleTemplateSuccess}
      />

      {/* Assignment Detail Modal */}
      {showAssignmentDetailModal && selectedAssignmentId && (
        <AssignmentDetailModal
          assignmentId={selectedAssignmentId}
          isOpen={showAssignmentDetailModal}
          onClose={() => {
            setShowAssignmentDetailModal(false)
            setSelectedAssignmentId(null)
          }}
        />
      )}
    </DashboardLayout>
  )
}

export default Dashboard
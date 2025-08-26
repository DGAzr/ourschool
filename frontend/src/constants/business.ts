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

/**
 * Business logic constants for the homeschool application
 */

// Grade scale
export const GRADE_SCALE = {
  A_PLUS: { min: 97, letter: 'A+' },
  A: { min: 93, letter: 'A' },
  A_MINUS: { min: 90, letter: 'A-' },
  B_PLUS: { min: 87, letter: 'B+' },
  B: { min: 83, letter: 'B' },
  B_MINUS: { min: 80, letter: 'B-' },
  C_PLUS: { min: 77, letter: 'C+' },
  C: { min: 73, letter: 'C' },
  C_MINUS: { min: 70, letter: 'C-' },
  D_PLUS: { min: 67, letter: 'D+' },
  D: { min: 63, letter: 'D' },
  D_MINUS: { min: 60, letter: 'D-' },
  F: { min: 0, letter: 'F' }
} as const

// Assignment types
export const ASSIGNMENT_TYPES = {
  HOMEWORK: 'homework',
  QUIZ: 'quiz',
  TEST: 'test', 
  PROJECT: 'project',
  ESSAY: 'essay',
  LAB: 'lab',
  PRESENTATION: 'presentation',
  DISCUSSION: 'discussion'
} as const

// Assignment status options
export const ASSIGNMENT_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress', 
  SUBMITTED: 'submitted',
  GRADED: 'graded',
  OVERDUE: 'overdue',
  ARCHIVED: 'archived'
} as const

// Difficulty levels
export const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate', 
  ADVANCED: 'advanced',
  EXPERT: 'expert'
} as const

// Attendance status
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  TARDY: 'tardy',
  EXCUSED: 'excused'
} as const

// Points system
export const POINTS_SYSTEM = {
  DEFAULT_MAX_POINTS: 100,
  BONUS_POINTS_LIMIT: 10,
  MINIMUM_POINTS: 0,
  GRADE_THRESHOLDS: {
    EXCELLENT: 95,
    GOOD: 85,
    SATISFACTORY: 70,
    NEEDS_IMPROVEMENT: 60
  }
} as const

// Term durations (in weeks)
export const TERM_DURATIONS = {
  QUARTER: 9,
  SEMESTER: 18,
  TRIMESTER: 12,
  YEAR: 36
} as const

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  INPUT: 'yyyy-MM-dd',
  FULL: 'EEEE, MMMM dd, yyyy',
  SHORT: 'MM/dd/yyyy',
  TIME: 'h:mm a'
} as const

// Report types
export const REPORT_TYPES = {
  OVERVIEW: 'overview',
  TERM_REPORT: 'term_report',
  ATTENDANCE: 'attendance',
  ASSIGNMENTS: 'assignments', 
  REPORT_CARD: 'report_card',
  PROGRESS: 'progress'
} as const

// Default values
export const DEFAULTS = {
  ASSIGNMENT_MAX_POINTS: 100,
  LESSON_DURATION: 45, // minutes
  TERM_LENGTH: 18, // weeks
  SCHOOL_YEAR_START: 'September',
  GRADING_SCALE: 'standard'
} as const
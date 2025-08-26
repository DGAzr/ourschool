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
 * TypeScript type definitions for OurSchool application
 * 
 * This file re-exports all type definitions organized by domain.
 * Import specific types from domain files for better tree-shaking,
 * or import from this index for convenience.
 */

// User and authentication types
export * from './user'

// Assignment and assessment types
export * from './assignment'

// Lesson and subject types
export * from './lesson'

// Attendance tracking types
export * from './attendance'

// Reporting and analytics types
export * from './reports'

// API and error handling types
export * from './api'

// UI component prop types
export * from './ui'
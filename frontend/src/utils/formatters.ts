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
 * Utility functions for formatting data in the UI
 */

/**
 * Format a percentage value, showing 'N/A' for null/undefined values
 * @param value - The percentage value (0-100)
 * @param decimals - Number of decimal places to show (default: 1)
 * @returns Formatted percentage string with % symbol
 */
export const formatPercentage = (value: number | null | undefined, decimals: number = 1): string => {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format attendance rate specifically
 * @param attendanceRate - The attendance rate (0-100)
 * @returns Formatted attendance rate string
 */
export const formatAttendanceRate = (attendanceRate: number | null | undefined): string => {
  return formatPercentage(attendanceRate, 1);
};

/**
 * Format grade percentage
 * @param grade - The grade percentage (0-100)
 * @returns Formatted grade string
 */
export const formatGrade = (grade: number | null | undefined): string => {
  return formatPercentage(grade, 1);
};

/**
 * Format a date string (YYYY-MM-DD) without timezone issues
 * This function avoids timezone conversion by parsing the date components directly
 * instead of relying on Date constructor with ISO strings
 * @param dateString - Date string in YYYY-MM-DD format
 * @param options - Intl.DateTimeFormat options (optional)
 * @returns Formatted date string
 */
export const formatDateOnly = (
  dateString?: string, 
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!dateString) return 'Not set';
  
  // Parse the date components manually to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date object with local components (not UTC)
  const date = new Date(year, month - 1, day);
  
  // Use default US format if no options provided
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return date.toLocaleDateString('en-US', options || defaultOptions);
};
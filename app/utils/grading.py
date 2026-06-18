# OurSchool - Homeschool Management System
# Copyright (C) 2025 Dustan Ashley
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
Shared grading utilities.

Centralized letter-grade calculation to prevent divergence between
report-card, term-grading, and assignment-grading code paths.
"""


def calculate_letter_grade(percentage: float) -> str:
    """Calculate letter grade from percentage (A+/A/A- scale).
    
    Uses a 13-band scale with plus/minus granularity.
    
    Args:
        percentage: Grade percentage (0-100)
        
    Returns:
        Letter grade string (e.g. "A+", "B-", "F")
    """
    if percentage >= 97:
        return "A+"
    if percentage >= 93:
        return "A"
    if percentage >= 90:
        return "A-"
    if percentage >= 87:
        return "B+"
    if percentage >= 83:
        return "B"
    if percentage >= 80:
        return "B-"
    if percentage >= 77:
        return "C+"
    if percentage >= 73:
        return "C"
    if percentage >= 70:
        return "C-"
    if percentage >= 67:
        return "D+"
    if percentage >= 63:
        return "D"
    if percentage >= 60:
        return "D-"
    return "F"

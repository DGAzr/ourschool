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

export const DEFAULT_CATEGORY_COLOR = '#9A8A4F'
export const DEFAULT_CATEGORY_ICON = '✦'

/** ~10% alpha tint of a category color (background wash). */
export const tint = (color: string): string => `${color}1A`
/** ~13% alpha tint for the badge background. */
export const badgeBg = (color: string): string => `${color}22`

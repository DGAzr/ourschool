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

/** Shared grade-display helpers — ported from the design prototype. */

export function letter(p: number): string {
  if (p >= 93) return 'A'
  if (p >= 90) return 'A-'
  if (p >= 87) return 'B+'
  if (p >= 83) return 'B'
  if (p >= 80) return 'B-'
  if (p >= 77) return 'C+'
  if (p >= 73) return 'C'
  if (p >= 70) return 'C-'
  if (p >= 67) return 'D+'
  if (p >= 60) return 'D'
  return 'F'
}

export function gradeColor(p: number): string {
  if (p >= 90) return 'var(--pos-fg)'
  if (p >= 80) return '#4F7CAC'
  if (p >= 70) return 'var(--neutral)'
  return 'var(--neg-fg)'
}

export function barColor(p: number): string {
  if (p < 80) return 'var(--neg-fg)'
  if (p >= 90) return 'var(--pos-fg)'
  return 'var(--accent)'
}

export interface TrendInfo {
  arrow: string
  color: string
  text: string
}

export function trendInfo(t: number): TrendInfo {
  if (t > 2) return { arrow: '▲', color: 'var(--pos-fg)', text: `+${t}` }
  if (t < -2) return { arrow: '▼', color: 'var(--neg-fg)', text: String(t) }
  return { arrow: '▬', color: 'var(--neutral)', text: 'steady' }
}

export function statusStyle(status: string): React.CSSProperties {
  const styles: Record<string, React.CSSProperties> = {
    Thriving: { color: 'var(--pos-fg)', background: 'rgba(78,141,110,.14)' },
    Steady: { color: 'var(--muted)', background: 'var(--track)' },
    'Needs attention': { color: 'var(--accent)', background: 'var(--accent-soft)' },
  }
  return {
    display: 'inline-flex',
    padding: '3px 10px',
    borderRadius: '9999px',
    fontSize: '11.5px',
    fontWeight: 600,
    ...(styles[status] ?? styles['Steady']),
  }
}

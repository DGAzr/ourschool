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

interface SparklineProps {
  series: number[]
  color?: string
  width?: number
  height?: number
}

function buildPoints(series: number[], w: number, h: number): string {
  if (series.length < 2) return ''
  const p = 3
  const lo = Math.min(...series)
  const hi = Math.max(...series)
  const rng = hi - lo || 1
  return series
    .map((v, i) => {
      const x = p + (i * (w - 2 * p)) / (series.length - 1)
      const y = h - p - ((v - lo) / rng) * (h - 2 * p)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

const Sparkline: React.FC<SparklineProps> = ({
  series,
  color = 'var(--pos-fg)',
  width = 64,
  height = 22,
}) => {
  if (!series || series.length < 2) return null
  const points = buildPoints(series, width, height)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width, height, display: 'block' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default Sparkline

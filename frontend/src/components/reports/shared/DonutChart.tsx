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

interface DonutSegment {
  label: string
  count: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  total: number
  size?: number
}

const DonutChart: React.FC<DonutChartProps> = ({ segments, total, size = 160 }) => {
  let acc = 0
  const stops = segments.map((s) => {
    const from = total > 0 ? (acc / total) * 100 : 0
    acc += s.count
    const to = total > 0 ? (acc / total) * 100 : 0
    return `${s.color} ${from.toFixed(1)}% ${to.toFixed(1)}%`
  })
  const gradient = `conic-gradient(${stops.join(', ')})`
  const inner = Math.round(size * 0.625)
  const offset = Math.round((size - inner) / 2)

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '9999px',
          background: gradient,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: offset,
          left: offset,
          width: inner,
          height: inner,
          borderRadius: '9999px',
          background: 'var(--panel)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1,
          }}
        >
          {total}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3 }}>total</span>
      </div>
    </div>
  )
}

export default DonutChart

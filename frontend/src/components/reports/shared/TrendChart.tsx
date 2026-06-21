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

interface TrendChartProps {
  series: number[]
  labels?: string[]
  height?: number
  lineColor?: string
  fillColor?: string
}

function buildLine(
  series: number[],
  w: number,
  h: number,
  lo: number,
  hi: number,
): { poly: string; area: string } {
  const p = 6
  const rng = hi - lo || 1
  const pts = series.map((v, i) => {
    const x = p + (i * (w - 2 * p)) / (series.length - 1)
    const y = h - p - ((v - lo) / rng) * (h - 2 * p)
    return [x, y] as [number, number]
  })
  const poly = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area =
    poly +
    ` ${(w - p).toFixed(1)},${h - p} ${p},${h - p}`
  return { poly, area }
}

const TrendChart: React.FC<TrendChartProps> = ({
  series,
  labels,
  height = 168,
  lineColor = 'var(--accent)',
  fillColor = 'var(--accent-soft)',
}) => {
  const w = 320

  if (!series || series.length < 2) {
    return (
      <div
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="text-[12px] text-faint"
      >
        Not enough data
      </div>
    )
  }

  const lo = Math.min(...series, 50)
  const hi = Math.max(...series, 100)
  const { poly, area } = buildLine(series, w, height, lo, hi)

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block', marginTop: 6 }}
      >
        <polygon points={area} fill={fillColor} />
        <polyline
          points={poly}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      {labels && labels.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: 'var(--faint)',
          }}
        >
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default TrendChart

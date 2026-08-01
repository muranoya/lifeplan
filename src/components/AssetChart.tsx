import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { YearSnapshot } from '../engine'
import { formatYen } from '../lib/format'

export interface ChartSeries {
  id: string
  label: string
  yearly: YearSnapshot[]
  color: string
}

interface Props {
  series: ChartSeries[]
  retireAge?: number
  fireAge?: number | null
  depletionAge?: number | null
}

const W = 720
const H = 320
const PAD = { top: 24, right: 16, bottom: 36, left: 64 }

interface TooltipState {
  age: number
  svgX: number
  values: { label: string; color: string; assets: number }[]
}

export function AssetChart({ series, retireAge, fireAge, depletionAge }: Props) {
  const model = useMemo(() => buildModel(series), [series])
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TooltipState | null>(null)

  const onMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (!model || !wrapRef.current) return
      const svg = e.currentTarget
      const rect = svg.getBoundingClientRect()
      const svgX = ((e.clientX - rect.left) / rect.width) * W
      const { xMin, xMax } = model
      const innerW = W - PAD.left - PAD.right
      if (svgX < PAD.left || svgX > PAD.left + innerW) {
        setTip(null)
        return
      }
      const t = (svgX - PAD.left) / innerW
      const ageFloat = xMin + t * (xMax - xMin || 1)
      const age = Math.round(ageFloat)
      const clamped = Math.min(xMax, Math.max(xMin, age))

      const values: TooltipState['values'] = []
      for (const s of series) {
        const pt = s.yearly.find((y) => y.age === clamped)
        if (pt) {
          values.push({ label: s.label, color: s.color, assets: pt.assets })
        }
      }
      if (values.length === 0) {
        setTip(null)
        return
      }
      setTip({
        age: clamped,
        svgX: PAD.left + ((clamped - xMin) / (xMax - xMin || 1)) * innerW,
        values,
      })
    },
    [model, series],
  )

  const onLeave = useCallback(() => setTip(null), [])

  if (!model || series.length === 0) {
    return <p className="empty-hint">表示するデータがありません</p>
  }

  const { xMin, xMax, yMax, paths, ticksX, ticksY } = model
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const x = (age: number) => PAD.left + ((age - xMin) / (xMax - xMin || 1)) * innerW
  const y = (v: number) => PAD.top + innerH - (v / (yMax || 1)) * innerH

  const tipLeftPct = tip ? (tip.svgX / W) * 100 : 0

  return (
    <div className="chart" ref={wrapRef}>
      <div className="chart-frame">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="資産推移グラフ"
          className="chart-svg"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          {ticksY.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="grid-line"
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                className="axis-label"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatYen(t, true)}
              </text>
            </g>
          ))}
          {ticksX.map((t) => (
            <text key={t} x={x(t)} y={H - 10} className="axis-label" textAnchor="middle">
              {t}
            </text>
          ))}

          {retireAge !== undefined && retireAge >= xMin && retireAge <= xMax && (
            <g>
              <line
                x1={x(retireAge)}
                x2={x(retireAge)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="mark-line retire"
              />
              <text x={x(retireAge) + 4} y={PAD.top + 12} className="mark-label">
                退職 {retireAge}
              </text>
            </g>
          )}
          {fireAge != null && fireAge >= xMin && fireAge <= xMax && (
            <g>
              <line
                x1={x(fireAge)}
                x2={x(fireAge)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="mark-line fire"
              />
            </g>
          )}
          {depletionAge != null && depletionAge >= xMin && depletionAge <= xMax && (
            <g>
              <line
                x1={x(depletionAge)}
                x2={x(depletionAge)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="mark-line deplete"
              />
            </g>
          )}

          {paths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {tip && (
            <g className="chart-crosshair" pointerEvents="none">
              <line
                x1={tip.svgX}
                x2={tip.svgX}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="crosshair-line"
              />
              {tip.values.map((v, i) => (
                <circle
                  key={i}
                  cx={tip.svgX}
                  cy={y(v.assets)}
                  r={4}
                  fill={v.color}
                  stroke="var(--bg-elevated)"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          )}

          {/* ヒット領域 */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            className="chart-hit"
          />
        </svg>

        {tip && (
          <div
            className={`chart-tooltip ${tipLeftPct > 70 ? 'flip' : ''}`}
            style={{ left: `${tipLeftPct}%` }}
          >
            <p className="chart-tooltip-age">{tip.age}歳</p>
            <ul>
              {tip.values.map((v) => (
                <li key={v.label}>
                  <span className="swatch" style={{ background: v.color }} />
                  <span className="chart-tooltip-label">{v.label}</span>
                  <span className="chart-tooltip-val">{formatYen(v.assets)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <ul className="chart-legend">
        {series.map((s) => (
          <li key={s.id}>
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function buildModel(series: ChartSeries[]) {
  const all = series.flatMap((s) => s.yearly)
  if (all.length === 0) return null
  const xMin = Math.min(...all.map((y) => y.age))
  const xMax = Math.max(...all.map((y) => y.age))
  const rawMax = Math.max(...all.map((y) => y.assets), 1)
  const yMax = niceMax(rawMax)

  const paths = series.map((s) => {
    const pts = s.yearly.map((pt, i) => {
      const px =
        PAD.left + ((pt.age - xMin) / (xMax - xMin || 1)) * (W - PAD.left - PAD.right)
      const py =
        PAD.top +
        (H - PAD.top - PAD.bottom) -
        (pt.assets / yMax) * (H - PAD.top - PAD.bottom)
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`
    })
    return { id: s.id, color: s.color, d: pts.join(' ') }
  })

  const ticksX = buildTicks(xMin, xMax, 8).map(Math.round)
  const ticksY = buildTicks(0, yMax, 5)

  return { xMin, xMax, yMax, paths, ticksX, ticksY }
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / exp
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * exp
}

function buildTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min]
  const step = (max - min) / count
  const ticks: number[] = []
  for (let i = 0; i <= count; i++) {
    ticks.push(min + step * i)
  }
  return ticks
}

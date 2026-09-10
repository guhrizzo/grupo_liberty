'use client'

import { useState } from 'react'
import type { DiaSerie } from './data'

const W = 720
const H = 240
const PAD = { top: 16, right: 12, bottom: 26, left: 32 }

function ddmm(date: string): string {
  const [, m, d] = date.split('-')
  return d && m ? `${d}/${m}` : date
}

export default function VisitorsChart({ serie }: { serie: DiaSerie[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const temDados = serie.length > 0 && serie.some((d) => d.pageviews > 0)
  if (!temDados) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-400 adobe-dark:border-adobe-line adobe-dark:text-adobe-text-lo">
        Sem dados ainda
      </div>
    )
  }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const maxY = Math.max(1, ...serie.map((d) => d.uniqueVisitors))

  const x = (i: number) =>
    PAD.left + (serie.length === 1 ? plotW / 2 : (i / (serie.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH

  const linha = (sel: (d: DiaSerie) => number) =>
    serie.map((d, i) => `${x(i)},${y(sel(d))}`).join(' ')

  // ~5 rótulos no eixo X
  const passo = Math.max(1, Math.ceil(serie.length / 6))

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 'auto' }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Gráfico de visitantes únicos por dia nos últimos 30 dias"
      >
        {/* grade horizontal + rótulos Y (0, meio, topo) */}
        {[0, 0.5, 1].map((t) => {
          const gy = PAD.top + plotH - t * plotH
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={gy}
                y2={gy}
                className="stroke-neutral-200 adobe-dark:stroke-adobe-line"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={gy + 3}
                textAnchor="end"
                className="fill-neutral-400 text-[9px]"
              >
                {Math.round(t * maxY)}
              </text>
            </g>
          )
        })}

        {/* rótulos X */}
        {serie.map((d, i) =>
          i % passo === 0 || i === serie.length - 1 ? (
            <text
              key={d.date}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-neutral-400 text-[9px]"
            >
              {ddmm(d.date)}
            </text>
          ) : null,
        )}

        <polyline
          points={linha((d) => d.uniqueVisitors)}
          fill="none"
          className="stroke-liberty"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={linha((d) => d.loggedVisitors)}
          fill="none"
          className="stroke-emerald-500"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="stroke-neutral-300 adobe-dark:stroke-adobe-line"
            strokeWidth={1}
          />
        )}
        {hover !== null && (
          <>
            <circle cx={x(hover)} cy={y(serie[hover].uniqueVisitors)} r={3} className="fill-liberty" />
            <circle cx={x(hover)} cy={y(serie[hover].loggedVisitors)} r={3} className="fill-emerald-500" />
          </>
        )}

        {/* faixas de captura do hover */}
        {serie.map((d, i) => {
          const bw = plotW / serie.length
          return (
            <rect
              key={d.date}
              x={x(i) - bw / 2}
              y={PAD.top}
              width={bw}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-3"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 0,
          }}
        >
          <div className="font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
            {ddmm(serie[hover].date)}
          </div>
          <div className="text-liberty-deep adobe-dark:text-adobe-accent-soft">
            {serie[hover].uniqueVisitors} visitantes
          </div>
          <div className="text-emerald-600 adobe-dark:text-emerald-400">
            {serie[hover].loggedVisitors} logados
          </div>
        </div>
      )}
    </div>
  )
}

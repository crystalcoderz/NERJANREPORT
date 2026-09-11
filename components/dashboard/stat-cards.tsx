"use client"

import useSWR from "swr"
import { Truck, Cloud, ShieldCheck, TriangleAlert, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { stats as mockStats } from "@/lib/data"
import { Panel } from "./panel"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const icons = {
  truck: Truck,
  cloud: Cloud,
  check: ShieldCheck,
  alert: TriangleAlert,
}

const toneStyles: Record<string, string> = {
  info: "bg-info-bg text-info",
  moderate: "bg-risk-moderate-bg text-risk-moderate",
  low: "bg-risk-low-bg text-risk-low",
  high: "bg-risk-high-bg text-risk-high",
}

function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  const w = 64
  const h = 24
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((d - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  const color =
    tone === "high"
      ? "var(--risk-high)"
      : tone === "moderate"
        ? "var(--risk-moderate)"
        : tone === "info"
          ? "var(--info)"
          : "var(--risk-low)"
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCards() {
  const { data } = useSWR<{ source: string; alerts: unknown[] }>("/api/weather-alerts", fetcher, {
    refreshInterval: 60000,
  })

  const liveAlertCount = data?.alerts?.length
  const previousCount = mockStats.find((s) => s.id === "weather")?.spark.at(-2) ?? liveAlertCount

  const stats = mockStats.map((s) => {
    if (s.id !== "weather" || liveAlertCount === undefined) return s
    const delta = previousCount ? liveAlertCount - previousCount : 0
    return {
      ...s,
      value: String(liveAlertCount),
      delta: delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${delta}`,
      spark: [...s.spark.slice(1), liveAlertCount],
    }
  })

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map((s) => {
        const Icon = icons[s.icon]
        return (
          <Panel key={s.id} className="p-4">
            <div className="flex items-start justify-between">
              <span className={cn("flex size-9 items-center justify-center rounded-lg", toneStyles[s.tone])}>
                <Icon className="size-5" />
              </span>
              <Sparkline data={s.spark} tone={s.tone} />
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="font-mono text-2xl font-bold leading-none text-foreground">{s.value}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.label}</p>
              </div>
              <span
                className={cn(
                  "mb-0.5 inline-flex items-center gap-0.5 text-xs font-semibold",
                  s.tone === "high" || s.tone === "moderate" ? "text-risk-high" : "text-risk-low",
                )}
              >
                <ArrowUpRight className="size-3" />
                {s.delta}
              </span>
            </div>
          </Panel>
        )
      })}
    </div>
  )
}

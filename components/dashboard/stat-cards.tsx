"use client"

import useSWR from "swr"
import { cn } from "@/lib/utils"
import { stats as mockStats } from "@/lib/data"
import { deriveTripStatus } from "@/lib/trip-status"
import type { Trip } from "@/app/api/trips/route"
import type { LiveIncident } from "@/app/api/incidents/route"
import { Panel } from "./panel"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const dotStyles: Record<string, string> = {
  info: "bg-info",
  moderate: "bg-risk-moderate",
  low: "bg-risk-low",
  high: "bg-risk-high",
}

const deltaStyles: Record<string, string> = {
  info: "text-info",
  moderate: "text-risk-moderate",
  low: "text-risk-low",
  high: "text-risk-high",
}

function Sparkline({ data, tone }: { data: number[]; tone: string }) {
  const w = 72
  const h = 18
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible opacity-70" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCards() {
  const { data } = useSWR<{ source: string; alerts: unknown[] }>("/api/weather-alerts", fetcher, {
    refreshInterval: 60000,
  })
  const { data: tripsData } = useSWR<{ trips: Trip[] }>("/api/trips", fetcher, {
    refreshInterval: 15000,
  })
  const { data: incidentsData } = useSWR<{ incidents: LiveIncident[] }>("/api/incidents", fetcher, {
    refreshInterval: 30000,
  })

  const liveAlertCount = data?.alerts?.length

  const trips = tripsData?.trips
  const activeShipmentCount = trips?.filter((t) => deriveTripStatus(t).label !== "Completed").length
  const onTimePct =
    trips && trips.length > 0
      ? Math.round((trips.filter((t) => deriveTripStatus(t).label !== "Overdue").length / trips.length) * 100)
      : undefined

  const incidentList = incidentsData?.incidents
  const highRiskRouteCount = incidentList
    ? new Set(incidentList.filter((i) => i.level === "high").map((i) => i.corridor)).size
    : undefined

  const liveValues: Record<string, number | undefined> = {
    active: activeShipmentCount,
    weather: liveAlertCount,
    ontime: onTimePct,
    risk: highRiskRouteCount,
  }

  const stats = mockStats.map((s) => {
    const liveValue = liveValues[s.id]
    if (liveValue === undefined) return s
    const previous = s.spark.at(-2) ?? liveValue
    const delta = liveValue - previous
    const suffix = s.id === "ontime" ? "%" : ""
    const deltaSuffix = s.id === "ontime" ? "%" : ""
    return {
      ...s,
      value: `${liveValue}${suffix}`,
      delta: delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${delta}${deltaSuffix}`,
      spark: [...s.spark.slice(1), liveValue],
    }
  })

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {stats.map((s) => (
        <Panel key={s.id} className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {s.label}
            </span>
            <span className={cn("size-1.5 shrink-0 rounded-full", dotStyles[s.tone])} aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-[28px] font-semibold leading-none tabular-nums text-foreground">
            {s.value}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
            <span className={cn("font-mono text-xs tabular-nums", deltaStyles[s.tone])}>{s.delta}</span>
            <Sparkline data={s.spark} tone={s.tone} />
          </div>
        </Panel>
      ))}
    </div>
  )
}

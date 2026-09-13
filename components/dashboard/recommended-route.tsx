"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { ArrowRight, Route, Clock, ShieldCheck, ShieldAlert, Shield, Sparkles, RefreshCw } from "lucide-react"
import { cities, type RiskLevel } from "@/lib/data"
import type { LiveIncident } from "@/app/api/incidents/route"
import { Panel } from "./panel"
import { useRoute } from "./route-context"
import { SubmitTripDialog } from "./submit-trip-dialog"

type Analysis = { provider: string; analysis: string }
type Weather = { condition: string; tempC: number; visibilityKm: number }

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const riskUi: Record<RiskLevel, { label: string; className: string; badge: string; Icon: typeof Shield }> = {
  low: { label: "Safest Option", className: "text-risk-low", badge: "bg-risk-low-bg text-risk-low", Icon: ShieldCheck },
  moderate: {
    label: "Moderate Risk",
    className: "text-risk-moderate",
    badge: "bg-risk-moderate-bg text-risk-moderate",
    Icon: Shield,
  },
  high: { label: "High Risk", className: "text-risk-high", badge: "bg-risk-high-bg text-risk-high", Icon: ShieldAlert },
}

export function RecommendedRoute() {
  const { origin, destination, routes, selectedIndex, status, waypoints, optimizedOrder } = useRoute()
  const sel = routes[selectedIndex]

  const from = sel ? origin : "Guwahati"
  const to = sel ? destination : "Shillong"
  const distanceKm = sel ? sel.distanceKm : 100
  const durationMin = sel ? sel.durationMin : 190
  const etaLabel = sel ? sel.etaLabel : "3 hr 10 min"
  const risk: RiskLevel = sel ? sel.risk : "low"
  const ui = riskUi[risk]

  const orderedWaypoints = optimizedOrder ? optimizedOrder.map((i) => waypoints[i]).filter(Boolean) : waypoints

  const originCity = cities[from] ?? cities.Guwahati
  const { data: weather } = useSWR<Weather>(
    `/api/weather?lat=${originCity.lat}&lng=${originCity.lng}&place=${encodeURIComponent(from)}`,
    fetcher,
    { refreshInterval: 300000 },
  )

  const { data: incidentsData } = useSWR<{ incidents: LiveIncident[] }>("/api/incidents", fetcher, {
    refreshInterval: 30000,
  })
  const corridorIncidents = (incidentsData?.incidents ?? []).filter((inc) => {
    const corridor = inc.corridor.toLowerCase()
    return corridor.includes(from.toLowerCase()) && corridor.includes(to.toLowerCase())
  })

  const [data, setData] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const runIdRef = useRef(0)

  useEffect(() => {
    if (status === "computing") return
    const runId = ++runIdRef.current
    setLoading(true)

    const weatherText = weather
      ? `${weather.condition}, ${weather.tempC}°C, visibility ${weather.visibilityKm} km`
      : "Conditions loading"

    fetch("/api/route-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        distanceKm,
        etaLabel,
        risk,
        weather: weatherText,
        incidents: corridorIncidents.map((i) => ({ title: i.title, level: i.level })),
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (runId === runIdRef.current) setData(json)
      })
      .catch(() => {
        if (runId === runIdRef.current) setData({ provider: "Offline", analysis: "Unable to reach the analysis service right now." })
      })
      .finally(() => {
        if (runId === runIdRef.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, distanceKm, etaLabel, risk, status, weather?.condition, corridorIncidents.length])

  const rerun = () => {
    // Bump the run id to force a fresh analysis with current inputs.
    runIdRef.current++
    setData(null)
    setLoading(true)
    const weatherText = weather
      ? `${weather.condition}, ${weather.tempC}°C, visibility ${weather.visibilityKm} km`
      : "Conditions loading"
    const runId = runIdRef.current
    fetch("/api/route-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, distanceKm, etaLabel, risk, weather: weatherText, incidents: [] }),
    })
      .then((r) => r.json())
      .then((json) => runId === runIdRef.current && setData(json))
      .catch(() => runId === runIdRef.current && setData({ provider: "Offline", analysis: "Unable to reach the analysis service right now." }))
      .finally(() => runId === runIdRef.current && setLoading(false))
  }

  const facts = [
    { icon: Route, label: "Distance", value: `${distanceKm} km` },
    { icon: Clock, label: "Est. Time", value: etaLabel },
  ]

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended Route</h3>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ui.badge}`}>
          {ui.label}
          <ArrowRight className="size-3" />
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          {from}
          <ArrowRight className="size-4 text-muted-foreground" />
          {to}
        </div>
        <SubmitTripDialog
          origin={from}
          destination={to}
          waypoints={orderedWaypoints}
          distanceKm={distanceKm}
          durationMin={durationMin}
          risk={risk}
          onSubmitted={() => {}}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {facts.map((f) => (
          <div key={f.label} className="rounded-lg border border-border bg-secondary/50 p-2.5">
            <f.icon className="size-4 text-muted-foreground" />
            <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
            <p className="font-mono text-sm font-semibold text-foreground">{f.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
          <ui.Icon className={`size-4 ${ui.className}`} />
          <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Risk Level</p>
          <p className={`text-sm font-semibold capitalize ${ui.className}`}>{risk}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-info-bg/70 p-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-info">
            <Sparkles className="size-3.5" />
            Risk Analysis
          </span>
          <button
            type="button"
            onClick={rerun}
            disabled={loading}
            aria-label="Re-run AI analysis"
            className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground">
          {loading && !data ? "Analyzing corridor conditions..." : data?.analysis}
        </p>
      </div>
    </Panel>
  )
}

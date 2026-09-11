"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Route, Clock, ShieldCheck, Sparkles, RefreshCw } from "lucide-react"
import { incidents, recommendedRoute } from "@/lib/data"
import { Panel } from "./panel"

type Analysis = { provider: string; analysis: string }

export function RecommendedRoute() {
  const [data, setData] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)

  const analyze = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/route-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: recommendedRoute.from,
          to: recommendedRoute.to,
          distanceKm: recommendedRoute.distanceKm,
          etaLabel: recommendedRoute.etaLabel,
          risk: recommendedRoute.risk,
          weather: "Light rain, 24°C, visibility 6 km",
          incidents: incidents.map((i) => ({ title: i.title, level: i.level })),
        }),
      })
      setData(await res.json())
    } catch {
      setData({ provider: "Offline", analysis: "Unable to reach the AI service right now." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    analyze()
  }, [analyze])

  const facts = [
    { icon: Route, label: "Distance", value: `${recommendedRoute.distanceKm} km` },
    { icon: Clock, label: "Est. Time", value: recommendedRoute.etaLabel },
  ]

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">Recommended Route</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-risk-low-bg px-2.5 py-1 text-xs font-medium text-risk-low">
          Safest Option
          <ArrowRight className="size-3" />
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
        {recommendedRoute.from}
        <ArrowRight className="size-4 text-muted-foreground" />
        {recommendedRoute.to}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {facts.map((f) => (
          <div key={f.label} className="rounded-lg border border-border bg-secondary/50 p-2.5">
            <f.icon className="size-4 text-muted-foreground" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">{f.label}</p>
            <p className="text-sm font-semibold text-foreground">{f.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
          <ShieldCheck className="size-4 text-risk-low" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">Risk Level</p>
          <p className="text-sm font-semibold capitalize text-risk-low">{recommendedRoute.risk}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-info-bg/70 p-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-info">
            <Sparkles className="size-3.5" />
            AI Risk Analysis
            {data && <span className="font-normal text-muted-foreground">· {data.provider}</span>}
          </span>
          <button
            type="button"
            onClick={analyze}
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

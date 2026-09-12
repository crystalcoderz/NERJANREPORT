"use client"

import { useState } from "react"
import useSWR from "swr"
import { Clock3, Radio, Truck, TriangleAlert, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { cities } from "@/lib/data"
import { RiskBadge } from "@/components/dashboard/risk-badge"
import { deriveTripStatus } from "@/lib/trip-status"
import { useSatellite } from "./satellite-context"
import type { Trip } from "@/app/api/trips/route"
import type { LiveIncident } from "@/app/api/incidents/route"
import type { FieldReport } from "@/app/api/field-reports/route"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function resolveCity(name: string) {
  const key = Object.keys(cities).find((c) => c.toLowerCase() === name.trim().toLowerCase())
  return key ? cities[key] : null
}

const severityStyles: Record<string, string> = {
  low: "bg-risk-low-bg text-risk-low",
  medium: "bg-risk-moderate-bg text-risk-moderate",
  high: "bg-risk-high-bg text-risk-high",
}

const TABS = [
  { id: "trips", label: "Fleet" },
  { id: "incidents", label: "Incidents" },
  { id: "reports", label: "Reports" },
] as const

function EmptyState({ icon: Icon, text }: { icon: typeof Truck; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon className="size-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

export function SatelliteSidebar() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("trips")
  const { requestFocus, setSelectedTripId, selectedTripId } = useSatellite()

  const { data: tripsData } = useSWR<{ trips: Trip[] }>("/api/trips", fetcher, { refreshInterval: 10000 })
  const { data: incidentsData } = useSWR<{ incidents: LiveIncident[] }>("/api/incidents", fetcher, {
    refreshInterval: 30000,
  })
  const { data: reportsData } = useSWR<{ reports: FieldReport[] }>("/api/field-reports", fetcher, {
    refreshInterval: 15000,
  })

  const trips = (tripsData?.trips ?? []).filter((t) => t.status !== "completed")
  const incidents = incidentsData?.incidents ?? []
  const activeReports = (reportsData?.reports ?? []).filter((r) => r.status === "active")

  const counts: Record<(typeof TABS)[number]["id"], number> = {
    trips: trips.length,
    incidents: incidents.length,
    reports: activeReports.length,
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-t-md px-2 py-2 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-primary text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} <span className="text-muted-foreground">({counts[t.id]})</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "trips" && (
          <div className="flex flex-col gap-2.5">
            {trips.length === 0 && <EmptyState icon={Truck} text="No active trips on the network right now." />}
            {trips.map((trip) => {
              const status = deriveTripStatus(trip)
              const o = resolveCity(trip.origin)
              const isSelected = trip.id === selectedTripId
              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => {
                    setSelectedTripId(trip.id)
                    if (o) requestFocus(o.lat, o.lng, 9)
                  }}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                    isSelected ? "border-primary bg-accent" : "border-border bg-secondary/40 hover:bg-secondary/70",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {trip.origin} → {trip.destination}
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", status.className)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" />
                      {trip.assigned_to}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" />
                      ETA {new Date(trip.eta).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <RiskBadge level={trip.risk_level} />
                </button>
              )
            })}
          </div>
        )}

        {tab === "incidents" && (
          <div className="flex flex-col gap-2.5">
            {incidents.length === 0 && <EmptyState icon={TriangleAlert} text="No live incidents detected." />}
            {incidents.map((inc) => (
              <button
                key={inc.id}
                type="button"
                onClick={() => inc.lat != null && inc.lng != null && requestFocus(inc.lat, inc.lng, 11)}
                className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/40 p-3 text-left transition-colors hover:bg-secondary/70"
              >
                <span className="text-sm font-medium text-foreground">{inc.title}</span>
                <span className="text-[11px] text-muted-foreground">{inc.corridor}</span>
                <span className="text-xs text-card-foreground">{inc.detail}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "reports" && (
          <div className="flex flex-col gap-2.5">
            {activeReports.length === 0 && <EmptyState icon={Radio} text="No field reports logged yet." />}
            {activeReports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => r.lat != null && r.lng != null && requestFocus(r.lat, r.lng, 12)}
                className="flex flex-col gap-1 rounded-lg border border-border bg-secondary/40 p-3 text-left transition-colors hover:bg-secondary/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{r.location_name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", severityStyles[r.severity])}>
                    {r.severity}
                  </span>
                </div>
                <span className="text-xs text-card-foreground">{r.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

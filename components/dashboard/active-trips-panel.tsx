"use client"

import useSWR from "swr"
import { ArrowRight, Clock3, RefreshCw, TriangleAlert, UserRound } from "lucide-react"
import { Panel, PanelHeader } from "./panel"
import { RiskBadge } from "./risk-badge"
import type { Trip } from "@/app/api/trips/route"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function deriveStatus(trip: Trip): { label: string; className: string } {
  const now = Date.now()
  const dep = new Date(trip.departure_time).getTime()
  const eta = new Date(trip.eta).getTime()

  if (trip.status === "completed") return { label: "Completed", className: "bg-secondary text-muted-foreground" }
  if (now < dep) return { label: "Scheduled", className: "bg-info-bg text-info" }
  if (now >= dep && now < eta) return { label: "In Transit", className: "bg-risk-low-bg text-risk-low" }
  return { label: "Overdue", className: "bg-risk-high-bg text-risk-high" }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function ActiveTripsPanel() {
  const { data, isLoading, mutate } = useSWR<{ trips: Trip[] }>("/api/trips", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  })

  const trips = data?.trips ?? []

  return (
    <Panel>
      <PanelHeader
        title="Assigned Trips"
        action={
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">Syncs / 10s</span>
            <button
              type="button"
              onClick={() => mutate()}
              aria-label="Refresh assigned trips"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-2.5 p-4">
        {isLoading && trips.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">Loading assigned trips...</p>
        )}
        {!isLoading && trips.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No trips assigned yet. Find a route above and submit it to a driver.
          </p>
        )}
        {trips.map((trip) => {
          const s = deriveStatus(trip)
          return (
            <div key={trip.id} className="rounded-lg border border-border bg-secondary/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {trip.origin}
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  {trip.destination}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.className}`}>
                  {s.label}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3.5" />
                  {trip.assigned_to}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  {formatTime(trip.departure_time)} → {formatTime(trip.eta)}
                </span>
                <RiskBadge level={trip.risk_level} />
                {trip.matched_report_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-risk-high">
                    <TriangleAlert className="size-3.5" />
                    {trip.matched_report_count} field report{trip.matched_report_count > 1 ? "s" : ""} on route
                  </span>
                )}
              </div>

              {trip.notes && <p className="mt-1.5 text-xs text-muted-foreground">{trip.notes}</p>}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

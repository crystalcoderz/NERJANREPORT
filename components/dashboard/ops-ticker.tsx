"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Radio } from "lucide-react"
import type { LiveIncident } from "@/app/api/incidents/route"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * Slim console-style status bar: live clock, network status, and a live
 * incident count pulled from the same feed the map and panels use.
 */
export function OpsTicker() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { data } = useSWR<{ incidents: LiveIncident[] }>("/api/incidents", fetcher, {
    refreshInterval: 30000,
  })
  const activeIncidents = data?.incidents?.length ?? 0

  const dateLabel = now?.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const timeLabel = now?.toLocaleTimeString("en-IN", { hour12: false })

  return (
    <div className="flex h-9 items-center justify-between border-b border-border bg-card px-4 font-mono text-[11px] text-muted-foreground md:px-6">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-risk-low opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-risk-low" />
          </span>
          NER-OPS ONLINE
        </span>
        <span className="hidden text-border sm:inline">|</span>
        <span className="hidden sm:inline">NORTHEAST REGION NETWORK</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1 text-muted-foreground sm:flex">
          <Radio className="size-3" />
          {activeIncidents} ACTIVE INCIDENT{activeIncidents === 1 ? "" : "S"}
        </span>
        <span className="text-foreground">
          {dateLabel ?? "--- -- ---- ----"} · {timeLabel ?? "--:--:--"} IST
        </span>
      </div>
    </div>
  )
}

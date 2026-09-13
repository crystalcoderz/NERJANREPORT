"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Bell, TriangleAlert, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LiveIncident } from "@/app/api/incidents/route"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const levelStyles: Record<string, { dot: string; text: string; bg: string }> = {
  high: { dot: "bg-risk-high", text: "text-risk-high", bg: "bg-risk-high-bg" },
  moderate: { dot: "bg-risk-moderate", text: "text-risk-moderate", bg: "bg-risk-moderate-bg" },
  low: { dot: "bg-risk-low", text: "text-risk-low", bg: "bg-risk-low-bg" },
  info: { dot: "bg-info", text: "text-info", bg: "bg-info-bg" },
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data } = useSWR<{ incidents: LiveIncident[] }>("/api/incidents", fetcher, {
    refreshInterval: 30000,
  })

  const incidents = useMemo(() => data?.incidents ?? [], [data])
  const unread = incidents.filter((i) => i.level === "high" || i.level === "moderate").length

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-risk-high px-1 text-[10px] font-bold leading-[18px] text-background ring-2 ring-card">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">Alerts</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {incidents.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[380px] divide-y divide-border overflow-y-auto">
              {incidents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
                  <Bell className="size-6 opacity-40" />
                  No active alerts on the network.
                </div>
              ) : (
                incidents.map((inc) => {
                  const s = levelStyles[inc.level] ?? levelStyles.info
                  const Icon = inc.level === "high" || inc.level === "moderate" ? TriangleAlert : Info
                  return (
                    <div key={inc.id} className="flex gap-3 px-4 py-3">
                      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", s.bg)}>
                        <Icon className={cn("size-4", s.text)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{inc.title}</p>
                          <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{inc.detail}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <span className="truncate">{inc.corridor}</span>
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0">{timeAgo(inc.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

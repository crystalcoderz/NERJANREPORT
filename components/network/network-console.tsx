"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Globe2, Layers, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RiskLevelName } from "@/app/api/network-risk/route"
import { NetworkProvider, useNetwork } from "./network-context"
import { NetworkMap } from "./network-map"
import { NetworkSidebar } from "./network-sidebar"

const SUMMARY: { level: RiskLevelName; label: string; className: string }[] = [
  { level: "severe", label: "Severe", className: "text-risk-high" },
  { level: "high", label: "High", className: "text-risk-high/80" },
  { level: "moderate", label: "Moderate", className: "text-risk-moderate" },
  { level: "low", label: "Low", className: "text-risk-low" },
]

function SummaryBar() {
  const { cities, toggleLevel, activeLevels } = useNetwork()

  const counts = useMemo(() => {
    const c: Record<string, number> = { severe: 0, high: 0, moderate: 0, low: 0 }
    cities.forEach((city) => {
      c[city.level] = (c[city.level] ?? 0) + 1
    })
    return c
  }, [cities])

  return (
    <div className="flex items-center gap-1">
      {SUMMARY.map((s) => (
        <button
          key={s.level}
          type="button"
          onClick={() => toggleLevel(s.level)}
          aria-pressed={activeLevels.includes(s.level)}
          title={`Filter ${s.label} risk nodes`}
          className={cn(
            "flex items-baseline gap-1.5 rounded-md border px-2 py-1 transition-colors",
            activeLevels.includes(s.level) ? "border-current bg-secondary" : "border-border hover:bg-secondary/60",
          )}
        >
          <span className={cn("font-mono text-sm font-bold leading-none", s.className)}>{counts[s.level] ?? 0}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
        </button>
      ))}
    </div>
  )
}

function CatchmentToggle() {
  const { showCatchments, setShowCatchments } = useNetwork()
  return (
    <button
      type="button"
      onClick={() => setShowCatchments(!showCatchments)}
      aria-pressed={showCatchments}
      className={cn(
        "pointer-events-auto flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors",
        showCatchments ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Layers className="size-3.5" />
      Risk catchments
    </button>
  )
}

function Legend() {
  const rows = [
    { c: "bg-risk-low", t: "Low · 0–21" },
    { c: "bg-risk-moderate", t: "Moderate · 22–44" },
    { c: "bg-risk-high/70", t: "High · 45–69" },
    { c: "bg-risk-high", t: "Severe · 70–100" },
  ]
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Composite risk
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", r.c)} />
            <span className="text-[11px] text-muted-foreground">{r.t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 max-w-[190px] border-t border-border pt-2 text-[10px] leading-snug text-muted-foreground">
        Disc size scales with score. Rainfall, wind, visibility and terrain vulnerability are weighted per node.
      </p>
    </div>
  )
}

function UpdatedStamp() {
  const { updatedAt, isLoading } = useNetwork()
  const [label, setLabel] = useState<string | null>(null)

  // Formatted after mount so the server and client don't disagree on timezone.
  useEffect(() => {
    if (!updatedAt) return
    setLabel(
      new Date(updatedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      }),
    )
  }, [updatedAt])

  if (isLoading) return <span className="font-mono text-[11px] text-muted-foreground">Scoring network...</span>
  if (!label) return null

  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      <span className="size-1.5 animate-pulse rounded-full bg-risk-low" />
      Updated {label} IST
    </span>
  )
}

function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to dashboard"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe2 className="size-4" />
            </span>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-foreground">National Risk Grid</h1>
              <p className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
                Live hazard scoring across major Indian freight nodes
              </p>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <SummaryBar />
          <UpdatedStamp />
        </div>

        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle node panel"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground lg:hidden"
        >
          <Menu className="size-4" />
        </button>
      </header>

      <div className="flex items-center gap-3 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
        <SummaryBar />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <NetworkMap />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-end">
            <CatchmentToggle />
          </div>
          <Legend />
        </div>

        <aside
          className={cn(
            "z-20 w-full shrink-0 border-l border-border bg-card lg:block lg:max-w-sm",
            sidebarOpen ? "absolute inset-0 lg:relative" : "hidden",
          )}
        >
          <NetworkSidebar />
        </aside>
      </div>
    </main>
  )
}

export function NetworkConsole() {
  return (
    <NetworkProvider>
      <Shell />
    </NetworkProvider>
  )
}

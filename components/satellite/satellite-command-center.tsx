"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Grid3x3, Layers, Menu, Mountain, Radar, Satellite as SatelliteIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { SatelliteProvider, useSatellite, type MapLayer } from "./satellite-context"
import { SatelliteMap } from "./satellite-map"
import { SatelliteSidebar } from "./satellite-sidebar"

const LAYERS: { id: MapLayer; label: string; icon: typeof Layers }[] = [
  { id: "hybrid", label: "Hybrid", icon: Layers },
  { id: "satellite", label: "Satellite", icon: SatelliteIcon },
  { id: "terrain", label: "Terrain", icon: Mountain },
  { id: "roadmap", label: "Roads", icon: Grid3x3 },
]

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {now ? `${now.toLocaleTimeString("en-IN", { hour12: false })} IST` : "--:--:--"}
    </span>
  )
}

function LayerSwitcher() {
  const { layer, setLayer } = useSatellite()
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
      {LAYERS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLayer(l.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            layer === l.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <l.icon className="size-3.5" />
          <span className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </div>
  )
}

function Legend() {
  const rows = [
    { c: "bg-risk-low", t: "Low Risk Route" },
    { c: "bg-risk-moderate", t: "Moderate Risk Route" },
    { c: "bg-risk-high", t: "High Risk Route" },
  ]
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
      <p className="mb-2 text-xs font-semibold text-foreground">Legend</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-2">
            <span className={cn("h-1 w-5 rounded-full", r.c)} />
            <span className="text-xs text-muted-foreground">{r.t}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1">
          <span className="flex size-3.5 items-center justify-center rounded-full border-2 border-foreground bg-card" />
          <span className="text-xs text-muted-foreground">Live vehicle heading</span>
        </li>
      </ul>
    </div>
  )
}

export function SatelliteCommandCenter() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <SatelliteProvider>
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
                <Radar className="size-4" />
              </span>
              <div>
                <h1 className="text-sm font-semibold leading-tight text-foreground">Satellite Command Center</h1>
                <p className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
                  Live fleet &amp; terrain intelligence · North Eastern Region
                </p>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <span className="flex items-center gap-1.5 rounded-full bg-risk-low-bg px-2.5 py-1 text-[11px] font-medium text-risk-low">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              Live
            </span>
            <LiveClock />
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle panel"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground lg:hidden"
          >
            <Menu className="size-4" />
          </button>
        </header>

        <div className="relative flex flex-1 overflow-hidden">
          <div className="relative flex-1">
            <SatelliteMap />
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-end">
              <LayerSwitcher />
            </div>
            <Legend />
          </div>

          <aside
            className={cn(
              "z-20 w-full max-w-sm shrink-0 border-l border-border bg-card lg:block",
              sidebarOpen ? "block" : "hidden",
            )}
          >
            <SatelliteSidebar />
          </aside>
        </div>
      </main>
    </SatelliteProvider>
  )
}

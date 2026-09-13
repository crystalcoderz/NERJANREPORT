"use client"

import useSWR from "swr"
import { Navigation2, Cloud, CloudRain, CloudLightning, Sprout, Thermometer } from "lucide-react"
import { cn } from "@/lib/utils"
import { cities } from "@/lib/data"
import { Panel, PanelHeader } from "./panel"
import { useRoute } from "./route-context"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type StormRisk = "low" | "moderate" | "high"

type Environmental = {
  source: string
  place: string
  wind: { speedKph: number; gustKph: number; directionDeg: number; compass: string }
  cloudCoverPercent: number
  precipProbPercent: number
  storm: { risk: StormRisk; label: string; etaHours: number | null }
  soil: { moisturePercent: number; moistureLabel: string; temperatureC: number }
  updatedAt: string | null
}

const stormStyles: Record<StormRisk, { chip: string; text: string }> = {
  low: { chip: "bg-risk-low-bg text-risk-low", text: "text-risk-low" },
  moderate: { chip: "bg-risk-moderate-bg text-risk-moderate", text: "text-risk-moderate" },
  high: { chip: "bg-risk-high-bg text-risk-high", text: "text-risk-high" },
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn("h-full rounded-full", className)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function EnvironmentalPanel() {
  const { origin } = useRoute()
  const city = cities[origin] ?? cities.Guwahati
  const { data } = useSWR<Environmental>(
    `/api/environmental?lat=${city.lat}&lng=${city.lng}&place=${encodeURIComponent(origin)}`,
    fetcher,
    { refreshInterval: 60000 },
  )

  const e: Environmental =
    data ?? {
      source: "loading",
      place: origin,
      wind: { speedKph: 14, gustKph: 22, directionDeg: 200, compass: "SSW" },
      cloudCoverPercent: 55,
      precipProbPercent: 35,
      storm: { risk: "low", label: "No storm cells detected", etaHours: null },
      soil: { moisturePercent: 24, moistureLabel: "Optimal", temperatureC: 22 },
      updatedAt: null,
    }

  const isLive = e.source === "open-meteo"
  const storm = stormStyles[e.storm.risk]

  return (
    <Panel>
      <PanelHeader
        title="Atmospheric & Soil Intelligence"
        action={
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", isLive ? "bg-risk-low" : "bg-muted-foreground")} />
            {isLive ? "Live · Open-Meteo" : "Sample data"}
          </span>
        }
      />
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        <div className="flex items-center gap-4 p-4">
          <span className="relative flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-secondary/60">
            <Navigation2
              className="size-6 text-info"
              style={{ transform: `rotate(${e.wind.directionDeg}deg)` }}
              aria-hidden="true"
            />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Wind · {e.wind.compass}
            </p>
            <p className="font-mono text-xl font-bold leading-tight text-foreground">{e.wind.speedKph} km/h</p>
            <p className="text-xs text-muted-foreground">Gusts {e.wind.gustKph} km/h</p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 p-4">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Cloud className="size-3.5" /> Cloud Cover
              </span>
              <span className="font-mono font-semibold text-foreground">{e.cloudCoverPercent}%</span>
            </div>
            <div className="mt-1.5">
              <Bar value={e.cloudCoverPercent} className="bg-info" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CloudRain className="size-3.5" /> Precip. Chance
              </span>
              <span className="font-mono font-semibold text-foreground">{e.precipProbPercent}%</span>
            </div>
            <div className="mt-1.5">
              <Bar value={e.precipProbPercent} className="bg-risk-moderate" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", storm.chip)}>
            <CloudLightning className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Storm Risk</p>
            <p className={cn("text-sm font-semibold capitalize", storm.text)}>{e.storm.risk}</p>
            <p className="text-xs text-muted-foreground">{e.storm.label}</p>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 p-4">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Sprout className="size-3.5" /> Soil Moisture
              </span>
              <span className="font-mono font-semibold text-foreground">
                {e.soil.moisturePercent}% · {e.soil.moistureLabel}
              </span>
            </div>
            <div className="mt-1.5">
              <Bar value={e.soil.moisturePercent * 2} className="bg-primary" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Thermometer className="size-3.5" />
            Soil Temp
            <span className="ml-auto font-mono font-semibold text-foreground">{e.soil.temperatureC}°C</span>
          </div>
        </div>
      </div>
    </Panel>
  )
}

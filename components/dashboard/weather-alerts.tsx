"use client"

import useSWR from "swr"
import { CloudRain, Mountain, CloudFog, Waves, Wind } from "lucide-react"
import { cn } from "@/lib/utils"
import { weatherAlerts as mockWeatherAlerts } from "@/lib/data"
import { Panel, PanelHeader } from "./panel"

const kindIcons = {
  rain: CloudRain,
  landslide: Mountain,
  fog: CloudFog,
  flood: Waves,
  wind: Wind,
}

const levelStyles = {
  high: "bg-risk-high-bg text-risk-high",
  moderate: "bg-risk-moderate-bg text-risk-moderate",
  low: "bg-risk-low-bg text-risk-low",
}

type LiveAlert = {
  id: string
  level: keyof typeof levelStyles
  title: string
  place: string
  eta: string
  kind: keyof typeof kindIcons
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function WeatherAlerts() {
  const { data } = useSWR<{ source: string; alerts: LiveAlert[] }>("/api/weather-alerts", fetcher, {
    refreshInterval: 60000,
  })

  const alerts = data?.alerts ?? mockWeatherAlerts
  const isLive = data?.source === "weatherapi"

  return (
    <Panel>
      <PanelHeader
        title="Weather Alerts"
        count={alerts.length}
        action={
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", isLive ? "bg-risk-low" : "bg-muted-foreground")} />
            {isLive ? "Live · WeatherAPI" : "Sample data"}
          </span>
        }
      />
      <ul className="flex flex-col divide-y divide-border">
        {alerts.slice(0, 5).map((a) => {
          const Icon = kindIcons[a.kind]
          return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cn("flex size-9 items-center justify-center rounded-lg", levelStyles[a.level])}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{a.place}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.eta}</span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

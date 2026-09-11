"use client"

import useSWR from "swr"
import {
  Cloud,
  CloudRain,
  CloudFog,
  CloudLightning,
  CloudSnow,
  Sun,
  Droplets,
  Wind,
  Eye,
  MapPin,
} from "lucide-react"
import { cities } from "@/lib/data"
import { Panel } from "./panel"
import { useRoute } from "./route-context"

const icons = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  fog: CloudFog,
  snow: CloudSnow,
}

type Weather = {
  source: string
  place: string
  tempC: number
  condition: string
  kind: keyof typeof icons
  precipPercent: number
  windKph: number
  visibilityKm: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function WeatherPanel() {
  const { origin } = useRoute()
  const city = cities[origin] ?? cities.Guwahati
  const { data } = useSWR<Weather>(
    `/api/weather?lat=${city.lat}&lng=${city.lng}&place=${encodeURIComponent(origin)}`,
    fetcher,
    { refreshInterval: 300000 },
  )

  const w: Weather = data ?? {
    source: "loading",
    place: origin,
    tempC: 24,
    condition: "Light Rain",
    kind: "rain",
    precipPercent: 45,
    windKph: 14,
    visibilityKm: 6,
  }

  const Icon = icons[w.kind] ?? Cloud

  const metrics = [
    { icon: Droplets, label: "Precipitation", value: `${w.precipPercent}%` },
    { icon: Wind, label: "Wind", value: `${w.windKph} km/h` },
    { icon: Eye, label: "Visibility", value: `${w.visibilityKm} km` },
  ]

  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="flex items-center gap-1 text-sm font-semibold text-card-foreground">
            <MapPin className="size-3.5 text-muted-foreground" />
            {origin}
          </p>
          <p className="text-xs text-muted-foreground">
            {w.source === "google" ? "Live · Google Weather" : "Sample data"}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Origin
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-info-bg text-info">
            <Icon className="size-7" />
          </span>
          <div>
            <p className="font-mono text-3xl font-bold leading-none text-foreground">{w.tempC}°C</p>
            <p className="mt-1 text-xs text-muted-foreground">{w.condition}</p>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5">
          {metrics.map((m) => (
            <li key={m.label} className="flex items-center justify-end gap-1.5 text-xs">
              <m.icon className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-medium text-foreground">{m.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}

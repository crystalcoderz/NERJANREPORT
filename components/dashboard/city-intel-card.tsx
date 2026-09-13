"use client"

import useSWR from "swr"
import {
  X,
  Sparkles,
  Mountain,
  Users,
  Thermometer,
  Wind,
  Droplets,
  Route,
  AlertTriangle,
  Loader2,
  MapPin,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type CityIntel = {
  city: string
  state: string
  role: string
  elevationM: number
  population: number
  weather: {
    temperatureC: number | null
    windKph: number | null
    humidity: number | null
    condition: string
  }
  provider: string
  model: string
  intel: {
    overview: string
    logistics: string
    hazards: string[]
    connectivity: string
    advisory: string
  }
}

function formatPop(n: number) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}

export function CityIntelCard({ city, onClose }: { city: string; onClose: () => void }) {
  const { data, isLoading } = useSWR<CityIntel>(`/api/city-intel?city=${encodeURIComponent(city)}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120000,
  })

  const isLive = data?.provider && data.provider !== "Offline"

  return (
    <div className="pointer-events-auto absolute right-3 top-3 bottom-3 z-20 flex w-[320px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <MapPin className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">{city}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {data?.state ?? "North East Region"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close city intel"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-3 text-xs italic text-muted-foreground">{data?.role}</p>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Fact icon={<Mountain className="size-3.5" />} label="Elevation" value={data ? `${data.elevationM} m` : "—"} />
          <Fact icon={<Users className="size-3.5" />} label="Population" value={data ? formatPop(data.population) : "—"} />
          <Fact
            icon={<Thermometer className="size-3.5" />}
            label="Temp"
            value={data?.weather.temperatureC != null ? `${Math.round(data.weather.temperatureC)}°C` : "—"}
          />
          <Fact
            icon={<Wind className="size-3.5" />}
            label="Wind"
            value={data?.weather.windKph != null ? `${Math.round(data.weather.windKph)} km/h` : "—"}
          />
        </div>

        {data && (
          <div className="mb-3 flex items-center gap-1.5 rounded-md bg-secondary/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
            <Droplets className="size-3.5 text-info" />
            <span className="capitalize text-foreground">{data.weather.condition}</span>
            {data.weather.humidity != null && <span>· {data.weather.humidity}% RH</span>}
          </div>
        )}

        {isLoading || !data ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Generating live intel briefing…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Section title="Overview">{data.intel.overview}</Section>
            <Section title="Freight & Logistics">{data.intel.logistics}</Section>

            <div>
              <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="size-3.5 text-risk-moderate" /> Hazards
              </h4>
              <ul className="flex flex-wrap gap-1.5">
                {data.intel.hazards.map((h) => (
                  <li
                    key={h}
                    className="rounded-full bg-risk-moderate-bg px-2 py-0.5 text-[11px] font-medium text-risk-moderate"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-2">
              <Route className="mt-0.5 size-3.5 shrink-0 text-info" />
              <p className="text-xs leading-relaxed text-foreground">{data.intel.connectivity}</p>
            </div>

            <div className="rounded-md bg-primary/10 px-2.5 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Driver Advisory</p>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground">{data.intel.advisory}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-[10px] font-medium text-muted-foreground">
        <Sparkles className="size-3 text-primary" />
        {isLive ? "Live intel" : "Preparing briefing…"}
        <span className="ml-auto">Open-Meteo · AI</span>
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-1.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <p className="text-xs leading-relaxed text-foreground">{children}</p>
    </div>
  )
}

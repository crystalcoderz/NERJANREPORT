"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Search,
  Sparkles,
  Loader2,
  MapPin,
  Thermometer,
  Wind,
  Droplets,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sun,
  Cloud,
  CloudRain,
  CloudFog,
  CloudLightning,
  CloudSnow,
} from "lucide-react"
import { Panel, PanelHeader } from "./panel"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type WeatherKind = "clear" | "cloudy" | "rain" | "storm" | "fog" | "snow"

const KIND_ICON: Record<WeatherKind, typeof Cloud> = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  fog: CloudFog,
  snow: CloudSnow,
}

const KIND_COLOR: Record<WeatherKind, string> = {
  clear: "text-risk-moderate",
  cloudy: "text-muted-foreground",
  rain: "text-info",
  storm: "text-risk-high",
  fog: "text-muted-foreground",
  snow: "text-info",
}

function dayLabel(iso: string) {
  // Parse as local midnight so the weekday doesn't shift a day in negative UTC offsets.
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })
}

type Brief = {
  summary: string
  sections: { heading: string; body: string }[]
  highlights: string[]
  advisory: string
}

type Source = { title: string; url: string }

type ForecastDay = {
  date: string
  maxC: number | null
  minC: number | null
  precipChance: number | null
  windKph: number | null
  condition: string
  kind: WeatherKind
}

type BriefResponse = {
  place: string
  name: string
  region: string | null
  country: string | null
  weather: {
    temperatureC: number | null
    windKph: number | null
    humidity: number | null
    condition: string
    kind: WeatherKind
  }
  forecast?: ForecastDay[]
  brief: Brief
  sources: Source[]
  grounded: boolean
  error?: string
}

const SUGGESTIONS: { label: string; query: string }[] = [
  { label: "Guwahati", query: "Guwahati" },
  { label: "Tawang", query: "Tawang" },
  { label: "Kaziranga", query: "Kaziranga" },
  // The gazetteer has no feature called "Siliguri Corridor", so search the city it is named for.
  { label: "Siliguri Corridor", query: "Siliguri" },
  { label: "Imphal", query: "Imphal" },
]

export function LocationBriefing() {
  const [input, setInput] = useState("")
  const [query, setQuery] = useState<string | null>(null)

  const { data, isLoading, error } = useSWR<BriefResponse>(
    query ? `/api/location-brief?q=${encodeURIComponent(query)}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  )

  function submit(value: string) {
    const v = value.trim()
    if (!v) return
    setInput(v)
    setQuery(v)
  }

  const notFound = data?.error || (error as Error | undefined)

  return (
    <Panel>
      <PanelHeader
        title="Location Intelligence"
        action={
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            On demand
          </span>
        }
      />

      <div className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (e.nativeEvent instanceof KeyboardEvent && (e.nativeEvent as KeyboardEvent).isComposing) return
            submit(input)
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              type="text"
              placeholder="Choose any city or location…"
              className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Draft
          </button>
        </form>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Try</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => submit(s.query)}
              className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s.label}
            </button>
          ))}
        </div>

        {!query && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            <Sparkles className="size-4 shrink-0 text-primary" />
            Pick a location to draft a live intelligence brief — geography, freight connectivity, hazards, and a
            weather-aware operator advisory.
          </div>
        )}

        {query && (isLoading || !data) && !notFound && (
          <div className="mt-4 flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Drafting live brief for {query}…
          </div>
        )}

        {notFound && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-risk-high-bg px-3 py-3 text-xs text-risk-high">
            <ShieldAlert className="size-4 shrink-0" />
            Couldn&apos;t locate &ldquo;{query}&rdquo;. Try a more specific city or place name.
          </div>
        )}

        {data && !data.error && !isLoading && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <MapPin className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight text-foreground">{data.place}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Live briefing</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md bg-secondary/50 px-3 py-1.5 font-mono text-xs text-foreground">
                <span className="flex items-center gap-1">
                  <Thermometer className="size-3.5 text-risk-moderate" />
                  {data.weather.temperatureC != null ? `${Math.round(data.weather.temperatureC)}°` : "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="size-3.5 text-info" />
                  {data.weather.windKph != null ? `${Math.round(data.weather.windKph)}` : "—"}
                </span>
                <span className="flex items-center gap-1 capitalize text-muted-foreground">
                  {(() => {
                    const Icon = KIND_ICON[data.weather.kind] ?? Cloud
                    return <Icon className={`size-3.5 ${KIND_COLOR[data.weather.kind] ?? "text-info"}`} />
                  })()}
                  {data.weather.condition}
                </span>
              </div>
            </div>

            {data.forecast && data.forecast.length > 0 && (
              <section aria-label="Seven day weather forecast">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    7-Day Outlook
                  </h4>
                  <span className="font-mono text-[10px] text-muted-foreground">high / low °C</span>
                </div>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {data.forecast.map((day, i) => {
                    const Icon = KIND_ICON[day.kind] ?? Cloud
                    const isToday = i === 0
                    return (
                      <li
                        key={day.date}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 ${
                          isToday ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide ${
                            isToday ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {isToday ? "Today" : dayLabel(day.date)}
                        </span>
                        <Icon className={`size-5 ${KIND_COLOR[day.kind] ?? "text-muted-foreground"}`} />
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {day.maxC != null ? Math.round(day.maxC) : "—"}°
                          <span className="ml-1 font-normal text-muted-foreground">
                            {day.minC != null ? Math.round(day.minC) : "—"}°
                          </span>
                        </p>
                        <span className="flex items-center gap-0.5 font-mono text-[10px] text-info">
                          <Droplets className="size-2.5" />
                          {day.precipChance ?? 0}%
                        </span>
                        <span className="line-clamp-2 text-center text-[9px] capitalize leading-tight text-muted-foreground">
                          {day.condition}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <p className="text-sm leading-relaxed text-foreground">{data.brief.summary}</p>

            {data.brief.highlights.length > 0 && (
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {data.brief.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight className="mt-0.5 size-3 shrink-0 text-primary" />
                    <span className="text-foreground">{h}</span>
                  </li>
                ))}
              </ul>
            )}

            {data.brief.sections.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.brief.sections.map((sec) => (
                  <div key={sec.heading} className="rounded-lg border border-border bg-secondary/30 p-3">
                    <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {sec.heading}
                    </h4>
                    <p className="text-xs leading-relaxed text-foreground">{sec.body}</p>
                  </div>
                ))}
              </div>
            )}

            {data.brief.advisory && (
              <div className="rounded-lg bg-primary/10 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Operator Advisory</p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground">{data.brief.advisory}</p>
              </div>
            )}

            {data.sources.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.sources.map((src) => (
                    <a
                      key={src.url}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}

"use client"

import { Anchor, Droplets, Mountain, Search, Thermometer, Wind, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CityRisk, RiskLevelName } from "@/app/api/network-risk/route"
import { useNetwork, zones, type SortMode } from "./network-context"

const LEVELS: RiskLevelName[] = ["severe", "high", "moderate", "low"]

const levelClasses: Record<RiskLevelName, { text: string; bg: string; dot: string }> = {
  severe: { text: "text-risk-high", bg: "bg-risk-high", dot: "bg-risk-high" },
  high: { text: "text-risk-high", bg: "bg-risk-high/70", dot: "bg-risk-high/70" },
  moderate: { text: "text-risk-moderate", bg: "bg-risk-moderate", dot: "bg-risk-moderate" },
  low: { text: "text-risk-low", bg: "bg-risk-low", dot: "bg-risk-low" },
}

const SORTS: { id: SortMode; label: string }[] = [
  { id: "risk", label: "Risk" },
  { id: "name", label: "A–Z" },
  { id: "population", label: "Size" },
]

function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString("en-IN", { weekday: "short" })
}

function CityDetail({ city }: { city: CityRisk }) {
  const cls = levelClasses[city.level]
  const maxPts = Math.max(1, ...city.factors.map((f) => f.points))
  const { setSelected } = useNetwork()

  return (
    <div className="border-b border-border bg-secondary/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {city.name}
            <span className="ml-1.5 font-normal text-muted-foreground">{city.state}</span>
          </h3>
          <p className="text-[11px] leading-snug text-muted-foreground">{city.role}</p>
        </div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          aria-label="Close city detail"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <span className={cn("font-mono text-3xl font-bold leading-none", cls.text)}>{city.score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", cls.text, "bg-card")}>
          {city.level}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Thermometer className="size-3.5 shrink-0" />
          {city.weather.temperatureC != null ? `${Math.round(city.weather.temperatureC)}°C` : "—"} ·{" "}
          {city.weather.condition}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Wind className="size-3.5 shrink-0" />
          {city.weather.windKph != null ? `${Math.round(city.weather.windKph)} km/h` : "—"}
          {city.weather.gustKph != null && ` · g${Math.round(city.weather.gustKph)}`}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Droplets className="size-3.5 shrink-0" />
          {city.weather.precipMm != null ? `${city.weather.precipMm.toFixed(1)} mm/h` : "—"}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {city.port ? <Anchor className="size-3.5 shrink-0" /> : <Mountain className="size-3.5 shrink-0" />}
          {city.port ? "Port node" : `${city.elevationM} m`}
        </span>
      </div>

      <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Risk attribution
      </p>
      {city.factors.length === 0 ? (
        <p className="mb-3 text-[11px] text-muted-foreground">No active hazard contributions. Conditions are benign.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {city.factors.map((f) => (
            <li key={f.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium text-foreground">{f.label}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">+{f.points}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-card">
                <div className={cn("h-full rounded-full", cls.bg)} style={{ width: `${(f.points / maxPts) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{f.detail}</p>
            </li>
          ))}
        </ul>
      )}

      {city.forecast.length > 0 && (
        <>
          <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Outlook
          </p>
          <div className="flex gap-1.5">
            {city.forecast.map((f) => (
              <div key={f.date} className="flex-1 rounded-md border border-border bg-card px-1.5 py-1.5 text-center">
                <p className="text-[10px] font-medium text-muted-foreground">{dayLabel(f.date)}</p>
                <p className="font-mono text-xs font-semibold text-foreground">
                  {f.maxC != null ? `${Math.round(f.maxC)}°` : "—"}
                </p>
                <p className="text-[10px] text-info">{f.precipChance != null ? `${f.precipChance}%` : "—"}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CityRow({ city }: { city: CityRisk }) {
  const { selected, focusCity } = useNetwork()
  const cls = levelClasses[city.level]
  const isSel = city.name === selected

  return (
    <li>
      <button
        type="button"
        onClick={() => focusCity(city)}
        aria-current={isSel ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left transition-colors hover:bg-secondary/50",
          isSel && "bg-secondary",
        )}
      >
        <span className={cn("size-2 shrink-0 rounded-full", cls.dot)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{city.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">{city.state}</span>
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{city.headline}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block font-mono text-sm font-bold leading-none", cls.text)}>{city.score}</span>
          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
            {city.weather.temperatureC != null ? `${Math.round(city.weather.temperatureC)}°` : "—"}
          </span>
        </span>
      </button>
    </li>
  )
}

export function NetworkSidebar() {
  const {
    filtered,
    cities,
    isLoading,
    failed,
    query,
    setQuery,
    activeZones,
    toggleZone,
    activeLevels,
    toggleLevel,
    clearZones,
    sort,
    setSort,
    selectedCity,
  } = useNetwork()

  const hasFilters = activeZones.length > 0 || activeLevels.length > 0 || query.trim() !== ""

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, state or zone..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => toggleZone(z)}
              aria-pressed={activeZones.includes(z)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                activeZones.includes(z)
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {z}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLevel(l)}
              aria-pressed={activeLevels.includes(l)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                activeLevels.includes(l)
                  ? "border-current " + levelClasses[l].text
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", levelClasses[l].dot)} />
              {l}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  sort === s.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {filtered.length} of {cities.length} nodes
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearZones}
              className="text-[10px] font-medium text-primary transition-opacity hover:opacity-80"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {selectedCity && <CityDetail city={selectedCity} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <ul className="flex flex-col">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="border-b border-border px-4 py-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        )}

        {!isLoading && failed && (
          <p className="p-4 text-sm text-muted-foreground">
            Live weather feed is unavailable right now. Risk scores will populate on the next refresh.
          </p>
        )}

        {!isLoading && !failed && filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No nodes match the current filters.</p>
        )}

        {!isLoading && filtered.length > 0 && (
          <ul className="flex flex-col">
            {filtered.map((c) => (
              <CityRow key={c.name} city={c} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

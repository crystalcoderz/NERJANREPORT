import { NextResponse } from "next/server"
import { indiaCities, type IndiaCity } from "@/lib/india-cities"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export type RiskLevelName = "low" | "moderate" | "high" | "severe"

export type RiskFactor = {
  label: string
  points: number
  detail: string
}

export type ForecastPoint = {
  date: string
  code: number
  precipChance: number | null
  maxC: number | null
  minC: number | null
}

export type CityRisk = {
  name: string
  state: string
  zone: IndiaCity["zone"]
  coords: IndiaCity["coords"]
  role: string
  elevationM: number
  population: number
  port: boolean
  score: number
  level: RiskLevelName
  headline: string
  factors: RiskFactor[]
  weather: {
    temperatureC: number | null
    windKph: number | null
    gustKph: number | null
    precipMm: number | null
    humidity: number | null
    code: number | null
    condition: string
  }
  forecast: ForecastPoint[]
}

const weatherText: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "rime fog",
  51: "light drizzle",
  53: "drizzle",
  55: "dense drizzle",
  61: "light rain",
  63: "moderate rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "heavy freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "rain showers",
  81: "heavy rain showers",
  82: "violent rain showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "severe thunderstorm",
}

function conditionFor(code: number | null | undefined) {
  if (code == null) return "unknown"
  return weatherText[code] ?? "mixed conditions"
}

function levelFor(score: number): RiskLevelName {
  if (score >= 70) return "severe"
  if (score >= 45) return "high"
  if (score >= 22) return "moderate"
  return "low"
}

type RawCurrent = {
  temperature_2m?: number
  relative_humidity_2m?: number
  precipitation?: number
  weather_code?: number
  wind_speed_10m?: number
  wind_gusts_10m?: number
}

/**
 * Transparent additive risk model. Every term returns its own point
 * contribution so the UI can explain *why* a node scored the way it did,
 * rather than presenting an opaque number. Points are capped at 100.
 *
 * The compound terms matter most operationally: hill terrain is not itself a
 * hazard, and neither is rain, but rain falling on a ghat section is what
 * actually closes a road.
 */
function scoreCity(city: IndiaCity, current: RawCurrent, daily: ForecastPoint[]) {
  const factors: RiskFactor[] = []

  const precip = current.precipitation ?? 0
  const wind = current.wind_speed_10m ?? 0
  const gust = current.wind_gusts_10m ?? wind
  const code = current.weather_code ?? 0

  // Rain falling right now.
  if (precip > 0) {
    const pts = Math.min(24, Math.round(precip * 6))
    if (pts > 0) factors.push({ label: "Active rainfall", points: pts, detail: `${precip.toFixed(1)} mm/h falling now` })
  }

  // Convective weather — thunderstorms ground handling and stop loading.
  if (code >= 95) {
    factors.push({ label: "Thunderstorm", points: 22, detail: conditionFor(code) })
  } else if (code >= 80 && code <= 82) {
    factors.push({ label: "Heavy showers", points: 14, detail: conditionFor(code) })
  } else if (code >= 63 && code <= 65) {
    factors.push({ label: "Sustained rain", points: 11, detail: conditionFor(code) })
  }

  // Wind and gusts — tarpaulin, container and high-sided vehicle risk.
  if (gust >= 60) {
    factors.push({ label: "Damaging gusts", points: 18, detail: `gusting ${Math.round(gust)} km/h` })
  } else if (gust >= 40) {
    factors.push({ label: "Strong winds", points: 10, detail: `gusting ${Math.round(gust)} km/h` })
  }

  // Visibility.
  if (code === 45 || code === 48) {
    const pts = city.fogBelt ? 16 : 10
    factors.push({ label: "Low visibility", points: pts, detail: city.fogBelt ? "fog in a known dense-fog belt" : "fog reported" })
  }

  // Snow and ice at altitude.
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    factors.push({ label: "Snow or ice", points: city.elevationM > 1500 ? 20 : 12, detail: conditionFor(code) })
  }

  // Forward-looking: worst rain probability over the next few days.
  const upcoming = daily.slice(1)
  const worst = upcoming.reduce<ForecastPoint | null>(
    (acc, d) => (d.precipChance != null && (!acc || (acc.precipChance ?? 0) < d.precipChance) ? d : acc),
    null,
  )
  if (worst?.precipChance != null && worst.precipChance >= 60) {
    const pts = worst.precipChance >= 85 ? 12 : 7
    factors.push({
      label: "Deteriorating outlook",
      points: pts,
      detail: `${worst.precipChance}% rain probability on ${worst.date}`,
    })
  }

  // ---- compound terrain/vulnerability terms ----
  const wetNow = precip >= 0.5 || (code >= 61 && code <= 82) || code >= 95
  const wetSoon = (worst?.precipChance ?? 0) >= 70

  if (city.hillTerrain && (wetNow || wetSoon)) {
    factors.push({
      label: "Landslide exposure",
      points: wetNow ? 18 : 10,
      detail: `hill terrain at ${city.elevationM} m with rain ${wetNow ? "falling" : "forecast"}`,
    })
  }

  if (city.floodProne && (precip >= 2 || (worst?.precipChance ?? 0) >= 80)) {
    factors.push({
      label: "Flood exposure",
      points: precip >= 2 ? 16 : 9,
      detail: "flood-prone catchment under significant rainfall",
    })
  }

  if (city.port && gust >= 40) {
    factors.push({ label: "Port handling risk", points: 8, detail: "crane and yard operations affected by wind" })
  }

  const raw = factors.reduce((sum, f) => sum + f.points, 0)
  const score = Math.max(0, Math.min(100, raw))

  factors.sort((a, b) => b.points - a.points)

  const headline = factors.length
    ? factors[0].label
    : conditionFor(code).replace(/^./, (ch) => ch.toUpperCase())

  return { score, factors, headline }
}

export async function GET() {
  const lats = indiaCities.map((c) => c.coords.lat).join(",")
  const lngs = indiaCities.map((c) => c.coords.lng).join(",")

  try {
    // Open-Meteo accepts comma-separated coordinate lists, so the whole national
    // grid resolves in a single upstream request instead of one call per city.
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&forecast_days=4&wind_speed_unit=kmh&timezone=auto`

    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)

    const payload = await res.json()
    const rows: any[] = Array.isArray(payload) ? payload : [payload]

    const cities: CityRisk[] = indiaCities.map((city, i) => {
      const row = rows[i] ?? {}
      const current: RawCurrent = row.current ?? {}
      const d = row.daily ?? {}
      const days: string[] = Array.isArray(d.time) ? d.time : []

      const forecast: ForecastPoint[] = days.map((date, k) => ({
        date,
        code: d.weather_code?.[k] ?? 0,
        precipChance: d.precipitation_probability_max?.[k] ?? null,
        maxC: d.temperature_2m_max?.[k] ?? null,
        minC: d.temperature_2m_min?.[k] ?? null,
      }))

      const { score, factors, headline } = scoreCity(city, current, forecast)

      return {
        name: city.name,
        state: city.state,
        zone: city.zone,
        coords: city.coords,
        role: city.role,
        elevationM: city.elevationM,
        population: city.population,
        port: Boolean(city.port),
        score,
        level: levelFor(score),
        headline,
        factors,
        weather: {
          temperatureC: current.temperature_2m ?? null,
          windKph: current.wind_speed_10m ?? null,
          gustKph: current.wind_gusts_10m ?? null,
          precipMm: current.precipitation ?? null,
          humidity: current.relative_humidity_2m ?? null,
          code: current.weather_code ?? null,
          condition: conditionFor(current.weather_code),
        },
        forecast,
      }
    })

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      count: cities.length,
      cities,
    })
  } catch (err) {
    console.log("[v0] network-risk fetch failed:", (err as Error).message)
    return NextResponse.json(
      { ok: false, updatedAt: new Date().toISOString(), count: 0, cities: [], error: "Weather service unavailable" },
      { status: 200 },
    )
  }
}

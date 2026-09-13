import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { NextResponse } from "next/server"
import { withGemini, KIMI_MODEL } from "@/lib/ai-gemini"
import { resolvePlace } from "@/lib/geocode"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const moonshot = createOpenAICompatible({
  name: "moonshot",
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
})

type GeoResult = {
  name: string
  admin1: string | null
  country: string | null
  lat: number
  lng: number
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
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  56: "freezing drizzle",
  57: "dense freezing drizzle",
  66: "freezing rain",
  67: "heavy freezing rain",
  77: "snow grains",
  80: "rain showers",
  81: "rain showers",
  82: "violent rain showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "severe thunderstorm",
}

export type WeatherKind = "clear" | "cloudy" | "rain" | "storm" | "fog" | "snow"

function kindFromCode(code: number | null | undefined): WeatherKind {
  if (code == null) return "cloudy"
  if (code <= 1) return "clear"
  if (code <= 3) return "cloudy"
  if (code === 45 || code === 48) return "fog"
  if (code >= 95) return "storm"
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow"
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain"
  return "cloudy"
}

/**
 * Google Places covers every Indian city, town and landmark and tolerates typos,
 * unlike the strict global geocoder used previously — which matched "Tawang" to
 * a village in Indonesia and rejected slight misspellings outright.
 */
async function geocode(query: string): Promise<GeoResult | null> {
  const place = await resolvePlace(query)
  if (!place) return null
  return {
    name: place.label,
    admin1: place.state ?? null,
    country: place.country ?? "India",
    lat: place.lat,
    lng: place.lng,
  }
}

type LiveWeather = {
  temperatureC: number | null
  windKph: number | null
  precipMm: number | null
  humidity: number | null
  condition: string
  kind: WeatherKind
}

type ForecastDay = {
  date: string
  maxC: number | null
  minC: number | null
  precipChance: number | null
  windKph: number | null
  condition: string
  kind: WeatherKind
}

const EMPTY_WEATHER: LiveWeather = {
  temperatureC: null,
  windKph: null,
  precipMm: null,
  humidity: null,
  condition: "unknown",
  kind: "cloudy",
}

async function fetchWeather(lat: number, lng: number): Promise<{ weather: LiveWeather; forecast: ForecastDay[] }> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&forecast_days=7&wind_speed_unit=kmh&timezone=auto`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const json = await res.json()
    const c = json.current ?? {}
    const d = json.daily ?? {}
    const days: string[] = Array.isArray(d.time) ? d.time : []

    const forecast: ForecastDay[] = days.map((date, i) => {
      const code = d.weather_code?.[i] ?? null
      return {
        date,
        maxC: d.temperature_2m_max?.[i] ?? null,
        minC: d.temperature_2m_min?.[i] ?? null,
        precipChance: d.precipitation_probability_max?.[i] ?? null,
        windKph: d.wind_speed_10m_max?.[i] ?? null,
        condition: code != null ? weatherText[code] ?? "mixed conditions" : "unknown",
        kind: kindFromCode(code),
      }
    })

    return {
      weather: {
        temperatureC: c.temperature_2m ?? null,
        windKph: c.wind_speed_10m ?? null,
        precipMm: c.precipitation ?? null,
        humidity: c.relative_humidity_2m ?? null,
        condition: c.weather_code != null ? weatherText[c.weather_code] ?? "mixed conditions" : "unknown",
        kind: kindFromCode(c.weather_code),
      },
      forecast,
    }
  } catch (err) {
    console.log("[v0] location-brief weather fetch failed:", (err as Error).message)
    return { weather: EMPTY_WEATHER, forecast: [] }
  }
}

type Brief = {
  summary: string
  sections: { heading: string; body: string }[]
  highlights: string[]
  advisory: string
}

type Source = { title: string; url: string }

function buildPrompt(place: string, weather: LiveWeather, forecast: ForecastDay[]) {
  const outlook = forecast.length
    ? forecast
        .map((d) => {
          const lo = d.minC != null ? Math.round(d.minC) : "?"
          const hi = d.maxC != null ? Math.round(d.maxC) : "?"
          return `${d.date}: ${d.condition}, ${lo}-${hi}C, rain ${d.precipChance ?? 0}%`
        })
        .join("; ")
    : "unavailable"

  return `You are a logistics, terrain and regional intelligence analyst.

Draft an operational intelligence brief for: ${place}.

Use up-to-date, factual, real-world knowledge (search where useful) about this location: its geography, economy, freight/transport connectivity (highways, rail, air, ports), notable logistics or supply-chain factors, terrain and seasonal hazards, and anything a fleet operator should know.

Live weather right now at this location:
- Condition: ${weather.condition}
- Temperature: ${weather.temperatureC ?? "?"} C
- Wind: ${weather.windKph ?? "?"} km/h
- Precipitation: ${weather.precipMm ?? "?"} mm
- Humidity: ${weather.humidity ?? "?"}%

7-day outlook for this location:
${outlook}

Return ONLY valid minified JSON (no markdown, no code fences) with exactly these keys:
{
 "summary": "2-3 sentence executive summary of the location's strategic and logistics profile",
 "sections": [
   {"heading": "Geography & Terrain", "body": "2-3 sentences"},
   {"heading": "Economy & Freight", "body": "2-3 sentences on economy and what moves in/out"},
   {"heading": "Connectivity", "body": "2-3 sentences naming key highways, rail, airports, ports/corridors"},
   {"heading": "Seasonal Hazards", "body": "2-3 sentences on weather/terrain risks across the year"}
 ],
 "highlights": ["4 to 6 short factual bullet points (single phrases): key stats, distances, corridors, risks"],
 "advisory": "1-2 sentence practical operator advisory factoring in the live weather AND the 7-day outlook above; call out the specific upcoming day if conditions deteriorate"
}
Keep strings tight and factual. No preamble.`
}

function parseBrief(raw: string): Brief | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim()
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end === -1) return null
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    if (!obj.summary) return null
    return {
      summary: String(obj.summary),
      sections: Array.isArray(obj.sections)
        ? obj.sections.slice(0, 6).map((s: { heading?: unknown; body?: unknown }) => ({
            heading: String(s.heading ?? ""),
            body: String(s.body ?? ""),
          }))
        : [],
      highlights: Array.isArray(obj.highlights) ? obj.highlights.slice(0, 6).map(String) : [],
      advisory: String(obj.advisory ?? ""),
    }
  } catch {
    return null
  }
}

type GroundingSource = { url?: string; title?: string; sourceType?: string }

function extractSources(result: { sources?: GroundingSource[] }): Source[] {
  const out: Source[] = []
  const seen = new Set<string>()
  for (const s of result.sources ?? []) {
    if (!s?.url || seen.has(s.url)) continue
    seen.add(s.url)
    out.push({ title: s.title || new URL(s.url).hostname, url: s.url })
    if (out.length >= 6) break
  }
  return out
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") ?? "").trim()

  if (!query) {
    return NextResponse.json({ error: "Missing location query" }, { status: 400 })
  }

  const geo = await geocode(query)
  if (!geo) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 })
  }

  const placeLabel = [geo.name, geo.admin1, geo.country].filter(Boolean).join(", ")
  const { weather, forecast } = await fetchWeather(geo.lat, geo.lng)
  const prompt = buildPrompt(placeLabel, weather, forecast)

  const base = {
    place: placeLabel,
    name: geo.name,
    region: geo.admin1,
    country: geo.country,
    coords: { lat: geo.lat, lng: geo.lng },
    weather,
    forecast,
  }

  try {
    const result = await generateText({
      model: moonshot(KIMI_MODEL),
      prompt,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(30000),
    })
    const brief = parseBrief(result.text)
    if (!brief) throw new Error("unparseable brief")
    return NextResponse.json({ ...base, brief, sources: [], grounded: false })
  } catch (kimiError) {
    console.log("[v0] location-brief Kimi failed, trying Gemini:", (kimiError as Error).message)
    try {
      const result = await withGemini((model) =>
        generateText({ model, prompt, temperature: 0.4, maxRetries: 0 }),
      )
      const brief = parseBrief(result.text)
      if (!brief) throw new Error("unparseable brief")
      const sources = extractSources(result)
      return NextResponse.json({ ...base, brief, sources, grounded: sources.length > 0 })
    } catch (geminiError) {
      console.log("[v0] location-brief Gemini failed:", (geminiError as Error).message)
      return NextResponse.json({
        ...base,
        grounded: false,
        sources: [],
        brief: {
          summary: `${placeLabel} — live briefing service is temporarily unavailable, showing live weather only.`,
          sections: [],
          highlights: [],
          advisory: "Monitor live weather and local advisories before departure.",
        } satisfies Brief,
      })
    }
  }
}

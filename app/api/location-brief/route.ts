import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { NextResponse } from "next/server"
import { withGemini, KIMI_MODEL } from "@/lib/ai-gemini"

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
  80: "rain showers",
  81: "rain showers",
  82: "violent rain showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "severe thunderstorm",
}

async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`geocoding ${res.status}`)
    const json = await res.json()
    const first = json?.results?.[0]
    if (!first) return null
    return {
      name: first.name,
      admin1: first.admin1 ?? null,
      country: first.country ?? null,
      lat: first.latitude,
      lng: first.longitude,
    }
  } catch (err) {
    console.log("[v0] location-brief geocode failed:", (err as Error).message)
    return null
  }
}

type LiveWeather = {
  temperatureC: number | null
  windKph: number | null
  precipMm: number | null
  humidity: number | null
  condition: string
}

async function fetchWeather(lat: number, lng: number): Promise<LiveWeather> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=auto`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const json = await res.json()
    const c = json.current ?? {}
    return {
      temperatureC: c.temperature_2m ?? null,
      windKph: c.wind_speed_10m ?? null,
      precipMm: c.precipitation ?? null,
      humidity: c.relative_humidity_2m ?? null,
      condition: c.weather_code != null ? weatherText[c.weather_code] ?? "mixed conditions" : "unknown",
    }
  } catch (err) {
    console.log("[v0] location-brief weather fetch failed:", (err as Error).message)
    return { temperatureC: null, windKph: null, precipMm: null, humidity: null, condition: "unknown" }
  }
}

type Brief = {
  summary: string
  sections: { heading: string; body: string }[]
  highlights: string[]
  advisory: string
}

type Source = { title: string; url: string }

function buildPrompt(place: string, weather: LiveWeather) {
  return `You are a logistics, terrain and regional intelligence analyst.

Draft an operational intelligence brief for: ${place}.

Use up-to-date, factual, real-world knowledge (search where useful) about this location: its geography, economy, freight/transport connectivity (highways, rail, air, ports), notable logistics or supply-chain factors, terrain and seasonal hazards, and anything a fleet operator should know.

Live weather right now at this location:
- Condition: ${weather.condition}
- Temperature: ${weather.temperatureC ?? "?"} C
- Wind: ${weather.windKph ?? "?"} km/h
- Precipitation: ${weather.precipMm ?? "?"} mm
- Humidity: ${weather.humidity ?? "?"}%

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
 "advisory": "1-2 sentence practical operator advisory factoring in the live weather above"
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
  const weather = await fetchWeather(geo.lat, geo.lng)
  const prompt = buildPrompt(placeLabel, weather)

  const base = {
    place: placeLabel,
    name: geo.name,
    region: geo.admin1,
    country: geo.country,
    coords: { lat: geo.lat, lng: geo.lng },
    weather,
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

import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { NextResponse } from "next/server"
import { nerCities } from "@/lib/data"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const GEMINI_MODEL = "gemini-flash-latest"
const KIMI_MODEL = "kimi-k3"

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
const moonshot = createOpenAICompatible({
  name: "moonshot",
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
})

type LiveWeather = {
  temperatureC: number | null
  windKph: number | null
  precipMm: number | null
  humidity: number | null
  code: number | null
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
      code: c.weather_code ?? null,
    }
  } catch (err) {
    console.log("[v0] city-intel weather fetch failed:", (err as Error).message)
    return { temperatureC: null, windKph: null, precipMm: null, humidity: null, code: null }
  }
}

type Intel = {
  overview: string
  logistics: string
  hazards: string[]
  connectivity: string
  advisory: string
}

function buildPrompt(cityName: string, state: string, weather: LiveWeather) {
  const sky = weather.code != null ? weatherText[weather.code] ?? "mixed conditions" : "unknown"
  return `You are a logistics and terrain intelligence analyst for the North Eastern Region (NER) of India.

Produce a concise operational intel briefing for ${cityName}, ${state}.

Live weather right now at this location:
- Sky: ${sky}
- Temperature: ${weather.temperatureC ?? "?"} C
- Wind: ${weather.windKph ?? "?"} km/h
- Precipitation: ${weather.precipMm ?? "?"} mm
- Humidity: ${weather.humidity ?? "?"}%

Return ONLY valid minified JSON (no markdown, no code fences) with exactly these keys:
{
 "overview": "2 sentences on the city's strategic/geographic role in NER logistics",
 "logistics": "1-2 sentences on freight access: highways, rail, air connectivity",
 "hazards": ["3 short terrain/weather hazard phrases relevant to this location and the current weather"],
 "connectivity": "1 sentence naming the key highway(s)/corridor(s) linking this city",
 "advisory": "1 sentence practical driver advisory factoring in the live weather above"
}
Keep every string tight and factual. No preamble.`
}

function parseIntel(raw: string): Intel | null {
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
    if (!obj.overview) return null
    return {
      overview: String(obj.overview),
      logistics: String(obj.logistics ?? ""),
      hazards: Array.isArray(obj.hazards) ? obj.hazards.slice(0, 4).map(String) : [],
      connectivity: String(obj.connectivity ?? ""),
      advisory: String(obj.advisory ?? ""),
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cityName = searchParams.get("city") ?? ""
  const city = nerCities.find((c) => c.name.toLowerCase() === cityName.toLowerCase())

  if (!city) {
    return NextResponse.json({ error: "Unknown city" }, { status: 404 })
  }

  const weather = await fetchWeather(city.coords.lat, city.coords.lng)
  const prompt = buildPrompt(city.name, city.state, weather)

  const base = {
    city: city.name,
    state: city.state,
    role: city.role,
    elevationM: city.elevationM,
    population: city.population,
    coords: city.coords,
    weather: {
      ...weather,
      condition: weather.code != null ? weatherText[weather.code] ?? "mixed" : "unknown",
    },
  }

  async function withModel(fn: () => Promise<string>, provider: string, model: string) {
    const text = await fn()
    const intel = parseIntel(text)
    if (!intel) throw new Error("unparseable intel")
    return NextResponse.json({ ...base, provider, model, intel })
  }

  try {
    return await withModel(
      async () => (await generateText({ model: google(GEMINI_MODEL), prompt, temperature: 0.4 })).text,
      "Gemini",
      GEMINI_MODEL,
    )
  } catch (geminiError) {
    console.log("[v0] city-intel Gemini failed, trying Kimi:", (geminiError as Error).message)
    try {
      return await withModel(
        async () => (await generateText({ model: moonshot(KIMI_MODEL), prompt })).text,
        "Kimi (fallback)",
        KIMI_MODEL,
      )
    } catch (kimiError) {
      console.log("[v0] city-intel Kimi failed:", (kimiError as Error).message)
      return NextResponse.json({
        ...base,
        provider: "Offline",
        model: "none",
        intel: {
          overview: `${city.name} is a key node in ${city.state}'s supply network within the North Eastern Region.`,
          logistics: "Freight moves primarily by national highway, with limited rail and air links serving the district.",
          hazards: ["Monsoon landslides", "Reduced hill visibility", "Seasonal road damage"],
          connectivity: "Connected to the NER corridor via national highway links.",
          advisory: "Monitor live weather and slope conditions before departure.",
        },
      })
    }
  }
}

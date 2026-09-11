import { NextResponse } from "next/server"
import { generateObject, generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { cities } from "@/lib/data"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const GEMINI_MODEL = "gemini-3.6-flash"
const KIMI_MODEL = "kimi-k3"

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
const moonshot = createOpenAICompatible({
  name: "moonshot",
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
})

const incidentSchema = z.object({
  incidents: z
    .array(
      z.object({
        corridor: z.string().describe('Corridor this incident affects, formatted as "CityA to CityB"'),
        nearestCity: z.string().describe("The known city from the provided list nearest to this incident"),
        title: z.string().describe("Short incident title, e.g. 'Landslide-prone stretch'"),
        detail: z.string().describe("One sentence describing the on-ground condition for drivers"),
        level: z.enum(["info", "low", "moderate", "high"]),
      }),
    )
    .max(8),
})

async function fetchCityForecast(apiKey: string, place: string, lat: number, lng: number) {
  try {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lng}&days=1&aqi=no&alerts=yes`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    const day = data?.forecast?.forecastday?.[0]?.day
    const condition = data?.current?.condition?.text
    if (!day) return null
    return {
      place,
      condition,
      chanceOfRain: day.daily_chance_of_rain,
      precipMm: day.totalprecip_mm,
      windKph: day.maxwind_kph,
      visKm: day.avgvis_km,
    }
  } catch {
    return null
  }
}

function buildPrompt(
  weather: { place: string; condition: string; chanceOfRain: number; precipMm: number; windKph: number; visKm: number }[],
  reports: { location_name: string; corridor: string | null; severity: string; description: string }[],
) {
  const weatherText = weather.length
    ? weather
        .map(
          (w) =>
            `- ${w.place}: ${w.condition}, ${w.chanceOfRain}% chance of rain, ${w.precipMm}mm precipitation, wind ${w.windKph} km/h, visibility ${w.visKm} km`,
        )
        .join("\n")
    : "- No live weather data available"

  const reportsText = reports.length
    ? reports.map((r) => `- ${r.location_name}${r.corridor ? ` (${r.corridor})` : ""}: ${r.severity} severity — ${r.description}`).join("\n")
    : "- No active field reports"

  const cityList = Object.keys(cities).join(", ")

  return `You are a live road-incident monitor for freight corridors across the North Eastern Region of India (hilly terrain prone to landslides, flooding, and road damage).

Known cities: ${cityList}

Current weather signals:
${weatherText}

Active driver field reports:
${reportsText}

Based ONLY on the signals above, generate a short list (0-8) of the most important current road incidents for drivers to know about right now. Each incident must reference a real corridor between two of the known cities and the nearest known city. Skip anything not supported by the data — if there is nothing notable, return an empty list. Be concise and practical, no markdown.`
}

function buildJsonPrompt(basePrompt: string) {
  return `${basePrompt}

Respond with ONLY raw JSON (no markdown fences, no commentary) matching this exact shape:
{"incidents":[{"corridor":"CityA to CityB","nearestCity":"CityA","title":"short title","detail":"one sentence detail","level":"info|low|moderate|high"}]}`
}

function parseIncidentJson(text: string): z.infer<typeof incidentSchema> | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    const parsed = JSON.parse(cleaned)
    const result = incidentSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export async function POST() {
  const supabase = await createClient()

  const { data: reportsRaw } = await supabase
    .from("field_reports")
    .select("location_name, corridor, severity, description")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20)
  const reports = reportsRaw ?? []

  const apiKey = process.env.WEATHERAPI_KEY
  let weather: Awaited<ReturnType<typeof fetchCityForecast>>[] = []
  if (apiKey) {
    const entries = Object.entries(cities)
    const results = await Promise.all(entries.map(([place, coords]) => fetchCityForecast(apiKey, place, coords.lat, coords.lng)))
    weather = results.filter((r): r is NonNullable<typeof r> => r !== null)
  }

  const prompt = buildPrompt(weather as any, reports)

  let provider = "Gemini"
  let model = GEMINI_MODEL
  let result: { object: z.infer<typeof incidentSchema> } | null = null

  try {
    result = await generateObject({ model: google(GEMINI_MODEL), schema: incidentSchema, prompt, temperature: 0.3 })
  } catch (geminiError) {
    console.log("[v0] Gemini incident generation failed, falling back to Kimi:", (geminiError as Error).message)
    try {
      provider = "Kimi (fallback)"
      model = KIMI_MODEL
      // Moonshot doesn't support structured-output mode, and only accepts the default
      // temperature (1) — so ask for plain JSON via generateText and parse it manually.
      const { text } = await generateText({ model: moonshot(KIMI_MODEL), prompt: buildJsonPrompt(prompt) })
      const parsed = parseIncidentJson(text)
      if (!parsed) {
        console.log("[v0] Kimi incident generation returned unparseable JSON")
        return NextResponse.json({ ok: false, provider: "Offline", generated: 0 }, { status: 200 })
      }
      result = { object: parsed }
    } catch (kimiError) {
      console.log("[v0] Kimi incident generation also failed:", (kimiError as Error).message)
      return NextResponse.json({ ok: false, provider: "Offline", generated: 0 }, { status: 200 })
    }
  }

  const rows = result.object.incidents.map((inc) => {
    const pos = cities[inc.nearestCity]
    return {
      corridor: inc.corridor,
      title: inc.title,
      detail: inc.detail,
      level: inc.level,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      source: "ai" as const,
      model,
    }
  })

  // Clear the previous AI-generated batch so the feed reflects only the latest analysis.
  await supabase.from("incidents").delete().eq("source", "ai")

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("incidents").insert(rows)
    if (insertError) {
      console.log("[v0] incidents insert error:", insertError.message)
      return NextResponse.json({ ok: false, provider, generated: 0 }, { status: 200 })
    }
  }

  return NextResponse.json({ ok: true, provider, model, generated: rows.length })
}

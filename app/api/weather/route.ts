import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type NormalizedWeather = {
  source: "weatherapi" | "mock"
  place: string
  tempC: number
  condition: string
  kind: string
  precipPercent: number
  windKph: number
  visibilityKm: number
  humidity: number
  updatedAt: string | null
}

function classifyKind(text: string): string {
  const t = text.toLowerCase()
  if (t.includes("thunder")) return "storm"
  if (t.includes("snow") || t.includes("sleet") || t.includes("ice")) return "snow"
  if (t.includes("fog") || t.includes("mist")) return "fog"
  if (t.includes("rain") || t.includes("drizzle") || t.includes("shower")) return "rain"
  if (t.includes("cloud") || t.includes("overcast")) return "cloudy"
  return "clear"
}

function mock(place: string): NormalizedWeather {
  return {
    source: "mock",
    place,
    tempC: 24,
    condition: "Light Rain",
    kind: "rain",
    precipPercent: 45,
    windKph: 14,
    visibilityKm: 6,
    humidity: 70,
    updatedAt: null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const place = searchParams.get("place") ?? "Guwahati, Assam"

  const apiKey = process.env.WEATHERAPI_KEY

  if (!apiKey || !lat || !lng) {
    return NextResponse.json(mock(place))
  }

  try {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lng}&days=1&aqi=no&alerts=no`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json(mock(place))
    }
    const data = await res.json()

    const current = data?.current
    const today = data?.forecast?.forecastday?.[0]?.day
    const conditionText: string = current?.condition?.text ?? "Cloudy"

    const normalized: NormalizedWeather = {
      source: "weatherapi",
      place,
      tempC: Math.round(current?.temp_c ?? 24),
      condition: conditionText,
      kind: classifyKind(conditionText),
      precipPercent: Math.round(today?.daily_chance_of_rain ?? (current?.precip_mm > 0 ? 60 : 0)),
      windKph: Math.round(current?.wind_kph ?? 0),
      visibilityKm: Math.round(current?.vis_km ?? 0),
      humidity: Math.round(current?.humidity ?? 0),
      updatedAt: current?.last_updated ?? null,
    }
    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json(mock(place))
  }
}

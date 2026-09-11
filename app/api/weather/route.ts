import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type NormalizedWeather = {
  source: "google" | "mock"
  place: string
  tempC: number
  condition: string
  kind: string
  precipPercent: number
  windKph: number
  visibilityKm: number
}

const KIND_MAP: Record<string, string> = {
  CLEAR: "clear",
  MOSTLY_CLEAR: "clear",
  PARTLY_CLOUDY: "cloudy",
  MOSTLY_CLOUDY: "cloudy",
  CLOUDY: "cloudy",
  RAIN: "rain",
  LIGHT_RAIN: "rain",
  HEAVY_RAIN: "rain",
  RAIN_SHOWERS: "rain",
  THUNDERSTORM: "storm",
  FOG: "fog",
  SNOW: "snow",
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
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const place = searchParams.get("place") ?? "Guwahati, Assam"

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey || !lat || !lng) {
    return NextResponse.json(mock(place))
  }

  try {
    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=${lat}&location.longitude=${lng}`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json(mock(place))
    }
    const data = await res.json()

    const type: string = data?.weatherCondition?.type ?? "CLOUDY"
    const normalized: NormalizedWeather = {
      source: "google",
      place,
      tempC: Math.round(data?.temperature?.degrees ?? 24),
      condition: data?.weatherCondition?.description?.text ?? "Cloudy",
      kind: KIND_MAP[type] ?? "cloudy",
      precipPercent: Math.round(data?.precipitation?.probability?.percent ?? 0),
      windKph: Math.round(data?.wind?.speed?.value ?? 0),
      visibilityKm: Math.round(data?.visibility?.distance ?? 0),
    }
    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json(mock(place))
  }
}

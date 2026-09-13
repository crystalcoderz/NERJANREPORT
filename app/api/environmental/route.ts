import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type StormRisk = "low" | "moderate" | "high"

type Normalized = {
  source: "open-meteo" | "mock"
  place: string
  wind: { speedKph: number; gustKph: number; directionDeg: number; compass: string }
  cloudCoverPercent: number
  precipProbPercent: number
  storm: { risk: StormRisk; label: string; etaHours: number | null }
  soil: { moisturePercent: number; moistureLabel: string; temperatureC: number }
  updatedAt: string | null
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]

function toCompass(deg: number) {
  return COMPASS[Math.round(deg / 22.5) % 16]
}

function classifySoil(vwc: number) {
  if (vwc < 0.15) return "Dry"
  if (vwc < 0.35) return "Optimal"
  return "Saturated"
}

// WMO weather codes for thunderstorms (with/without hail).
const THUNDER_CODES = new Set([95, 96, 99])

function mock(place: string): Normalized {
  return {
    source: "mock",
    place,
    wind: { speedKph: 14, gustKph: 22, directionDeg: 200, compass: "SSW" },
    cloudCoverPercent: 55,
    precipProbPercent: 35,
    storm: { risk: "low", label: "No storm cells detected", etaHours: null },
    soil: { moisturePercent: 24, moistureLabel: "Optimal", temperatureC: 22 },
    updatedAt: null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const place = searchParams.get("place") ?? "Guwahati, Assam"

  if (!lat || !lng) {
    return NextResponse.json(mock(place))
  }

  try {
    // Open-Meteo is a free, keyless weather API that also exposes modeled
    // soil moisture/temperature — no billing or API key setup required.
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,weather_code` +
      `&hourly=soil_moisture_0_to_1cm,soil_temperature_0cm,precipitation_probability,weather_code` +
      `&forecast_days=2&wind_speed_unit=kmh&timezone=auto`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json(mock(place))
    }
    const data = await res.json()

    const current = data?.current
    const hourly = data?.hourly
    const times: string[] = hourly?.time ?? []
    const currentTime: string | undefined = current?.time
    let idx = currentTime ? times.indexOf(currentTime) : -1
    if (idx === -1) idx = 0

    const soilMoistureRaw: number = hourly?.soil_moisture_0_to_1cm?.[idx] ?? 0.24
    const soilTemp: number = hourly?.soil_temperature_0cm?.[idx] ?? 22
    const precipProb: number = hourly?.precipitation_probability?.[idx] ?? 0

    const currentCode: number = current?.weather_code ?? 0
    let stormRisk: StormRisk = "low"
    let stormLabel = "No storm cells detected"
    let etaHours: number | null = null

    if (THUNDER_CODES.has(currentCode)) {
      stormRisk = "high"
      stormLabel = "Thunderstorm active"
      etaHours = 0
    } else {
      const codes: number[] = hourly?.weather_code ?? []
      for (let h = idx + 1; h < Math.min(idx + 13, codes.length); h++) {
        if (THUNDER_CODES.has(codes[h])) {
          etaHours = h - idx
          stormRisk = etaHours <= 3 ? "high" : "moderate"
          stormLabel = `Thunderstorm risk in ~${etaHours}h`
          break
        }
      }
    }

    const windDir: number = current?.wind_direction_10m ?? 0

    const normalized: Normalized = {
      source: "open-meteo",
      place,
      wind: {
        speedKph: Math.round(current?.wind_speed_10m ?? 0),
        gustKph: Math.round(current?.wind_gusts_10m ?? 0),
        directionDeg: Math.round(windDir),
        compass: toCompass(windDir),
      },
      cloudCoverPercent: Math.round(current?.cloud_cover ?? 0),
      precipProbPercent: Math.round(precipProb),
      storm: { risk: stormRisk, label: stormLabel, etaHours },
      soil: {
        moisturePercent: Math.round(soilMoistureRaw * 100),
        moistureLabel: classifySoil(soilMoistureRaw),
        temperatureC: Math.round(soilTemp),
      },
      updatedAt: current?.time ?? null,
    }

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json(mock(place))
  }
}

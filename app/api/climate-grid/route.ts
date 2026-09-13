import { NextResponse } from "next/server"
import { nerCities } from "@/lib/data"

export const dynamic = "force-dynamic"

type StormRisk = "low" | "moderate" | "high"

export type ClimateCell = {
  name: string
  state: string
  coords: { lat: number; lng: number }
  soilMoisturePercent: number
  soilMoistureLabel: string
  soilTemperatureC: number
  airTemperatureC: number
  cloudCoverPercent: number
  precipProbPercent: number
  windSpeedKph: number
  windGustKph: number
  storm: { risk: StormRisk; label: string }
}

export type ClimateGrid = {
  source: "open-meteo" | "mock"
  updatedAt: string | null
  cells: ClimateCell[]
}

const THUNDER_CODES = new Set([95, 96, 99])

function classifySoil(vwc: number) {
  if (vwc < 0.15) return "Dry"
  if (vwc < 0.35) return "Optimal"
  return "Saturated"
}

function stormFrom(currentCode: number, hourlyCodes: number[], idx: number): { risk: StormRisk; label: string } {
  if (THUNDER_CODES.has(currentCode)) return { risk: "high", label: "Thunderstorm active" }
  for (let h = idx + 1; h < Math.min(idx + 13, hourlyCodes.length); h++) {
    if (THUNDER_CODES.has(hourlyCodes[h])) {
      const eta = h - idx
      return { risk: eta <= 3 ? "high" : "moderate", label: `Storm risk ~${eta}h` }
    }
  }
  return { risk: "low", label: "Clear" }
}

function mockGrid(): ClimateGrid {
  return {
    source: "mock",
    updatedAt: null,
    cells: nerCities.map((c, i) => ({
      name: c.name,
      state: c.state,
      coords: c.coords,
      soilMoisturePercent: 20 + ((i * 7) % 45),
      soilMoistureLabel: "Optimal",
      soilTemperatureC: 18 + ((i * 3) % 12),
      airTemperatureC: 20 + ((i * 4) % 14),
      cloudCoverPercent: 30 + ((i * 11) % 60),
      precipProbPercent: (i * 13) % 90,
      windSpeedKph: 6 + ((i * 5) % 24),
      windGustKph: 14 + ((i * 6) % 30),
      storm: { risk: "low", label: "Clear" },
    })),
  }
}

export async function GET() {
  try {
    // Open-Meteo accepts comma-separated coordinates and returns an array of
    // forecasts — so the entire NER grid resolves in a single keyless request.
    const lats = nerCities.map((c) => c.coords.lat).join(",")
    const lngs = nerCities.map((c) => c.coords.lng).join(",")
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
      `&current=temperature_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,weather_code` +
      `&hourly=soil_moisture_0_to_1cm,soil_temperature_0cm,precipitation_probability,weather_code` +
      `&forecast_days=2&wind_speed_unit=kmh&timezone=auto`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return NextResponse.json(mockGrid())

    const json = await res.json()
    const arr = Array.isArray(json) ? json : [json]

    const cells: ClimateCell[] = nerCities.map((city, i) => {
      const data = arr[i] ?? arr[0]
      const current = data?.current
      const hourly = data?.hourly
      const times: string[] = hourly?.time ?? []
      const currentTime: string | undefined = current?.time
      let idx = currentTime ? times.indexOf(currentTime) : -1
      if (idx === -1) idx = 0

      const vwc: number = hourly?.soil_moisture_0_to_1cm?.[idx] ?? 0.24
      const soilTemp: number = hourly?.soil_temperature_0cm?.[idx] ?? 22
      const precip: number = hourly?.precipitation_probability?.[idx] ?? 0
      const hourlyCodes: number[] = hourly?.weather_code ?? []

      return {
        name: city.name,
        state: city.state,
        coords: city.coords,
        soilMoisturePercent: Math.round(vwc * 100),
        soilMoistureLabel: classifySoil(vwc),
        soilTemperatureC: Math.round(soilTemp),
        airTemperatureC: Math.round(current?.temperature_2m ?? 0),
        cloudCoverPercent: Math.round(current?.cloud_cover ?? 0),
        precipProbPercent: Math.round(precip),
        windSpeedKph: Math.round(current?.wind_speed_10m ?? 0),
        windGustKph: Math.round(current?.wind_gusts_10m ?? 0),
        storm: stormFrom(current?.weather_code ?? 0, hourlyCodes, idx),
      }
    })

    return NextResponse.json({
      source: "open-meteo",
      updatedAt: arr[0]?.current?.time ?? null,
      cells,
    } satisfies ClimateGrid)
  } catch {
    return NextResponse.json(mockGrid())
  }
}

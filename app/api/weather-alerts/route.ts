import { NextResponse } from "next/server"
import { cities, weatherAlerts as mockWeatherAlerts } from "@/lib/data"

export const dynamic = "force-dynamic"

type AlertKind = "rain" | "landslide" | "fog" | "flood" | "wind"

type LiveAlert = {
  id: string
  level: "low" | "moderate" | "high"
  title: string
  place: string
  eta: string
  kind: AlertKind
  source: "weatherapi" | "mock"
}

function hoursFromNow(n: number) {
  return n <= 1 ? "now" : `in ${n} hours`
}

async function fetchCityForecast(apiKey: string, place: string, lat: number, lng: number) {
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lng}&days=1&aqi=no&alerts=yes`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  const data = await res.json()
  return { place, data }
}

export async function GET() {
  const apiKey = process.env.WEATHERAPI_KEY

  if (!apiKey) {
    return NextResponse.json({ source: "mock", alerts: mockWeatherAlerts })
  }

  try {
    const entries = Object.entries(cities)
    const results = await Promise.all(
      entries.map(([place, coords]) => fetchCityForecast(apiKey, place, coords.lat, coords.lng).catch(() => null)),
    )

    const alerts: LiveAlert[] = []

    for (const result of results) {
      if (!result) continue
      const { place, data } = result
      const today = data?.forecast?.forecastday?.[0]?.day
      const condition: string = (data?.current?.condition?.text ?? "").toLowerCase()
      const officialAlerts = data?.alerts?.alert ?? []

      for (const a of officialAlerts) {
        alerts.push({
          id: `wa-official-${place}-${a.headline?.slice(0, 12) ?? Math.random()}`,
          level: a.severity?.toLowerCase().includes("severe") ? "high" : "moderate",
          title: a.event ?? "Weather Alert",
          place,
          eta: "active now",
          kind: "rain",
          source: "weatherapi",
        })
      }

      if (!today) continue

      const chanceOfRain: number = today.daily_chance_of_rain ?? 0
      const totalPrecip: number = today.totalprecip_mm ?? 0
      const maxWind: number = today.maxwind_kph ?? 0
      const avgVis: number = today.avgvis_km ?? 10

      if (totalPrecip >= 40) {
        alerts.push({
          id: `wa-${place}-flood`,
          level: "high",
          title: "Flood Warning",
          place,
          eta: hoursFromNow(2),
          kind: "flood",
          source: "weatherapi",
        })
      } else if (chanceOfRain >= 70 || totalPrecip >= 15) {
        alerts.push({
          id: `wa-${place}-rain`,
          level: chanceOfRain >= 85 ? "high" : "moderate",
          title: "Heavy Rain Expected",
          place,
          eta: hoursFromNow(3),
          kind: "rain",
          source: "weatherapi",
        })
      }

      if (condition.includes("thunder")) {
        alerts.push({
          id: `wa-${place}-storm`,
          level: "high",
          title: "Thunderstorm Risk",
          place,
          eta: hoursFromNow(1),
          kind: "landslide",
          source: "weatherapi",
        })
      }

      if (avgVis <= 3) {
        alerts.push({
          id: `wa-${place}-fog`,
          level: avgVis <= 1 ? "high" : "moderate",
          title: "Low Visibility",
          place,
          eta: hoursFromNow(5),
          kind: "fog",
          source: "weatherapi",
        })
      }

      if (maxWind >= 40) {
        alerts.push({
          id: `wa-${place}-wind`,
          level: maxWind >= 60 ? "high" : "moderate",
          title: "Strong Winds",
          place,
          eta: hoursFromNow(4),
          kind: "wind",
          source: "weatherapi",
        })
      }
    }

    if (alerts.length === 0) {
      return NextResponse.json({ source: "weatherapi", alerts: mockWeatherAlerts.slice(0, 2) })
    }

    alerts.sort((a, b) => (a.level === "high" ? -1 : 0) - (b.level === "high" ? -1 : 0))

    return NextResponse.json({ source: "weatherapi", alerts })
  } catch {
    return NextResponse.json({ source: "mock", alerts: mockWeatherAlerts })
  }
}

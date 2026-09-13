import { cities } from "@/lib/data"

export type GeocodedPlace = { lat: number; lng: number; label: string }

// Resolves a city name typed by a driver to coordinates — checks the known NER
// city list first, then falls back to the Google Geocoding API for anything else.
export async function geocodeCity(name: string): Promise<GeocodedPlace | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const knownKey = Object.keys(cities).find((c) => c.toLowerCase() === trimmed.toLowerCase())
  if (knownKey) return { ...cities[knownKey], label: knownKey }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      `${trimmed}, Northeast India`,
    )}&key=${apiKey}`
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result) return null
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      label: result.formatted_address?.split(",")[0] ?? trimmed,
    }
  } catch (err) {
    console.log("[v0] geocodeCity error:", (err as Error).message)
    return null
  }
}

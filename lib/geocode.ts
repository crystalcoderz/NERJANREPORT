import { cities } from "@/lib/data"

export type GeocodedPlace = { lat: number; lng: number; label: string; state?: string }

/** Google result types that represent a place a driver can depart from or arrive at. */
const PLACE_TYPES = new Set([
  "locality",
  "sublocality",
  "sublocality_level_1",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "postal_town",
  "airport",
  "transit_station",
  "establishment",
  "point_of_interest",
  "premise",
  "natural_feature",
])

const cache = new Map<string, { value: GeocodedPlace | null; at: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function component(result: any, type: string): string | undefined {
  return result?.address_components?.find((c: any) => c.types?.includes(type))?.long_name
}

/**
 * Resolves a place typed by a driver to coordinates, anywhere in India.
 *
 * The previous version appended "Northeast India" to every query, so Jhansi
 * resolved to somewhere in Assam or not at all. Biasing is now done with
 * `components=country:IN`, which constrains results to India without pulling
 * them toward one region.
 */
export async function geocodeCity(name: string): Promise<GeocodedPlace | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const knownKey = Object.keys(cities).find((c) => c.toLowerCase() === trimmed.toLowerCase())
  if (knownKey) return { ...cities[knownKey], label: knownKey }

  const key = trimmed.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  let value: GeocodedPlace | null = null
  try {
    const url = "https://maps.googleapis.com/maps/api/geocode/json"
      + `?address=${encodeURIComponent(trimmed)}`
      + "&components=country:IN&region=in"
      + `&key=${apiKey}`

    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      // Ignore results that are only a street or plus-code so stray words like
      // "ok" can't be mistaken for a city.
      const result = (data.results ?? []).find((r: any) => (r.types ?? []).some((t: string) => PLACE_TYPES.has(t)))

      if (result) {
        const label = component(result, "locality")
          ?? component(result, "postal_town")
          ?? component(result, "administrative_area_level_3")
          ?? component(result, "administrative_area_level_2")
          ?? result.formatted_address?.split(",")[0]
          ?? trimmed
        value = {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          label,
          state: component(result, "administrative_area_level_1"),
        }
      } else if (data.status && data.status !== "ZERO_RESULTS" && data.status !== "OK") {
        // Quota or key problems must not be cached as "this city doesn't exist".
        console.log("[v0] geocodeCity status:", data.status, data.error_message ?? "")
        return null
      }
    }
  } catch (err) {
    console.log("[v0] geocodeCity error:", (err as Error).message)
    return null
  }

  cache.set(key, { value, at: Date.now() })
  return value
}

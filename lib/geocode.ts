import { cities } from "@/lib/data"

export type GeocodedPlace = { lat: number; lng: number; label: string; state?: string }

export type ResolvedPlace = GeocodedPlace & {
  country?: string
  formattedAddress?: string
}

const cache = new Map<string, { value: ResolvedPlace | null; at: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function component(result: any, type: string): string | undefined {
  return result?.address_components?.find((c: any) => c.types?.includes(type))?.long_name
}

/**
 * Places Text Search tolerates misspellings ("luckniw" resolves to Lucknow) and
 * matches landmarks and corridors, which strict geocoding rejects outright.
 */
async function viaPlaces(query: string, apiKey: string): Promise<ResolvedPlace | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: "IN",
      languageCode: "en",
      maxResultCount: 1,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  })

  if (!res.ok) {
    console.log("[v0] places searchText failed:", res.status, (await res.text()).slice(0, 200))
    return null
  }

  const place = (await res.json())?.places?.[0]
  if (!place?.location) return null

  const part = (type: string) =>
    place.addressComponents?.find((c: any) => c.types?.includes(type))?.longText

  return {
    lat: place.location.latitude,
    lng: place.location.longitude,
    label: place.displayName?.text ?? place.formattedAddress?.split(",")[0] ?? query,
    state: part("administrative_area_level_1"),
    country: part("country") ?? "India",
    formattedAddress: place.formattedAddress,
  }
}

/** Geocoding API fallback, used when Places is unavailable or returns nothing. */
async function viaGeocoding(query: string, apiKey: string): Promise<ResolvedPlace | null> {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(query)}` +
    "&components=country:IN&region=in" +
    `&key=${apiKey}`

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) })
  if (!res.ok) return null

  const data = await res.json()
  // Unmatchable text collapses to the country itself under the India filter, which
  // would otherwise be reported as a successful hit on the country centroid.
  const result = data.results?.find(
    (r: any) => !(r.types ?? []).some((t: string) => t === "country" || t === "political_union"),
  )

  if (!result) {
    if (data.status && data.status !== "ZERO_RESULTS") {
      console.log("[v0] geocode status:", data.status, data.error_message ?? "")
    }
    return null
  }

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    label:
      component(result, "locality") ??
      component(result, "postal_town") ??
      component(result, "administrative_area_level_3") ??
      component(result, "administrative_area_level_2") ??
      result.formatted_address?.split(",")[0] ??
      query,
    state: component(result, "administrative_area_level_1"),
    country: component(result, "country") ?? "India",
    formattedAddress: result.formatted_address,
  }
}

/**
 * Resolves any place in India — city, town, landmark or corridor — to coordinates.
 *
 * Places Text Search runs first because it survives typos and informal names;
 * Geocoding backs it up. Both are pinned to India so a bare "Tawang" lands in
 * Arunachal Pradesh rather than matching a village in Indonesia.
 */
export async function resolvePlace(query: string): Promise<ResolvedPlace | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const key = trimmed.toLowerCase()
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.log("[v0] resolvePlace: GOOGLE_MAPS_API_KEY missing")
    return null
  }

  let value: ResolvedPlace | null = null
  try {
    value = (await viaPlaces(trimmed, apiKey)) ?? (await viaGeocoding(trimmed, apiKey))
  } catch (err) {
    // A network or quota failure must not be cached as "this place doesn't exist".
    console.log("[v0] resolvePlace error:", (err as Error).message)
    return null
  }

  cache.set(key, { value, at: Date.now() })
  return value
}

/**
 * Resolves a city for trip planning. Cities already on the network skip the
 * network call and keep their canonical coordinates.
 */
export async function geocodeCity(name: string): Promise<GeocodedPlace | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const known = Object.keys(cities).find((c) => c.toLowerCase() === trimmed.toLowerCase())
  if (known) return { ...cities[known], label: known }

  return resolvePlace(trimmed)
}

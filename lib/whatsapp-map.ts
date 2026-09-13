import { geocodeCity, type GeocodedPlace } from "@/lib/geocode"
import { computeDrivingRoute } from "@/lib/route-compute"
import { sendWhatsAppImage } from "@/lib/whatsapp"

export function directionsLink(origin: string, destination: string): string {
  const url = new URL("https://www.google.com/maps/dir/")
  url.search = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" }).toString()
  return url.toString()
}

export function staticMapUrl(origin: GeocodedPlace, destination: GeocodedPlace, polyline: string, key: string): string {
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap")
  url.search = new URLSearchParams({ size: "640x480", scale: "2", maptype: "roadmap", format: "png", key }).toString()
  url.searchParams.append("markers", `color:green|label:A|${origin.lat},${origin.lng}`)
  url.searchParams.append("markers", `color:red|label:B|${destination.lat},${destination.lng}`)
  url.searchParams.append("path", `color:0x2563ebff|weight:5|enc:${polyline}`)
  // Auto-fit the endpoints and actual route. Keep Google's attribution intact.
  return url.toString()
}

// Called only after explicit consent; no image generation or upload on trip entry.
export async function sendRouteMap(to: string, origin: string, destination: string): Promise<boolean> {
  const key = process.env.GOOGLE_MAPS_STATIC_API_KEY || process.env.GOOGLE_MAPS_API_KEY
  if (!key) return false
  try {
    const [start, end] = await Promise.all([geocodeCity(origin), geocodeCity(destination)])
    if (!start || !end) return false
    const route = await computeDrivingRoute(start, end, true)
    // Never present a straight line between cities as a driving route.
    if (!route?.encodedPolyline) return false
    const url = staticMapUrl(start, end, route.encodedPolyline, key)
    if (url.length > 16384) return false
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    if (!response.ok || response.headers.has("x-staticmap-api-warning")) return false
    const image = await response.blob()
    if (image.type !== "image/png" || image.size > 5 * 1024 * 1024 || image.size === 0) return false
    const caption = [
      "Your route preview", `A: ${start.label.slice(0, 100)}`, `B: ${end.label.slice(0, 100)}`,
      `${route.distanceKm} km | ~${Math.floor(route.durationMin / 60)}h ${route.durationMin % 60}m`,
      "Driving estimate now. Check vehicle restrictions; conditions may change.",
      "Open directions in Google Maps:", directionsLink(`${start.lat},${start.lng}`, `${end.lat},${end.lng}`),
    ].join("\n")
    return await sendWhatsAppImage(to, image, caption)
  } catch {
    // Do not log fetch errors: they may contain the private Google URL/key.
    console.error("Route map generation failed")
    return false
  }
}

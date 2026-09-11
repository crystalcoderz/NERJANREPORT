import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type LatLng = { lat: number; lng: number }
type Body = { origin?: LatLng; destination?: LatLng }

type RouteResult = {
  path: LatLng[]
  distanceKm: number
  durationMin: number
  summary: string
}

export async function POST(request: Request) {
  const { origin, destination } = (await request.json().catch(() => ({}))) as Body
  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey || !origin || !destination) {
    return NextResponse.json({ error: "missing_params", routes: [] as RouteResult[] }, { status: 400 })
  }

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring,routes.description",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: true,
        polylineEncoding: "GEO_JSON_LINESTRING",
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.log("[v0] Routes API error:", res.status, detail.slice(0, 300))
      return NextResponse.json({ error: "routes_api_failed", routes: [] as RouteResult[] }, { status: 502 })
    }

    const data = await res.json()
    const routes: RouteResult[] = (data.routes ?? []).map((r: any) => {
      const coords: [number, number][] = r?.polyline?.geoJsonLinestring?.coordinates ?? []
      return {
        // GeoJSON is [lng, lat]; flip to {lat, lng}.
        path: coords.map(([lng, lat]) => ({ lat, lng })),
        distanceKm: Math.round((r?.distanceMeters ?? 0) / 1000),
        durationMin: Math.round(parseInt(String(r?.duration ?? "0").replace("s", ""), 10) / 60),
        summary: r?.description || "Alternate route",
      }
    })

    return NextResponse.json({ routes })
  } catch (err) {
    console.log("[v0] Routes API exception:", (err as Error).message)
    return NextResponse.json({ error: "exception", routes: [] as RouteResult[] }, { status: 500 })
  }
}

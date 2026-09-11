import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type LatLng = { lat: number; lng: number }
type Body = { origin?: LatLng; destination?: LatLng; waypoints?: LatLng[]; optimize?: boolean }

type RouteResult = {
  path: LatLng[]
  distanceKm: number
  durationMin: number
  summary: string
  optimizedOrder?: number[]
}

async function computeWithKey(
  apiKey: string,
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
  optimize: boolean,
) {
  const hasWaypoints = waypoints.length > 0
  const wantOptimize = hasWaypoints && optimize && waypoints.length > 1

  const fieldMask = [
    "routes.duration",
    "routes.distanceMeters",
    "routes.polyline.geoJsonLinestring",
    "routes.description",
    wantOptimize ? "routes.optimizedIntermediateWaypointIndex" : null,
  ]
    .filter(Boolean)
    .join(",")

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      ...(hasWaypoints
        ? {
            intermediates: waypoints.map((w) => ({ location: { latLng: { latitude: w.lat, longitude: w.lng } } })),
          }
        : {}),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      // Waypoint optimization and route alternatives are mutually exclusive.
      computeAlternativeRoutes: !hasWaypoints,
      optimizeWaypointOrder: wantOptimize,
      polylineEncoding: "GEO_JSON_LINESTRING",
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    return { ok: false as const, status: res.status, detail }
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
      optimizedOrder: r?.optimizedIntermediateWaypointIndex ?? undefined,
    }
  })
  return { ok: true as const, routes }
}

export async function POST(request: Request) {
  const { origin, destination, waypoints = [], optimize = false } = (await request
    .json()
    .catch(() => ({}))) as Body

  // The map key and the server key may belong to different Google Cloud
  // projects. Try every distinct key so routing works as long as ANY of them
  // has the Routes API enabled.
  const keys = [...new Set([process.env.GOOGLE_MAPS_API_KEY, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY].filter(Boolean))] as string[]

  if (keys.length === 0 || !origin || !destination) {
    return NextResponse.json({ error: "missing_params", routes: [] as RouteResult[] }, { status: 400 })
  }

  let lastDetail = ""
  let lastStatus = 502
  try {
    for (const key of keys) {
      const result = await computeWithKey(key, origin, destination, waypoints, optimize)
      if (result.ok) {
        return NextResponse.json({ routes: result.routes })
      }
      lastStatus = result.status
      lastDetail = result.detail
      console.log("[v0] Routes API error:", result.status, result.detail.slice(0, 300))
    }
    return NextResponse.json(
      { error: "routes_api_failed", detail: lastDetail.slice(0, 300), routes: [] as RouteResult[] },
      { status: lastStatus },
    )
  } catch (err) {
    console.log("[v0] Routes API exception:", (err as Error).message)
    return NextResponse.json({ error: "exception", routes: [] as RouteResult[] }, { status: 500 })
  }
}

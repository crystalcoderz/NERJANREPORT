type LatLng = { lat: number; lng: number }

// Same Google Routes API call used by /api/route, trimmed to just distance and
// duration for the WhatsApp bot's quick trip confirmation.
export async function computeDrivingRoute(origin: LatLng, destination: LatLng, includePolyline = false) {
  const keys = [...new Set([process.env.GOOGLE_MAPS_API_KEY, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY].filter(Boolean))] as string[]

  for (const apiKey of keys) {
    try {
      const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": `routes.duration,routes.distanceMeters${includePolyline ? ",routes.polyline.encodedPolyline" : ""}`,
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          ...(includePolyline ? { polylineQuality: "OVERVIEW", polylineEncoding: "ENCODED_POLYLINE" } : {}),
        }),
      })
      if (!res.ok) {
        console.log("computeDrivingRoute error:", res.status, (await res.text()).slice(0, 200))
        continue
      }
      const data = await res.json()
      const route = data.routes?.[0]
      if (!route) continue
      return {
        encodedPolyline: route.polyline?.encodedPolyline as string | undefined,
        distanceKm: Math.round((route.distanceMeters ?? 0) / 1000),
        durationMin: Math.round(Number.parseInt(String(route.duration ?? "0").replace("s", ""), 10) / 60),
      }
    } catch (err) {
      console.log("computeDrivingRoute exception:", (err as Error).message)
    }
  }
  return null
}

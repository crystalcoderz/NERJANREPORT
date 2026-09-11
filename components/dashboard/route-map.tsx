"use client"

import { useEffect, useState } from "react"
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { MapPin, Navigation, ArrowLeftRight, KeyRound } from "lucide-react"
import { activeRoutePath, incidents, recommendedRoute } from "@/lib/data"

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const incidentColors: Record<string, string> = {
  info: "#2563eb",
  moderate: "#d97706",
  high: "#dc2626",
}

function pin(color: string, glyph: "start" | "end" | "dot") {
  if (glyph === "dot") {
    return {
      path: 0, // google.maps.SymbolPath.CIRCLE
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
      scale: 7,
    } as google.maps.Symbol
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>
    <circle cx="15" cy="15" r="6" fill="#ffffff"/>
  </svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(30, 42),
    anchor: new google.maps.Point(15, 42),
  } as google.maps.Icon
}

function RouteLayer() {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const coreLib = useMapsLibrary("core")

  useEffect(() => {
    if (!map || !mapsLib || !coreLib) return

    const polyline = new mapsLib.Polyline({
      path: activeRoutePath,
      geodesic: true,
      strokeColor: "#2563eb",
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map,
    })

    const markers: google.maps.Marker[] = []

    markers.push(
      new mapsLib.Marker({
        position: recommendedRoute.origin,
        map,
        icon: pin("#16a34a", "start"),
        title: `${recommendedRoute.from} (Origin)`,
        zIndex: 10,
      }),
    )
    markers.push(
      new mapsLib.Marker({
        position: recommendedRoute.destination,
        map,
        icon: pin("#dc2626", "end"),
        title: `${recommendedRoute.to} (Destination)`,
        zIndex: 10,
      }),
    )

    const info = new mapsLib.InfoWindow()
    incidents.forEach((inc) => {
      const m = new mapsLib.Marker({
        position: inc.position,
        map,
        icon: pin(incidentColors[inc.level], "dot"),
        title: inc.title,
      })
      m.addListener("click", () => {
        info.setContent(
          `<div style="font-family:system-ui;font-size:12px;max-width:180px"><strong>${inc.title}</strong><br/>${inc.detail}</div>`,
        )
        info.open(map, m)
      })
      markers.push(m)
    })

    const bounds = new coreLib.LatLngBounds()
    activeRoutePath.forEach((p) => bounds.extend(p))
    map.fitBounds(bounds, 64)

    return () => {
      polyline.setMap(null)
      markers.forEach((m) => m.setMap(null))
      info.close()
    }
  }, [map, mapsLib, coreLib])

  return null
}

function RouteInputs() {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="pointer-events-auto flex flex-1 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
        <MapPin className="size-4 text-risk-low" />
        <span className="text-sm font-medium text-foreground">Guwahati, Assam</span>
      </div>
      <button
        type="button"
        aria-label="Swap origin and destination"
        className="pointer-events-auto hidden size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground sm:flex"
      >
        <ArrowLeftRight className="size-4" />
      </button>
      <div className="pointer-events-auto flex flex-1 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
        <MapPin className="size-4 text-risk-high" />
        <span className="text-sm font-medium text-foreground">Shillong, Meghalaya</span>
      </div>
      <button
        type="button"
        className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm hover:opacity-90"
      >
        <Navigation className="size-4" />
        Find Best Route
      </button>
    </div>
  )
}

function Legend() {
  const rows = [
    { c: "bg-risk-low", t: "Low Risk" },
    { c: "bg-risk-moderate", t: "Moderate Risk" },
    { c: "bg-risk-high", t: "High Risk" },
  ]
  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
      <p className="mb-2 text-xs font-semibold text-foreground">Route Risk Level</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.t} className="flex items-center gap-2">
            <span className={`h-1 w-5 rounded-full ${r.c}`} />
            <span className="text-xs text-muted-foreground">{r.t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MissingKey() {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-secondary to-muted p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm">
        <KeyRound className="size-6" />
      </span>
      <p className="text-sm font-semibold text-foreground">Google Maps API key needed</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Add <code className="rounded bg-card px-1 py-0.5 font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the
        live interactive map with GPS route tracking and risk overlays.
      </p>
    </div>
  )
}

export function RouteMap() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="relative min-h-[420px] w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <RouteInputs />
      {mounted && KEY ? (
        <APIProvider apiKey={KEY}>
          <Map
            defaultCenter={{ lat: 25.86, lng: 91.82 }}
            defaultZoom={9}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            className="h-full min-h-[420px] w-full"
            style={{ width: "100%", height: "100%" }}
          >
            <RouteLayer />
          </Map>
        </APIProvider>
      ) : (
        <MissingKey />
      )}
      <Legend />
    </div>
  )
}

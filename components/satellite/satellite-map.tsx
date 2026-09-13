"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { KeyRound } from "lucide-react"
import { cities, type LatLng } from "@/lib/data"
import type { Trip } from "@/app/api/trips/route"
import type { LiveIncident } from "@/app/api/incidents/route"
import type { FieldReport } from "@/app/api/field-reports/route"
import { useSatellite } from "./satellite-context"

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const routeStrokes: Record<string, string> = {
  low: "#16a34a",
  moderate: "#d97706",
  high: "#dc2626",
}

const incidentColors: Record<string, string> = {
  info: "#2563eb",
  low: "#16a34a",
  moderate: "#d97706",
  high: "#dc2626",
}

const severityColors: Record<string, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#dc2626",
}

// ---------- geometry helpers ----------

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function bearingDeg(a: LatLng, b: LatLng) {
  const phi1 = (a.lat * Math.PI) / 180
  const phi2 = (b.lat * Math.PI) / 180
  const lambda1 = (a.lng * Math.PI) / 180
  const lambda2 = (b.lng * Math.PI) / 180
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Stable 0..1 hash used to stagger each vehicle's animation phase so a fleet
// of markers doesn't move in lockstep.
function phaseFromId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return (hash % 1000) / 1000
}

// Vehicles animate continuously along their route for a live, engaging feel
// rather than crawling at real-world trip-duration speed (a multi-hour haul
// would appear to sit motionless for most of a viewing session). Each
// vehicle loops its assigned route at a staggered pace derived from its trip
// id, independent of the trip's real departure/ETA window (which still
// drives the sidebar's status and timing labels).
const ANIM_LOOP_SECONDS = 42

function animatedFraction(tripId: string) {
  const phase = phaseFromId(tripId)
  return ((Date.now() / 1000 / ANIM_LOOP_SECONDS + phase) % 1 + 1) % 1
}

function positionAlongPath(path: LatLng[], fraction: number) {
  if (path.length === 0) return { point: { lat: 0, lng: 0 }, bearing: 0 }
  if (path.length === 1) return { point: path[0], bearing: 0 }

  const segLens: number[] = []
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const d = haversineKm(path[i], path[i + 1])
    segLens.push(d)
    total += d
  }
  if (total === 0) return { point: path[0], bearing: 0 }

  let target = fraction * total
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i] || i === segLens.length - 1) {
      const t = segLens[i] === 0 ? 0 : Math.min(1, target / segLens[i])
      const a = path[i]
      const b = path[i + 1]
      const point = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }
      return { point, bearing: bearingDeg(a, b) }
    }
    target -= segLens[i]
  }
  return { point: path[path.length - 1], bearing: 0 }
}

function resolveCity(name: string): LatLng | null {
  const key = Object.keys(cities).find((c) => c.toLowerCase() === name.trim().toLowerCase())
  return key ? cities[key] : null
}

// ---------- marker icon builders ----------

function dotPin(color: string, scale = 6): google.maps.Symbol {
  return {
    path: 0, // google.maps.SymbolPath.CIRCLE
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale,
  } as google.maps.Symbol
}

function teardropPin(color: string): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 30 42">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="${color}"/>
    <circle cx="15" cy="15" r="6" fill="#ffffff"/>
  </svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(26, 36),
    anchor: new google.maps.Point(13, 36),
  } as google.maps.Icon
}

function vehiclePin(color: string, bearing: number, selected: boolean): google.maps.Icon {
  const size = selected ? 36 : 28
  const half = size / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="#ffffff" opacity="0.92"/>
    <circle cx="20" cy="20" r="18" fill="none" stroke="${color}" stroke-width="${selected ? 3 : 2}"/>
    <g transform="rotate(${bearing} 20 20)">
      <path d="M20 5 L29 27 L20 21.5 L11 27 Z" fill="${color}"/>
    </g>
  </svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(half, half),
  } as google.maps.Icon
}

function tripInfoHtml(trip: Trip) {
  const eta = new Date(trip.eta).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return `<div style="font-family:system-ui;font-size:12px;max-width:200px">
    <strong>${trip.assigned_to}</strong><br/>
    ${trip.origin} &rarr; ${trip.destination}<br/>
    ETA ${eta}
  </div>`
}

// ---------- map-context layers ----------

function FocusSync() {
  const map = useMap()
  const { focusTarget } = useSatellite()
  useEffect(() => {
    if (!map || !focusTarget) return
    map.panTo({ lat: focusTarget.lat, lng: focusTarget.lng })
    map.setZoom(focusTarget.zoom ?? 11)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusTarget?.nonce])
  return null
}

function CityLayer() {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const markerLib = useMapsLibrary("marker")
  const { requestFocus } = useSatellite()

  useEffect(() => {
    if (!map || !mapsLib || !markerLib) return
    const info = new mapsLib.InfoWindow()
    const markers = Object.entries(cities).map(([name, pos]) => {
      const m = new markerLib.Marker({ position: pos, map, icon: dotPin("#64748b", 5), title: name, zIndex: 1 })
      m.addListener("click", () => {
        requestFocus(pos.lat, pos.lng, 11)
        info.setContent(`<div style="font-family:system-ui;font-size:12px;font-weight:600">${name}</div>`)
        info.open(map, m)
      })
      return m
    })
    return () => {
      markers.forEach((m) => m.setMap(null))
      info.close()
    }
  }, [map, mapsLib, markerLib, requestFocus])

  return null
}

function IncidentLayer({ incidents }: { incidents: LiveIncident[] }) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const markerLib = useMapsLibrary("marker")

  useEffect(() => {
    if (!map || !mapsLib || !markerLib) return
    const info = new mapsLib.InfoWindow()
    const markers = incidents
      .filter((inc) => inc.lat != null && inc.lng != null)
      .map((inc) => {
        const m = new markerLib.Marker({
          position: { lat: inc.lat as number, lng: inc.lng as number },
          map,
          icon: dotPin(incidentColors[inc.level] ?? incidentColors.moderate, 8),
          zIndex: 4,
        })
        m.addListener("click", () => {
          info.setContent(
            `<div style="font-family:system-ui;font-size:12px;max-width:200px"><strong>${inc.title}</strong><br/>${inc.corridor}<br/>${inc.detail}</div>`,
          )
          info.open(map, m)
        })
        return m
      })
    return () => {
      markers.forEach((m) => m.setMap(null))
      info.close()
    }
  }, [map, mapsLib, markerLib, incidents])

  return null
}

function ReportLayer({ reports }: { reports: FieldReport[] }) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const markerLib = useMapsLibrary("marker")

  useEffect(() => {
    if (!map || !mapsLib || !markerLib) return
    const info = new mapsLib.InfoWindow()
    const markers = reports
      .filter((r) => r.status === "active" && r.lat != null && r.lng != null)
      .map((r) => {
        const m = new markerLib.Marker({
          position: { lat: r.lat as number, lng: r.lng as number },
          map,
          icon: teardropPin(severityColors[r.severity] ?? severityColors.medium),
          zIndex: 5,
        })
        m.addListener("click", () => {
          info.setContent(
            `<div style="font-family:system-ui;font-size:12px;max-width:200px"><strong>${r.location_name}</strong><br/>${r.description}<br/><em>${r.reporter_name}</em></div>`,
          )
          info.open(map, m)
        })
        return m
      })
    return () => {
      markers.forEach((m) => m.setMap(null))
      info.close()
    }
  }, [map, mapsLib, markerLib, reports])

  return null
}

function TripLayer({ trips }: { trips: Trip[] }) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const markerLib = useMapsLibrary("marker")
  const { selectedTripId, setSelectedTripId } = useSatellite()

  const pathsRef = useRef<Record<string, LatLng[]>>({})
  const [pathVersion, setPathVersion] = useState(0)

  const activeTrips = useMemo(() => trips.filter((t) => t.status !== "completed"), [trips])

  // Fetch the real road path for each trip once, falling back to a straight line.
  useEffect(() => {
    let cancelled = false
    async function run() {
      for (const trip of activeTrips) {
        if (pathsRef.current[trip.id]) continue
        const o = resolveCity(trip.origin)
        const d = resolveCity(trip.destination)
        if (!o || !d) continue
        let path: LatLng[] = [o, d]
        try {
          const res = await fetch("/api/route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ origin: o, destination: d, waypoints: [] }),
          })
          const json = await res.json()
          const fetched = json.routes?.[0]?.path as LatLng[] | undefined
          if (fetched && fetched.length > 1) path = fetched
        } catch {
          // Keep straight-line fallback.
        }
        pathsRef.current[trip.id] = path
        if (!cancelled) setPathVersion((v) => v + 1)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [activeTrips])

  useEffect(() => {
    if (!map || !mapsLib || !markerLib) return

    const overlays: google.maps.Polyline[] = []
    const markers: google.maps.Marker[] = []
    const vehicleMarkers: { marker: google.maps.Marker; trip: Trip; path: LatLng[] }[] = []
    const info = new mapsLib.InfoWindow()

    activeTrips.forEach((trip) => {
      const o = resolveCity(trip.origin)
      const d = resolveCity(trip.destination)
      if (!o || !d) return
      const path = pathsRef.current[trip.id] ?? [o, d]
      const isSelected = trip.id === selectedTripId
      const stroke = routeStrokes[trip.risk_level] ?? routeStrokes.moderate

      const line = new mapsLib.Polyline({
        path,
        map,
        geodesic: true,
        strokeColor: stroke,
        strokeOpacity: isSelected ? 0.95 : 0.5,
        strokeWeight: isSelected ? 5 : 3,
        zIndex: isSelected ? 6 : 2,
      })
      line.addListener("click", () => setSelectedTripId(trip.id))
      overlays.push(line)

      markers.push(
        new markerLib.Marker({ position: o, map, icon: dotPin("#0f172a", 4), title: trip.origin, zIndex: 3 }),
      )
      markers.push(
        new markerLib.Marker({ position: d, map, icon: dotPin("#0f172a", 4), title: trip.destination, zIndex: 3 }),
      )

      const initial = positionAlongPath(path, animatedFraction(trip.id))

      const vm = new markerLib.Marker({
        position: initial.point,
        map,
        icon: vehiclePin(stroke, initial.bearing, isSelected),
        zIndex: 10,
        title: `${trip.assigned_to} · ${trip.origin} to ${trip.destination}`,
      })
      vm.addListener("click", () => {
        setSelectedTripId(trip.id)
        info.setContent(tripInfoHtml(trip))
        info.open(map, vm)
      })
      vehicleMarkers.push({ marker: vm, trip, path })
      markers.push(vm)
    })

    const tick = () => {
      vehicleMarkers.forEach(({ marker, trip, path }) => {
        const { point, bearing } = positionAlongPath(path, animatedFraction(trip.id))
        marker.setPosition(point)
        marker.setIcon(vehiclePin(routeStrokes[trip.risk_level] ?? routeStrokes.moderate, bearing, trip.id === selectedTripId))
      })
    }
    const interval = setInterval(tick, 350)

    return () => {
      clearInterval(interval)
      overlays.forEach((o) => o.setMap(null))
      markers.forEach((m) => m.setMap(null))
      info.close()
    }
  }, [map, mapsLib, markerLib, activeTrips, pathVersion, selectedTripId, setSelectedTripId])

  return null
}

// ---------- fallback / wrapper ----------

function MissingKey() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-secondary to-muted p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm">
        <KeyRound className="size-7" />
      </span>
      <p className="text-sm font-semibold text-foreground">Google Maps API key needed</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Add <code className="rounded bg-card px-1 py-0.5 font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the
        satellite command center.
      </p>
    </div>
  )
}

export function SatelliteMap() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { layer } = useSatellite()

  const { data: tripsData } = useSWR<{ trips: Trip[] }>("/api/trips", fetcher, { refreshInterval: 10000 })
  const { data: incidentsData } = useSWR<{ source: string; incidents: LiveIncident[] }>("/api/incidents", fetcher, {
    refreshInterval: 30000,
  })
  const { data: reportsData } = useSWR<{ reports: FieldReport[] }>("/api/field-reports", fetcher, {
    refreshInterval: 15000,
  })

  if (!mounted) return <div className="h-full w-full animate-pulse bg-muted" />
  if (!KEY) return <MissingKey />

  return (
    <APIProvider apiKey={KEY}>
      <Map
        defaultCenter={{ lat: 25.6, lng: 92.8 }}
        defaultZoom={7}
        mapTypeId={layer}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
      >
        <FocusSync />
        <CityLayer />
        <TripLayer trips={tripsData?.trips ?? []} />
        <IncidentLayer incidents={incidentsData?.incidents ?? []} />
        <ReportLayer reports={reportsData?.reports ?? []} />
      </Map>
    </APIProvider>
  )
}

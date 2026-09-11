"use client"

import { useEffect, useRef, useState } from "react"
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { MapPin, Navigation, ArrowLeftRight, KeyRound, Loader2, Waypoints, X } from "lucide-react"
import { cities, incidents, type LatLng } from "@/lib/data"
import { deriveRisk, estimateRoute, formatEta, riskRank, useRoute, type RouteOption } from "./route-context"

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const cityNames = Object.keys(cities)

const incidentColors: Record<string, string> = {
  info: "#2563eb",
  moderate: "#d97706",
  high: "#dc2626",
}

const routeStrokes: Record<string, string> = {
  low: "#16a34a",
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
  const markerLib = useMapsLibrary("marker")

  const {
    origin,
    destination,
    requestId,
    routes,
    setRoutes,
    selectedIndex,
    setSelectedIndex,
    setStatus,
    setErrorMessage,
    setEstimated,
    waypoints,
    setOptimizedOrder,
  } = useRoute()

  // Keep the latest origin/destination without forcing a recompute on every
  // dropdown change — recompute only when the user presses "Find Best Route".
  const originRef = useRef(origin)
  const destRef = useRef(destination)
  const waypointsRef = useRef(waypoints)
  originRef.current = origin
  destRef.current = destination
  waypointsRef.current = waypoints

  // Compute routes via the Routes API (initial load + each Find request).
  useEffect(() => {
    let cancelled = false

    const o = cities[originRef.current]
    const d = cities[destRef.current]
    if (!o || !d || originRef.current === destRef.current) {
      setRoutes([])
      setStatus("error")
      setErrorMessage("Choose two different cities.")
      return
    }

    const stopNames = waypointsRef.current.filter((w) => w !== originRef.current && w !== destRef.current)
    const stops = stopNames.map((name) => cities[name])

    setOptimizedOrder(null)
    setStatus("computing")
    fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: o, destination: d, waypoints: stops, optimize: stops.length > 1 }),
    })
      .then((res) => res.json())
      .then(
        (json: {
          routes?: { path: LatLng[]; distanceKm: number; durationMin: number; summary: string; optimizedOrder?: number[] }[]
        }) => {
          if (cancelled) return
          const raw = json.routes ?? []
          if (raw.length === 0) {
            // Routes API unavailable — fall back to a geodesic estimate.
            setRoutes([estimateRoute(originRef.current, destRef.current)])
            setSelectedIndex(0)
            setEstimated(true)
            setErrorMessage(null)
            setStatus("done")
            return
          }
          const opts: RouteOption[] = raw.map((r) => ({
            path: r.path,
            distanceKm: r.distanceKm,
            durationMin: r.durationMin,
            etaLabel: formatEta(r.durationMin),
            risk: deriveRisk(r.distanceKm, r.durationMin),
            summary: r.summary,
          }))
          // Best route first: lowest risk, then fastest.
          opts.sort((a, b) => riskRank[a.risk] - riskRank[b.risk] || a.durationMin - b.durationMin)
          setRoutes(opts)
          setSelectedIndex(0)
          setEstimated(false)
          setOptimizedOrder(raw[0]?.optimizedOrder ?? null)
          setStatus("done")
        },
      )
      .catch(() => {
        if (cancelled) return
        setRoutes([estimateRoute(originRef.current, destRef.current)])
        setSelectedIndex(0)
        setEstimated(true)
        setErrorMessage(null)
        setStatus("done")
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  // Draw the selected route, alternatives, markers and incident overlays.
  useEffect(() => {
    if (!map || !mapsLib || !markerLib || !coreLib || routes.length === 0) return

    const overlays: google.maps.Polyline[] = []
    routes.forEach((r, i) => {
      const isSel = i === selectedIndex
      const line = new mapsLib.Polyline({
        path: r.path,
        map,
        geodesic: true,
        strokeColor: isSel ? routeStrokes[r.risk] : "#94a3b8",
        strokeOpacity: isSel ? 0.95 : 0.55,
        strokeWeight: isSel ? 5 : 4,
        zIndex: isSel ? 5 : 1,
      })
      if (!isSel) line.addListener("click", () => setSelectedIndex(i))
      overlays.push(line)
    })

    const sel = routes[selectedIndex]
    const markers: google.maps.Marker[] = []
    markers.push(
      new markerLib.Marker({
        position: sel.path[0],
        map,
        icon: pin("#16a34a", "start"),
        title: `${originRef.current} (Origin)`,
        zIndex: 10,
      }),
    )
    markers.push(
      new markerLib.Marker({
        position: sel.path[sel.path.length - 1],
        map,
        icon: pin("#dc2626", "end"),
        title: `${destRef.current} (Destination)`,
        zIndex: 10,
      }),
    )

    const stopNames = waypointsRef.current.filter((w) => w !== originRef.current && w !== destRef.current)
    stopNames.forEach((name, idx) => {
      const pos = cities[name]
      if (!pos) return
      markers.push(
        new markerLib.Marker({
          position: pos,
          map,
          icon: pin("#7c3aed", "dot"),
          label: { text: String(idx + 1), color: "#ffffff", fontSize: "11px", fontWeight: "700" },
          title: `Stop ${idx + 1}: ${name}`,
          zIndex: 9,
        }),
      )
    })

    const info = new mapsLib.InfoWindow()
    const showIncidents = originRef.current === "Guwahati" && destRef.current === "Shillong"
    if (showIncidents) {
      incidents.forEach((inc) => {
        const m = new markerLib.Marker({
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
    }

    const bounds = new coreLib.LatLngBounds()
    sel.path.forEach((p: LatLng) => bounds.extend(p))
    map.fitBounds(bounds, 60)

    return () => {
      overlays.forEach((o) => o.setMap(null))
      markers.forEach((m) => m.setMap(null))
      info.close()
    }
  }, [map, mapsLib, markerLib, coreLib, routes, selectedIndex, setSelectedIndex])

  return null
}

function RouteInputs() {
  const {
    origin,
    destination,
    setOrigin,
    setDestination,
    swap,
    findRoute,
    status,
    errorMessage,
    estimated,
    waypoints,
    addWaypoint,
    removeWaypoint,
    optimizedOrder,
  } = useRoute()
  const computing = status === "computing"
  const stopChoices = cityNames.filter((c) => c !== origin && c !== destination && !waypoints.includes(c))
  const activeStops = waypoints.filter((w) => w !== origin && w !== destination)

  const optimizedStopOrder =
    optimizedOrder && optimizedOrder.length === activeStops.length
      ? optimizedOrder.map((i) => activeStops[i])
      : null

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="pointer-events-auto flex flex-1 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
          <MapPin className="size-4 shrink-0 text-risk-low" />
          <span className="sr-only">Origin</span>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full cursor-pointer bg-transparent text-sm font-medium text-foreground outline-none"
          >
            {cityNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={swap}
          aria-label="Swap origin and destination"
          className="pointer-events-auto hidden size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground sm:flex"
        >
          <ArrowLeftRight className="size-4" />
        </button>

        <label className="pointer-events-auto flex flex-1 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
          <MapPin className="size-4 shrink-0 text-risk-high" />
          <span className="sr-only">Destination</span>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full cursor-pointer bg-transparent text-sm font-medium text-foreground outline-none"
          >
            {cityNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={findRoute}
          disabled={computing}
          className="pointer-events-auto flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {computing ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          {computing ? "Finding..." : activeStops.length > 1 ? "Optimize Route" : "Find Best Route"}
        </button>
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Waypoints className="size-3.5" /> Stops:
        </span>
        {activeStops.length === 0 && <span className="text-xs text-muted-foreground">None — add multi-stop cities to optimize order</span>}
        {activeStops.map((c, i) => (
          <span
            key={c}
            className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {i + 1}. {c}
            <button type="button" onClick={() => removeWaypoint(c)} aria-label={`Remove ${c}`} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        ))}
        {stopChoices.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && addWaypoint(e.target.value)}
            className="cursor-pointer rounded-md border border-dashed border-border bg-transparent px-1.5 py-0.5 text-xs font-medium text-muted-foreground outline-none"
          >
            <option value="">+ Add stop</option>
            {stopChoices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {errorMessage && (
        <p className="pointer-events-auto w-fit rounded-md bg-risk-high-bg px-2.5 py-1 text-xs font-medium text-risk-high">
          {errorMessage}
        </p>
      )}
      {!errorMessage && estimated && status === "done" && (
        <p className="pointer-events-auto w-fit rounded-md bg-risk-moderate-bg px-2.5 py-1 text-xs font-medium text-risk-moderate">
          Estimated path — enable the Google Routes API for live turn-by-turn routing.
        </p>
      )}
      {!errorMessage && optimizedStopOrder && status === "done" && (
        <p className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-md bg-info-bg px-2.5 py-1 text-xs font-medium text-info">
          <Waypoints className="size-3.5 shrink-0" />
          Optimized stop order: {origin} → {optimizedStopOrder.join(" → ")} → {destination}
        </p>
      )}
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

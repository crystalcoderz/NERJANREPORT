"use client"

import { useEffect, useRef, useState } from "react"
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps"
import { KeyRound } from "lucide-react"
import { darkMapStyle, riskHex } from "@/lib/map-style"
import type { CityRisk } from "@/app/api/network-risk/route"
import { useNetwork } from "./network-context"

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Whole-of-India framing: Kanyakumari to Kashmir, Kutch to Kibithu.
const INDIA_CENTER = { lat: 22.2, lng: 82.5 }
const INDIA_ZOOM = 5
const INDIA_BOUNDS = { south: 8.2, west: 69, north: 34.8, east: 96.5 }

/** Marker grows with risk so the worst nodes read first at national zoom. */
function riskMarker(city: CityRisk, selected: boolean): google.maps.Icon {
  const color = riskHex[city.level] ?? riskHex.low
  const base = 9 + (city.score / 100) * 13
  const r = selected ? base + 3 : base
  const box = Math.ceil(r * 2 + 10)
  const c = box / 2
  const halo = city.level === "severe" || city.level === "high"

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
    ${halo ? `<circle cx="${c}" cy="${c}" r="${r + 4}" fill="${color}" opacity="0.16"/>` : ""}
    <circle cx="${c}" cy="${c}" r="${r}" fill="${color}" opacity="0.34"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${selected ? 2.5 : 1.5}"/>
    <circle cx="${c}" cy="${c}" r="${Math.max(2.5, r * 0.3)}" fill="${color}"/>
    ${selected ? `<circle cx="${c}" cy="${c}" r="${r + 5}" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.8"/>` : ""}
  </svg>`

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(box, box),
    anchor: new google.maps.Point(c, c),
  } as google.maps.Icon
}

function infoHtml(city: CityRisk) {
  const top = city.factors
    .slice(0, 3)
    .map((f) => `<div style="display:flex;justify-content:space-between;gap:10px"><span>${f.label}</span><strong>+${f.points}</strong></div>`)
    .join("")
  return `<div style="font-family:system-ui;font-size:12px;min-width:190px;color:#111">
    <div style="font-weight:700;font-size:13px">${city.name}, ${city.state}</div>
    <div style="color:#555;margin-bottom:6px">${city.zone} zone · risk ${city.score}/100 (${city.level})</div>
    <div style="display:grid;gap:2px;margin-bottom:6px">
      <span>${city.weather.condition}${city.weather.temperatureC != null ? ` · ${Math.round(city.weather.temperatureC)}°C` : ""}</span>
      ${city.weather.windKph != null ? `<span>Wind ${Math.round(city.weather.windKph)} km/h</span>` : ""}
    </div>
    ${top ? `<div style="border-top:1px solid #ddd;padding-top:5px;display:grid;gap:2px">${top}</div>` : `<div style="color:#555">No active hazards</div>`}
  </div>`
}

/** Frame the whole country once on load so no zone is cut off at any viewport. */
function FitIndia() {
  const map = useMap()
  const coreLib = useMapsLibrary("core")
  const done = useRef(false)

  useEffect(() => {
    if (!map || !coreLib || done.current) return
    done.current = true
    map.fitBounds(new coreLib.LatLngBounds(
      { lat: INDIA_BOUNDS.south, lng: INDIA_BOUNDS.west },
      { lat: INDIA_BOUNDS.north, lng: INDIA_BOUNDS.east },
    ), 12)
  }, [map, coreLib])

  return null
}

function FocusSync() {
  const map = useMap()
  const { focusTarget } = useNetwork()
  useEffect(() => {
    if (!map || !focusTarget) return
    map.panTo({ lat: focusTarget.lat, lng: focusTarget.lng })
    map.setZoom(focusTarget.zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusTarget?.nonce])
  return null
}

/** Soft risk catchment discs — the national "where is it bad" read at a glance. */
function CatchmentLayer({ cities }: { cities: CityRisk[] }) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const { showCatchments } = useNetwork()

  useEffect(() => {
    if (!map || !mapsLib || !showCatchments) return
    const circles = cities
      .filter((c) => c.score > 0)
      .map((c) =>
        new mapsLib.Circle({
          map,
          center: c.coords,
          radius: 40000 + (c.score / 100) * 110000,
          strokeColor: riskHex[c.level],
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillColor: riskHex[c.level],
          fillOpacity: 0.1,
          clickable: false,
          zIndex: 1,
        }),
      )
    return () => circles.forEach((c) => c.setMap(null))
  }, [map, mapsLib, cities, showCatchments])

  return null
}

function CityLayer({ cities }: { cities: CityRisk[] }) {
  const map = useMap()
  const mapsLib = useMapsLibrary("maps")
  const markerLib = useMapsLibrary("marker")
  const { selected, focusCity } = useNetwork()

  useEffect(() => {
    if (!map || !mapsLib || !markerLib) return
    const info = new mapsLib.InfoWindow()

    const markers = cities.map((city) => {
      const isSel = city.name === selected
      const m = new markerLib.Marker({
        position: city.coords,
        map,
        icon: riskMarker(city, isSel),
        title: `${city.name}, ${city.state} — risk ${city.score}/100`,
        zIndex: isSel ? 50 : 10 + Math.round(city.score / 5),
      })
      m.addListener("click", () => {
        focusCity(city)
        info.setContent(infoHtml(city))
        info.open(map, m)
      })
      return m
    })

    return () => {
      markers.forEach((m) => m.setMap(null))
      info.close()
    }
  }, [map, mapsLib, markerLib, cities, selected, focusCity])

  return null
}

function MissingKey() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-card text-muted-foreground">
        <KeyRound className="size-7" />
      </span>
      <p className="text-sm font-semibold text-foreground">Google Maps API key needed</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Add <code className="rounded bg-card px-1 py-0.5 font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to render the
        national risk map.
      </p>
    </div>
  )
}

export function NetworkMap() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { filtered } = useNetwork()

  if (!mounted) return <div className="h-full w-full animate-pulse bg-muted" />
  if (!KEY) return <MissingKey />

  return (
    <APIProvider apiKey={KEY}>
      <Map
        defaultCenter={INDIA_CENTER}
        defaultZoom={INDIA_ZOOM}
        minZoom={4}
        isFractionalZoomEnabled
        mapTypeId="roadmap"
        styles={darkMapStyle}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
      >
        <FitIndia />
        <FocusSync />
        <CatchmentLayer cities={filtered} />
        <CityLayer cities={filtered} />
      </Map>
    </APIProvider>
  )
}

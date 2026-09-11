"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { activeRoutePath, cities, type LatLng, type RiskLevel } from "@/lib/data"

export type RouteOption = {
  path: LatLng[]
  distanceKm: number
  durationMin: number
  etaLabel: string
  risk: RiskLevel
  summary: string
}

export type RouteStatus = "idle" | "computing" | "done" | "error"

type RouteContextValue = {
  origin: string
  destination: string
  setOrigin: (c: string) => void
  setDestination: (c: string) => void
  swap: () => void
  findRoute: () => void
  requestId: number
  status: RouteStatus
  setStatus: (s: RouteStatus) => void
  errorMessage: string | null
  setErrorMessage: (m: string | null) => void
  routes: RouteOption[]
  setRoutes: (r: RouteOption[]) => void
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  estimated: boolean
  setEstimated: (v: boolean) => void
  waypoints: string[]
  addWaypoint: (c: string) => void
  removeWaypoint: (c: string) => void
  optimizedOrder: number[] | null
  setOptimizedOrder: (o: number[] | null) => void
}

const RouteContext = createContext<RouteContextValue | null>(null)

export function formatEta(min: number) {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h} hr ${m} min` : `${m} min`
}

export function deriveRisk(distanceKm: number, durationMin: number): RiskLevel {
  // Minutes per km — a proxy for terrain difficulty on NER hill roads.
  const ratio = durationMin / Math.max(distanceKm, 1)
  if (ratio >= 2) return "high"
  if (ratio >= 1.4) return "moderate"
  return "low"
}

export const riskRank: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 }

// Great-circle distance in km.
function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Fallback used when the Routes API is unavailable (e.g. not enabled yet).
// Approximates a road path so the map still renders a meaningful corridor.
export function estimateRoute(originName: string, destName: string): RouteOption {
  const o = cities[originName]
  const d = cities[destName]
  const isDefaultCorridor = originName === "Guwahati" && destName === "Shillong"
  const straightKm = haversineKm(o, d)
  const distanceKm = isDefaultCorridor ? 100 : Math.round(straightKm * 1.35) // road winding factor
  const durationMin = Math.round((distanceKm / 34) * 60) // ~34 km/h avg on NER hill roads
  return {
    path: isDefaultCorridor ? activeRoutePath : [o, d],
    distanceKm,
    durationMin,
    etaLabel: formatEta(durationMin),
    risk: deriveRisk(distanceKm, durationMin),
    summary: "Estimated corridor",
  }
}

export function RouteProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState("Guwahati")
  const [destination, setDestination] = useState("Shillong")
  const [requestId, setRequestId] = useState(0)
  const [status, setStatus] = useState<RouteStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [estimated, setEstimated] = useState(false)
  const [waypoints, setWaypoints] = useState<string[]>([])
  const [optimizedOrder, setOptimizedOrder] = useState<number[] | null>(null)

  const swap = useCallback(() => {
    setOrigin((prevOrigin) => {
      setDestination(prevOrigin)
      return destination
    })
  }, [destination])

  const addWaypoint = useCallback((c: string) => {
    setWaypoints((prev) => (prev.includes(c) ? prev : [...prev, c]))
  }, [])

  const removeWaypoint = useCallback((c: string) => {
    setWaypoints((prev) => prev.filter((w) => w !== c))
  }, [])

  const findRoute = useCallback(() => {
    setErrorMessage(null)
    setStatus("computing")
    setRequestId((n) => n + 1)
  }, [])

  const value = useMemo<RouteContextValue>(
    () => ({
      origin,
      destination,
      setOrigin,
      setDestination,
      swap,
      findRoute,
      requestId,
      status,
      setStatus,
      errorMessage,
      setErrorMessage,
      routes,
      setRoutes,
      selectedIndex,
      setSelectedIndex,
      estimated,
      setEstimated,
      waypoints,
      addWaypoint,
      removeWaypoint,
      optimizedOrder,
      setOptimizedOrder,
    }),
    [
      origin,
      destination,
      swap,
      findRoute,
      requestId,
      status,
      errorMessage,
      routes,
      selectedIndex,
      estimated,
      waypoints,
      addWaypoint,
      removeWaypoint,
      optimizedOrder,
    ],
  )

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>
}

export function useRoute() {
  const ctx = useContext(RouteContext)
  if (!ctx) throw new Error("useRoute must be used within a RouteProvider")
  return ctx
}

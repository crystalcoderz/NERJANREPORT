"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

export type MapLayer = "hybrid" | "satellite" | "roadmap" | "terrain"

export type FocusTarget = { lat: number; lng: number; zoom?: number; nonce: number }

type SatelliteContextValue = {
  layer: MapLayer
  setLayer: (layer: MapLayer) => void
  focusTarget: FocusTarget | null
  requestFocus: (lat: number, lng: number, zoom?: number) => void
  selectedTripId: string | null
  setSelectedTripId: (id: string | null) => void
}

const SatelliteContext = createContext<SatelliteContextValue | null>(null)

export function SatelliteProvider({ children }: { children: ReactNode }) {
  const [layer, setLayer] = useState<MapLayer>("hybrid")
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

  const requestFocus = useCallback((lat: number, lng: number, zoom?: number) => {
    setFocusTarget({ lat, lng, zoom, nonce: Date.now() })
  }, [])

  const value = useMemo<SatelliteContextValue>(
    () => ({ layer, setLayer, focusTarget, requestFocus, selectedTripId, setSelectedTripId }),
    [layer, focusTarget, requestFocus, selectedTripId],
  )

  return <SatelliteContext.Provider value={value}>{children}</SatelliteContext.Provider>
}

export function useSatellite() {
  const ctx = useContext(SatelliteContext)
  if (!ctx) throw new Error("useSatellite must be used within a SatelliteProvider")
  return ctx
}

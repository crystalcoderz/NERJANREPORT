"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import useSWR from "swr"
import type { CityRisk, RiskLevelName } from "@/app/api/network-risk/route"
import { zones, type Zone } from "@/lib/india-cities"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export type SortMode = "risk" | "name" | "population"

type FocusTarget = { lat: number; lng: number; zoom: number; nonce: number }

type NetworkValue = {
  cities: CityRisk[]
  filtered: CityRisk[]
  isLoading: boolean
  failed: boolean
  updatedAt: string | null

  selected: string | null
  setSelected: (name: string | null) => void
  selectedCity: CityRisk | null

  query: string
  setQuery: (q: string) => void
  activeZones: Zone[]
  toggleZone: (z: Zone) => void
  clearZones: () => void
  activeLevels: RiskLevelName[]
  toggleLevel: (l: RiskLevelName) => void
  sort: SortMode
  setSort: (s: SortMode) => void
  showCatchments: boolean
  setShowCatchments: (v: boolean) => void

  focusTarget: FocusTarget | null
  focusCity: (city: CityRisk) => void
}

const Ctx = createContext<NetworkValue | null>(null)

const levelRank: Record<RiskLevelName, number> = { severe: 0, high: 1, moderate: 2, low: 3 }

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSWR<{ ok: boolean; updatedAt: string; cities: CityRisk[] }>(
    "/api/network-risk",
    fetcher,
    { refreshInterval: 300000, revalidateOnFocus: false },
  )

  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [activeZones, setActiveZones] = useState<Zone[]>([])
  const [activeLevels, setActiveLevels] = useState<RiskLevelName[]>([])
  const [sort, setSort] = useState<SortMode>("risk")
  const [showCatchments, setShowCatchments] = useState(true)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)

  const cities = useMemo(() => data?.cities ?? [], [data])

  const toggleZone = useCallback((z: Zone) => {
    setActiveZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]))
  }, [])

  const clearZones = useCallback(() => {
    setActiveZones([])
    setActiveLevels([])
    setQuery("")
  }, [])

  const toggleLevel = useCallback((l: RiskLevelName) => {
    setActiveLevels((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]))
  }, [])

  const focusCity = useCallback((city: CityRisk) => {
    setSelected(city.name)
    setFocusTarget({ lat: city.coords.lat, lng: city.coords.lng, zoom: 8, nonce: Date.now() })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = cities.filter((c) => {
      if (activeZones.length && !activeZones.includes(c.zone)) return false
      if (activeLevels.length && !activeLevels.includes(c.level)) return false
      if (q && !`${c.name} ${c.state} ${c.zone}`.toLowerCase().includes(q)) return false
      return true
    })
    const sorted = [...list]
    if (sort === "risk") {
      sorted.sort((a, b) => levelRank[a.level] - levelRank[b.level] || b.score - a.score || a.name.localeCompare(b.name))
    } else if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      sorted.sort((a, b) => b.population - a.population)
    }
    return sorted
  }, [cities, activeZones, activeLevels, query, sort])

  const selectedCity = useMemo(() => cities.find((c) => c.name === selected) ?? null, [cities, selected])

  const value: NetworkValue = {
    cities,
    filtered,
    isLoading,
    failed: Boolean(data && data.ok === false),
    updatedAt: data?.updatedAt ?? null,
    selected,
    setSelected,
    selectedCity,
    query,
    setQuery,
    activeZones,
    toggleZone,
    clearZones,
    activeLevels,
    toggleLevel,
    sort,
    setSort,
    showCatchments,
    setShowCatchments,
    focusTarget,
    focusCity,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNetwork() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useNetwork must be used inside NetworkProvider")
  return ctx
}

export { zones }
export type { Zone }

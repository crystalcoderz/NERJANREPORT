"use client"

import useSWR from "swr"

const GENERATE_INTERVAL_MS = 4 * 60 * 1000

const generateFetcher = (url: string) => fetch(url, { method: "POST" }).then((r) => r.json())

/**
 * Invisible background worker: periodically asks Gemini (falling back to Kimi)
 * to re-analyze live weather + field-report signals and refresh the incidents
 * table. Other panels poll GET /api/incidents on a shorter interval and pick
 * up whatever this writes.
 */
export function IncidentMonitor() {
  useSWR("/api/incidents/generate", generateFetcher, {
    refreshInterval: GENERATE_INTERVAL_MS,
    revalidateOnFocus: false,
    revalidateOnMount: true,
    dedupingInterval: 60000,
  })

  return null
}

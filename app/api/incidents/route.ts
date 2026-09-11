import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { incidents as mockIncidents, recommendedRoute } from "@/lib/data"

export const dynamic = "force-dynamic"

export type LiveIncident = {
  id: string
  corridor: string
  title: string
  detail: string
  level: "info" | "low" | "moderate" | "high"
  lat: number | null
  lng: number | null
  source: "ai" | "mock"
  model: string | null
  created_at: string
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) {
    console.log("[v0] incidents GET error:", error.message)
    return NextResponse.json({ source: "mock", incidents: mockIncidents })
  }

  if (!data || data.length === 0) {
    const fallbackCorridor = `${recommendedRoute.from} to ${recommendedRoute.to}`
    const fallback: LiveIncident[] = mockIncidents.map((inc) => ({
      id: inc.id,
      corridor: fallbackCorridor,
      title: inc.title,
      detail: inc.detail,
      level: inc.level,
      lat: inc.position.lat,
      lng: inc.position.lng,
      source: "mock",
      model: null,
      created_at: new Date().toISOString(),
    }))
    return NextResponse.json({ source: "mock", incidents: fallback })
  }

  return NextResponse.json({ source: "ai", incidents: data satisfies LiveIncident[] })
}

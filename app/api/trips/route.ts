import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export type Trip = {
  id: string
  origin: string
  destination: string
  waypoints: string[]
  assigned_to: string
  distance_km: number
  duration_min: number
  risk_level: "low" | "moderate" | "high"
  departure_time: string
  eta: string
  status: "scheduled" | "in_transit" | "delayed" | "completed"
  notes: string | null
  matched_report_count: number
  created_at: string
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("departure_time", { ascending: false })
    .limit(50)

  if (error) {
    console.log("trips GET error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ trips: data satisfies Trip[] })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const {
    origin,
    destination,
    waypoints,
    assigned_to,
    distance_km,
    duration_min,
    risk_level,
    departure_time,
    notes,
  } = body as Record<string, unknown>

  if (typeof origin !== "string" || origin.trim().length === 0) {
    return NextResponse.json({ error: "Origin is required" }, { status: 400 })
  }
  if (typeof destination !== "string" || destination.trim().length === 0) {
    return NextResponse.json({ error: "Destination is required" }, { status: 400 })
  }
  if (typeof assigned_to !== "string" || assigned_to.trim().length === 0) {
    return NextResponse.json({ error: "Assigned driver is required" }, { status: 400 })
  }
  if (typeof distance_km !== "number" || typeof duration_min !== "number") {
    return NextResponse.json({ error: "Distance and duration must be numbers" }, { status: 400 })
  }
  if (typeof risk_level !== "string" || !["low", "moderate", "high"].includes(risk_level)) {
    return NextResponse.json({ error: "Invalid risk level" }, { status: 400 })
  }
  if (typeof departure_time !== "string" || Number.isNaN(Date.parse(departure_time))) {
    return NextResponse.json({ error: "Invalid departure time" }, { status: 400 })
  }

  const departure = new Date(departure_time)
  const eta = new Date(departure.getTime() + duration_min * 60_000)
  const waypointList = Array.isArray(waypoints) ? waypoints.filter((w): w is string => typeof w === "string") : []

  const supabase = await createClient()

  // Check active field reports along this corridor so the trip carries a live risk snapshot.
  const stops = [origin, ...waypointList, destination]
  const { data: reports } = await supabase
    .from("field_reports")
    .select("id, location_name, corridor, severity, status")
    .eq("status", "active")

  const matchedReports = (reports ?? []).filter((r) => {
    const haystack = `${r.location_name} ${r.corridor ?? ""}`.toLowerCase()
    return stops.some((stop) => haystack.includes(stop.toLowerCase()))
  })

  const { data, error } = await supabase
    .from("trips")
    .insert({
      origin: origin.trim(),
      destination: destination.trim(),
      waypoints: waypointList,
      assigned_to: assigned_to.trim(),
      distance_km,
      duration_min,
      risk_level,
      departure_time: departure.toISOString(),
      eta: eta.toISOString(),
      notes: typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null,
      matched_report_count: matchedReports.length,
    })
    .select("*")
    .single()

  if (error) {
    console.log("trips POST error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ trip: data satisfies Trip, matchedReports }, { status: 201 })
}

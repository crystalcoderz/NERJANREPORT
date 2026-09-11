import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const REPORT_TYPES = ["road_block", "accident", "flooding", "landslide", "checkpoint", "breakdown", "other"] as const
export const SEVERITIES = ["low", "medium", "high"] as const

export type FieldReport = {
  id: string
  report_type: (typeof REPORT_TYPES)[number]
  severity: (typeof SEVERITIES)[number]
  location_name: string
  lat: number | null
  lng: number | null
  corridor: string | null
  description: string
  reporter_name: string
  status: "active" | "resolved"
  created_at: string
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("field_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.log("[v0] field-reports GET error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reports: data satisfies FieldReport[] })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { report_type, severity, location_name, description, corridor, reporter_name, lat, lng } = body as Record<string, unknown>

  if (typeof location_name !== "string" || location_name.trim().length === 0) {
    return NextResponse.json({ error: "Location is required" }, { status: 400 })
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 })
  }
  if (typeof report_type !== "string" || !REPORT_TYPES.includes(report_type as (typeof REPORT_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 })
  }
  if (typeof severity !== "string" || !SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("field_reports")
    .insert({
      report_type,
      severity,
      location_name: location_name.trim(),
      description: description.trim(),
      corridor: typeof corridor === "string" && corridor.trim().length > 0 ? corridor.trim() : null,
      reporter_name: typeof reporter_name === "string" && reporter_name.trim().length > 0 ? reporter_name.trim() : "Field Agent",
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
    })
    .select("*")
    .single()

  if (error) {
    console.log("[v0] field-reports POST error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ report: data satisfies FieldReport }, { status: 201 })
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePhoneNumber } from "@/lib/whatsapp"

export async function GET() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_number, full_name")
    .eq("user_id", userData.user.id)
    .maybeSingle()

  return NextResponse.json({ profile: profile ?? null })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const phoneNumber = typeof body?.phoneNumber === "string" ? normalizePhoneNumber(body.phoneNumber) : ""
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : null

  if (phoneNumber.length < 10) {
    return NextResponse.json({ error: "Enter a valid WhatsApp number with country code" }, { status: 400 })
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: userData.user.id,
    phone_number: phoneNumber,
    full_name: fullName || userData.user.email?.split("@")[0] || "Driver",
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.log("[v0] link-phone error:", error.message)
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return NextResponse.json({ error: "This number is already linked to another account" }, { status: 409 })
    }
    return NextResponse.json({ error: "Could not link this number" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

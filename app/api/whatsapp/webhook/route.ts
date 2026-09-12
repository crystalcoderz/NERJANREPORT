import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  WHATSAPP_VERIFY_TOKEN,
  normalizePhoneNumber,
  sendWhatsAppButtons,
  sendWhatsAppText,
  verifyWhatsAppSignature,
} from "@/lib/whatsapp"
import { extractTripDetails, type TripDetails } from "@/lib/whatsapp-ai"
import { geocodeCity } from "@/lib/geocode"
import { computeDrivingRoute } from "@/lib/route-compute"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const GREETINGS = ["hi", "hii", "hiii", "hello", "hey", "start", "menu"]
const MODE_LABELS: Record<string, string> = { car: "Car", truck: "Truck", bike: "Bike", van: "Van" }

type SessionRow = {
  phone_number: string
  state: "idle" | "collecting"
  data: Partial<TripDetails>
  updated_at: string
}

// --- Webhook verification (Meta calls this once when you save the webhook config) ---
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

// --- Incoming message handler ---
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-hub-signature-256")

  if (process.env.WHATSAPP_APP_SECRET && !verifyWhatsAppSignature(rawBody, signature)) {
    console.log("[v0] WhatsApp webhook signature mismatch")
    return new NextResponse("Forbidden", { status: 403 })
  }

  const payload = JSON.parse(rawBody || "{}")
  const supabase = createAdminClient()

  try {
    const entries = payload?.entry ?? []
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        const messages = value?.messages ?? []
        for (const message of messages) {
          await handleMessage(supabase, message)
        }
      }
    }
  } catch (err) {
    console.log("[v0] WhatsApp webhook processing error:", (err as Error).message)
  }

  // Always 200 so Meta doesn't retry-storm us on a downstream error.
  return NextResponse.json({ ok: true })
}

async function handleMessage(supabase: ReturnType<typeof createAdminClient>, message: any) {
  const from = normalizePhoneNumber(message.from as string)

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone_number")
    .eq("phone_number", from)
    .maybeSingle()

  if (!profile) {
    await sendWhatsAppText(
      from,
      "This number isn't linked to a Jan Report account yet. Sign in to the app and add this WhatsApp number in your profile settings, then message us again.",
    )
    return
  }

  const text: string | undefined = message.text?.body
  const buttonId: string | undefined = message.interactive?.button_reply?.id

  const { data: sessionRow } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone_number", from)
    .maybeSingle()

  const session: SessionRow = (sessionRow as SessionRow) ?? { phone_number: from, state: "idle", data: {}, updated_at: "" }

  const isGreeting = typeof text === "string" && GREETINGS.includes(text.trim().toLowerCase())

  if (isGreeting || session.state === "idle") {
    await upsertSession(supabase, from, "idle", {})
    await sendWhatsAppButtons(
      from,
      `Hi ${profile.full_name ?? "there"}! What would you like to do?`,
      [{ id: "new_assignment", title: "New Assignment" }],
    )
    return
  }

  if (buttonId === "new_assignment") {
    await upsertSession(supabase, from, "collecting", {})
    await sendWhatsAppText(
      from,
      "Sure! Tell me the trip details — for example: \"Guwahati to Shillong by truck today 5pm\". You can send it all at once or one detail at a time.",
    )
    return
  }

  if (session.state === "collecting" && typeof text === "string") {
    await continueCollecting(supabase, from, profile, session, text)
    return
  }

  await sendWhatsAppText(from, "Sorry, I didn't understand that. Say \"hi\" to see what I can help with.")
}

async function continueCollecting(
  supabase: ReturnType<typeof createAdminClient>,
  from: string,
  profile: { user_id: string; full_name: string | null },
  session: SessionRow,
  text: string,
) {
  const known = session.data ?? {}
  const { details, provider } = await extractTripDetails(text, known)

  if (!details) {
    await sendWhatsAppText(from, "I couldn't process that right now — please try rephrasing your message.")
    return
  }

  const merged: Partial<TripDetails> = {
    origin: details.origin ?? known.origin ?? null,
    destination: details.destination ?? known.destination ?? null,
    mode: details.mode ?? known.mode ?? null,
    departureTimeIso: details.departureTimeIso ?? known.departureTimeIso ?? null,
  }

  console.log("[v0] WhatsApp trip extraction via", provider, merged)

  if (!merged.origin) {
    await upsertSession(supabase, from, "collecting", merged)
    await sendWhatsAppText(from, "Which city are you starting from?")
    return
  }
  if (!merged.destination) {
    await upsertSession(supabase, from, "collecting", merged)
    await sendWhatsAppText(from, "Where are you headed?")
    return
  }
  if (!merged.mode) {
    await upsertSession(supabase, from, "collecting", merged)
    await sendWhatsAppText(from, "What mode of transport — car, truck, bike, or van?")
    return
  }
  if (!merged.departureTimeIso) {
    await upsertSession(supabase, from, "collecting", merged)
    await sendWhatsAppText(from, "When are you planning to depart? (e.g. \"today 5pm\" or \"tomorrow 9am\")")
    return
  }

  // All fields present — resolve locations, compute the route, and create the trip.
  const [originPlace, destinationPlace] = await Promise.all([
    geocodeCity(merged.origin),
    geocodeCity(merged.destination),
  ])

  if (!originPlace || !destinationPlace) {
    await upsertSession(supabase, from, "collecting", merged)
    await sendWhatsAppText(
      from,
      `I couldn't find "${!originPlace ? merged.origin : merged.destination}" on the map. Please check the spelling and send it again.`,
    )
    return
  }

  const route = await computeDrivingRoute(originPlace, destinationPlace)
  const distanceKm = route?.distanceKm ?? 0
  const durationMin = route?.durationMin ?? 0

  const departure = new Date(merged.departureTimeIso)
  const validDeparture = !Number.isNaN(departure.getTime()) ? departure : new Date()
  const eta = new Date(validDeparture.getTime() + durationMin * 60_000)

  const { data: reports } = await supabase
    .from("field_reports")
    .select("location_name, corridor, severity, status")
    .eq("status", "active")

  const stops = [originPlace.label, destinationPlace.label]
  const matchedReports = (reports ?? []).filter((r) => {
    const haystack = `${r.location_name} ${r.corridor ?? ""}`.toLowerCase()
    return stops.some((stop) => haystack.includes(stop.toLowerCase()))
  })
  const riskLevel = matchedReports.some((r) => r.severity === "high")
    ? "high"
    : matchedReports.some((r) => r.severity === "moderate")
      ? "moderate"
      : "low"

  const modeLabel = MODE_LABELS[merged.mode] ?? merged.mode

  const { error: insertError } = await supabase.from("trips").insert({
    origin: originPlace.label,
    destination: destinationPlace.label,
    waypoints: [],
    assigned_to: profile.full_name ?? "WhatsApp driver",
    distance_km: distanceKm,
    duration_min: durationMin,
    risk_level: riskLevel,
    departure_time: validDeparture.toISOString(),
    eta: eta.toISOString(),
    notes: `Mode: ${modeLabel}. Created via WhatsApp.`,
    matched_report_count: matchedReports.length,
  })

  if (insertError) {
    console.log("[v0] WhatsApp trip insert error:", insertError.message)
    await sendWhatsAppText(from, "Something went wrong creating your trip. Please try again shortly.")
    await upsertSession(supabase, from, "idle", {})
    return
  }

  await upsertSession(supabase, from, "idle", {})
  await sendWhatsAppText(
    from,
    [
      "Trip created!",
      `${originPlace.label} → ${destinationPlace.label}`,
      `Mode: ${modeLabel}`,
      `Distance: ${distanceKm} km · Duration: ~${Math.round(durationMin / 60)}h ${durationMin % 60}m`,
      `Departure: ${validDeparture.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
      `Risk level: ${riskLevel}`,
      matchedReports.length > 0 ? `Heads up: ${matchedReports.length} active field report(s) along this route.` : "No active field reports along this route.",
      "",
      'Say "hi" anytime to start a new assignment.',
    ].join("\n"),
  )
}

async function upsertSession(
  supabase: ReturnType<typeof createAdminClient>,
  phoneNumber: string,
  state: "idle" | "collecting",
  data: Partial<TripDetails>,
) {
  await supabase.from("whatsapp_sessions").upsert({
    phone_number: phoneNumber,
    state,
    data,
    updated_at: new Date().toISOString(),
  })
}

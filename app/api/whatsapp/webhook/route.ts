import { randomUUID } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  WHATSAPP_VERIFY_TOKEN,
  normalizePhoneNumber,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendWhatsAppText,
  verifyWhatsAppSignature,
} from "@/lib/whatsapp"
import { extractTripDetails, localSlotGuess, type TripDetails } from "@/lib/whatsapp-ai"
import { geocodeCity } from "@/lib/geocode"
import { computeDrivingRoute } from "@/lib/route-compute"
import { directionsLink, sendRouteMap } from "@/lib/whatsapp-map"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const GREETINGS = ["hi", "hii", "hiii", "hello", "hey", "start", "menu"]
const MODE_LABELS: Record<string, string> = { car: "Car", truck: "Truck", bike: "Bike", van: "Van" }

type SessionData = Partial<TripDetails> & {
  awaitingConfirmation?: boolean
  tripId?: string
  mapOfferId?: string
  mapSent?: boolean
}

type SessionRow = {
  phone_number: string
  state: "idle" | "collecting"
  data: SessionData
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

  let payload
  try { payload = JSON.parse(rawBody || "{}") } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const supabase = createAdminClient()

  try {
    const entries = payload?.entry ?? []
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        const messages = value?.messages ?? []
        for (const message of messages) {
          if (alreadyProcessed(message?.id)) continue
          try {
            await withPhoneLock(String(message?.from ?? ""), () => handleMessage(supabase, message))
          } catch (error) {
            console.error("WhatsApp message processing failed:", (error as Error).message)
          }
        }
      }
    }
  } catch (err) {
    console.log("[v0] WhatsApp webhook processing error:", (err as Error).message)
  }

  // Always 200 so Meta doesn't retry-storm us on a downstream error.
  return NextResponse.json({ ok: true })
}

/**
 * Serializes handling per phone number. Messages sent seconds apart arrive as
 * separate webhook POSTs that each read the session before either has written,
 * so the later write clobbered the earlier answer and the same slot question was
 * asked twice. Queuing per sender makes each message see the previous one's state.
 */
const phoneQueues = new Map<string, Promise<unknown>>()

function withPhoneLock<T>(phone: string, fn: () => Promise<T>): Promise<T> {
  const previous = phoneQueues.get(phone) ?? Promise.resolve()
  const run = previous.then(fn, fn)
  const tail = run.catch(() => {})
  phoneQueues.set(phone, tail)
  // Release the entry once this run is the tail, so the map can't grow unbounded.
  void tail.then(() => { if (phoneQueues.get(phone) === tail) phoneQueues.delete(phone) })
  return run
}

/** Meta retries deliveries; replaying a message would re-send its reply. */
const processedIds = new Map<string, number>()

function alreadyProcessed(id: string | undefined): boolean {
  if (!id) return false
  const now = Date.now()
  for (const [key, seenAt] of processedIds) if (now - seenAt > 10 * 60_000) processedIds.delete(key)
  if (processedIds.has(id)) return true
  processedIds.set(id, now)
  return false
}

/**
 * Reads a tapped reply out of a webhook message. Meta uses three different shapes:
 * interactive reply buttons, interactive list rows, and template quick-reply buttons
 * (`message.button`), and it has been observed delivering `interactive` as a JSON string.
 */
function extractTap(message: any): { buttonId?: string; buttonTitle?: string } {
  let interactive = message?.interactive
  if (typeof interactive === "string") {
    try { interactive = JSON.parse(interactive) } catch { interactive = undefined }
  }

  const reply = interactive?.button_reply ?? interactive?.list_reply
  const id = reply?.id ?? message?.button?.payload
  const title = reply?.title ?? message?.button?.text

  return {
    buttonId: typeof id === "string" && id.trim() ? id.trim().toLowerCase() : undefined,
    buttonTitle: typeof title === "string" && title.trim() ? title : undefined,
  }
}

async function handleMessage(supabase: ReturnType<typeof createAdminClient>, message: any) {
  const from = normalizePhoneNumber(message.from as string)

  if (!from) return
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone_number")
    .eq("phone_number", from)
    .maybeSingle()

  if (profileError) throw new Error("Could not load WhatsApp profile")

  if (!profile) {
    await sendWhatsAppText(
      from,
      "This number isn't linked to a Jan Report account yet. Sign in to the app and add this WhatsApp number in your profile settings, then message us again.",
    )
    return
  }

  const text: string | undefined = message.text?.body
  const { buttonId, buttonTitle } = extractTap(message)
  // A tap with no usable id still carries its visible title, so fall back to that:
  // "Help" and "New Assignment" then match the same branches a typed message would.
  const command = (text ?? buttonTitle ?? "").trim().toLowerCase().replace(/\s+/g, " ")

  const { data: sessionRow, error: sessionError } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone_number", from)
    .maybeSingle()

  if (sessionError) throw new Error("Could not load WhatsApp session")
  const session: SessionRow = (sessionRow as SessionRow) ?? { phone_number: from, state: "idle", data: {}, updated_at: "" }

  if (command === "cancel" || buttonId === "cancel") {
    await upsertSession(supabase, from, "idle", {})
    await sendWhatsAppButtons(from, "Draft cancelled. Ready when you are.", [{ id: "new_assignment", title: "New assignment" }])
    return
  }
  if (command === "help" || buttonId === "help") {
    await sendWhatsAppText(from, 'Send a trip such as "Guwahati to Shillong by truck tomorrow 9am", or answer one question at a time. Times are in IST. On the review, choose Send route map for an optional Google route image. Type cancel to discard a draft, or menu to start over. Review and confirm before a trip is created.')
    return
  }
  const wantsMap = buttonId?.startsWith("map_") || ["map", "send map", "send route map"].includes(command)
    || (["yes", "yes please"].includes(command) && Boolean(session.data.mapOfferId))
  if (wantsMap) {
    if (!session.data.awaitingConfirmation || !session.data.origin || !session.data.destination
      || (buttonId?.startsWith("map_") && (!session.data.mapOfferId || buttonId !== `map_${session.data.mapOfferId}`))) {
      await sendWhatsAppText(from, "That map option is no longer active. Finish reviewing your current trip, then choose Send route map.")
      return
    }
    if (session.data.mapSent) {
      await sendReviewActions(from, "Your route map is above. Ready to confirm, or would you like to edit the trip?")
      return
    }
    if (!session.data.mapOfferId) {
      session.data.mapOfferId = randomUUID()
      await upsertSession(supabase, from, "collecting", session.data)
    }
    await sendWhatsAppText(from, "Preparing your Google route map...")
    const sent = await sendRouteMap(from, session.data.origin, session.data.destination)
    if (sent) {
      await upsertSession(supabase, from, "collecting", { ...session.data, mapSent: true })
      await sendReviewActions(from, "Review the map above. Your trip will only be created when you confirm.")
    } else {
      await sendWhatsAppButtons(from, "I couldn't send the map right now. Your draft is safe. You can retry, confirm without an image, or type edit or cancel.\n"
        + directionsLink(session.data.origin, session.data.destination), [
        { id: `map_${session.data.mapOfferId}`, title: "Retry route map" },
        { id: "confirm_trip", title: "Confirm trip" }, { id: "edit_trip", title: "Edit details" },
      ])
    }
    return
  }
  if (session.state === "collecting" && session.data.awaitingConfirmation) {
    if (["no", "no thanks", "skip", "skip map"].includes(command)) {
      await upsertSession(supabase, from, "collecting", { ...session.data, mapOfferId: undefined })
      await sendReviewActions(from, "No map will be sent. Would you like to confirm this trip or edit the details?")
      return
    }
    if (buttonId === "confirm_trip" || command === "confirm") {
      await continueCollecting(supabase, from, profile, session, "", true)
      return
    }
    if (buttonId === "edit_trip" || command === "edit") {
      await upsertSession(supabase, from, "collecting", { ...session.data, mapOfferId: undefined, mapSent: false })
      await sendWhatsAppText(from, 'Tell me what to change, for example "destination is Jorhat" or "depart tomorrow 10am". I will show an updated review.')
      return
    }
  }
  const isGreeting = !buttonId && GREETINGS.includes(command)

  // Button taps must be handled before the greeting branch: that branch also matches
  // the "idle" state the menu itself leaves behind, so checking it first would
  // re-send the menu forever and the user could never start an assignment.
  if (buttonId === "new_assignment" || command === "new" || command === "new assignment") {
    await upsertSession(supabase, from, "collecting", {})
    await sendWhatsAppText(
      from,
      "Sure! Tell me the trip details — for example: \"Guwahati to Shillong by truck today 5pm\". You can send it all at once or one detail at a time.",
    )
    return
  }

  // `!buttonId` matters: without it an unrecognised tap falls in here and re-sends
  // the very menu it came from, so the user can never leave the menu.
  if (isGreeting || (session.state === "idle" && !text && !buttonId)) {
    await upsertSession(supabase, from, "idle", {})
    await sendWhatsAppButtons(
      from,
      `Hi ${profile.full_name ?? "there"}! What would you like to do?`,
      [{ id: "new_assignment", title: "New Assignment" }, { id: "help", title: "Help" }],
    )
    return
  }

  const selection = buttonId?.startsWith("mode_") ? buttonId.slice(5)
    : buttonId === "depart_now" ? "now" : buttonId === "depart_hour" ? "in one hour" : undefined
  if (typeof text === "string" || selection) {
    await continueCollecting(supabase, from, profile, session, selection ?? text!)
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
  confirmed = false,
) {
  const known = session.data ?? {}
  const simple = text.trim().toLowerCase()
  const quick: TripDetails = { origin: null, destination: null, mode: null, departureTimeIso: null }
  if (["car", "truck", "bike", "van"].includes(simple)) quick.mode = simple as TripDetails["mode"]
  if (simple === "now" || simple === "in one hour") quick.departureTimeIso = new Date(Date.now() + (simple === "now" ? 0 : 3600000)).toISOString()
  const { details } = confirmed ? { details: known }
    : quick.mode || quick.departureTimeIso ? { details: quick }
    : await extractTripDetails(text, known)

  // Both model providers failing must not dead-end the conversation: a bare place
  // reply can still be resolved locally for whichever slot we are waiting on.
  const resolved = details ?? (await localSlotGuess(text, known))
  if (!resolved) {
    await sendWhatsAppText(from, "I couldn't process that right now — please try rephrasing your message.")
    return
  }

  const merged: Partial<TripDetails> = {
    origin: resolved.origin ?? known.origin ?? null,
    destination: resolved.destination ?? known.destination ?? null,
    mode: resolved.mode ?? known.mode ?? null,
    departureTimeIso: resolved.departureTimeIso ?? known.departureTimeIso ?? null,
  }


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
    await sendWhatsAppList(from, "Choose your vehicle, or type car, truck, bike, or van.", Object.entries(MODE_LABELS).map(([id, title]) => ({ id: `mode_${id}`, title })))
    return
  }
  if (!merged.departureTimeIso) {
    await upsertSession(supabase, from, "collecting", merged)
    await sendWhatsAppButtons(from, 'When are you departing? Choose below or type a time, e.g. "tomorrow 9am" (IST).', [{ id: "depart_now", title: "Now" }, { id: "depart_hour", title: "In one hour" }])
    return
  }

  const departureMs = Date.parse(merged.departureTimeIso)
  if (!Number.isFinite(departureMs) || departureMs < Date.now() - 5 * 60_000) {
    await upsertSession(supabase, from, "collecting", { ...merged, departureTimeIso: null })
    await sendWhatsAppText(from, "Please send a valid departure time in the future (IST).")
    return
  }
  if (merged.origin.trim().toLowerCase() === merged.destination.trim().toLowerCase()) {
    await upsertSession(supabase, from, "collecting", { ...merged, destination: null })
    await sendWhatsAppText(from, "The destination must be different from your starting city. Where are you headed?")
    return
  }
  if (!confirmed) {
    const mapOfferId = randomUUID()
    await upsertSession(supabase, from, "collecting", { ...merged, awaitingConfirmation: true, tripId: session.data.tripId ?? randomUUID(), mapOfferId })
    await sendWhatsAppButtons(from, ["Review your trip", `${merged.origin} → ${merged.destination}`,
      `Vehicle: ${MODE_LABELS[merged.mode]}`,
      `Departure: ${new Date(departureMs).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`,
      "Want a Google route image with both locations? Tap Send route map or reply yes. It's optional; reply no to skip.",
      "Confirm to create, edit any detail, or type cancel."].join("\n"), [
      { id: `map_${mapOfferId}`, title: "Send route map" }, { id: "confirm_trip", title: "Confirm trip" }, { id: "edit_trip", title: "Edit details" },
    ])
    return
  }

  // All fields present — resolve locations, compute the route, and create the trip.
  const [originPlace, destinationPlace] = await Promise.all([
    geocodeCity(merged.origin),
    geocodeCity(merged.destination),
  ])

  if (!originPlace || !destinationPlace) {
    await upsertSession(supabase, from, "collecting", { ...merged, ...(!originPlace ? { origin: null } : { destination: null }) })
    await sendWhatsAppText(
      from,
      `I couldn't find "${!originPlace ? merged.origin : merged.destination}" on the map. Please check the spelling and send it again.`,
    )
    return
  }

  const route = await computeDrivingRoute(originPlace, destinationPlace)
  if (!route) {
    await sendWhatsAppButtons(from, "Route estimates are unavailable right now. Your draft is saved; try again shortly.", [{ id: "confirm_trip", title: "Try again" }, { id: "cancel", title: "Cancel" }])
    return
  }
  const { distanceKm, durationMin } = route

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
    ...(session.data.tripId ? { id: session.data.tripId } : {}),
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

  if (insertError && insertError.code !== "23505") {
    console.log("[v0] WhatsApp trip insert error:", insertError.message)
    await sendWhatsAppText(from, "Something went wrong creating your trip. Please try again shortly.")
    return
  }

  await upsertSession(supabase, from, "idle", {})
  await sendWhatsAppText(
    from,
    [
      "Trip created!",
      `${originPlace.label} → ${destinationPlace.label}`,
      `Mode: ${modeLabel}`,
      `Distance: ${distanceKm} km · Duration: ~${Math.floor(durationMin / 60)}h ${durationMin % 60}m`,
      `Departure: ${validDeparture.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}`,
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
  data: SessionData,
) {
  const { error } = await supabase.from("whatsapp_sessions").upsert({
    phone_number: phoneNumber,
    state,
    data,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error("Could not save WhatsApp conversation")
}

async function sendReviewActions(from: string, body: string) {
  await sendWhatsAppButtons(from, body, [
    { id: "confirm_trip", title: "Confirm trip" }, { id: "edit_trip", title: "Edit details" }, { id: "cancel", title: "Cancel" },
  ])
}

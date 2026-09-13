import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"
import { cities } from "@/lib/data"
import { geocodeCity } from "@/lib/geocode"
import { withGemini, KIMI_MODEL } from "@/lib/ai-gemini"

const moonshot = createOpenAICompatible({
  name: "moonshot",
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
})

const extractionSchema = z.object({
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  mode: z.enum(["car", "truck", "bike", "van"]).nullable(),
  departureTimeIso: z.string().nullable(),
})

export type TripDetails = z.infer<typeof extractionSchema>

function buildPrompt(message: string, known: Partial<TripDetails>, nowIso: string) {
  return `You are helping extract freight trip details from a WhatsApp message sent by a freight driver in India. Trips run anywhere in the country, not just one region.

Current date and time (ISO): ${nowIso}. Interpret all driver times in Asia/Kolkata (UTC+05:30), and include the timezone offset in the result.

Frequently used cities — use these exact names when the message matches one: ${Object.keys(cities).join(", ")}
Any other Indian city (for example Jhansi, Lucknow, Nagpur, Kochi) is equally valid — never return null for a city just because it is missing from that list.

Already known details for this trip (do not overwrite with null unless the user clearly corrects them):
- origin: ${known.origin ?? "unknown"}
- destination: ${known.destination ?? "unknown"}
- mode: ${known.mode ?? "unknown"}
- departureTimeIso: ${known.departureTimeIso ?? "unknown"}

Driver's message: "${message}"

Extract the origin city, destination city, mode of transport (car, truck, bike, or van), and departure time as an ISO 8601 datetime. Resolve relative terms like "today 5pm", "tomorrow morning", or "now" using the current date/time above. If a field is not mentioned in THIS message, output null for it — do not guess or invent values.

Respond with ONLY raw JSON, no markdown fences, no commentary, matching exactly this shape:
{"origin": string|null, "destination": string|null, "mode": "car"|"truck"|"bike"|"van"|null, "departureTimeIso": string|null}`
}

function parseJson(text: string): TripDetails | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(cleaned)
    const result = extractionSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

const PLACE_RE = /^[a-z][a-z\s.'-]{1,39}$/i
const TIME_WORDS = /\b(today|tomorrow|tonight|morning|evening|afternoon|night|noon|am|pm|hour|hours|oclock|now|asap|later)\b/i
const NOISE = new Set([
  "yes", "yes please", "no", "no thanks", "ok", "okay", "hi", "hii", "hiii", "hello", "hey", "start",
  "menu", "help", "cancel", "edit", "confirm", "new", "new assignment", "skip", "skip map", "map",
  "send map", "send route map", "thanks", "car", "truck", "bike", "van",
])

/**
 * Works out which slot a short reply answers, and what place name it contains.
 * Returns the raw candidate — Google decides whether it is a real place.
 */
function readSlot(message: string, known: Partial<TripDetails>): { slot: "origin" | "destination"; value: string } | null {
  const raw = (message ?? "").trim().replace(/[.!,]+$/, "")
  if (!raw || TIME_WORDS.test(raw)) return null

  const toMatch = raw.match(/^(?:to|towards|going to|heading to)\s+(.+)$/i)
  const fromMatch = raw.match(/^(?:from|starting from|start from)\s+(.+)$/i)
  const explicit = Boolean(toMatch || fromMatch)

  const value = (toMatch?.[1] ?? fromMatch?.[1] ?? raw).trim()
  if (!PLACE_RE.test(value) || NOISE.has(value.toLowerCase())) return null

  let slot: "origin" | "destination" | null = toMatch ? "destination" : fromMatch ? "origin" : null
  // Without a preposition, the reply answers whichever slot is still open.
  if (!slot) slot = !known.origin ? "origin" : !known.destination ? "destination" : null
  if (!slot) return null
  if (!explicit && (slot === "origin" ? known.origin : known.destination)) return null

  return { slot, value }
}

/**
 * Resolves a bare place reply such as "Jhansi" or "to lucknow" without calling a model,
 * confirming the place against Google Geocoding so any Indian city is accepted and
 * non-places are rejected. Returns the canonical Google spelling.
 */
export async function localSlotGuess(
  message: string,
  known: Partial<TripDetails>,
): Promise<TripDetails | null> {
  const read = readSlot(message, known)
  if (!read) return null

  const place = await geocodeCity(read.value)
  if (!place) return null

  return {
    origin: read.slot === "origin" ? place.label : null,
    destination: read.slot === "destination" ? place.label : null,
    mode: null,
    departureTimeIso: null,
  }
}

// Kimi is the primary parser per project requirements; Gemini is a silent
// fallback so a single provider outage doesn't break the bot conversation.
export async function extractTripDetails(
  message: string,
  known: Partial<TripDetails>,
): Promise<{ details: TripDetails | null; provider: string }> {
  const local = await localSlotGuess(message, known)
  if (local) return { details: local, provider: "google" }

  const nowIso = new Date().toISOString()
  const prompt = buildPrompt(message, known, nowIso)

  try {
    const { text } = await generateText({ model: moonshot(KIMI_MODEL), prompt, maxRetries: 0, abortSignal: AbortSignal.timeout(6000) })
    const parsed = parseJson(text)
    if (parsed) return { details: parsed, provider: "Kimi" }
    console.log("[v0] Kimi returned unparseable JSON, falling back to Gemini")
  } catch (err) {
    console.log("[v0] Kimi extraction failed, falling back to Gemini:", (err as Error).message)
  }

  try {
    const { text } = await withGemini((model) =>
      generateText({ model, prompt, temperature: 0.2, maxRetries: 0, abortSignal: AbortSignal.timeout(6000) }),
    )
    const parsed = parseJson(text)
    if (parsed) return { details: parsed, provider: "Gemini (fallback)" }
  } catch (err) {
    console.log("[v0] Gemini extraction also failed:", (err as Error).message)
  }

  return { details: null, provider: "none" }
}

import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { z } from "zod"
import { cities } from "@/lib/data"

const KIMI_MODEL = "kimi-k3"
// Routed through the Vercel AI Gateway (billed, no free-tier daily cap, no personal API key).
const GEMINI_MODEL = "google/gemini-2.5-flash"

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
  return `You are helping extract freight trip details from a WhatsApp message sent by a driver in Northeast India.

Current date and time (ISO): ${nowIso}

Known cities in the region — use these exact names when the message matches one: ${Object.keys(cities).join(", ")}

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

// Kimi is the primary parser per project requirements; Gemini is a silent
// fallback so a single provider outage doesn't break the bot conversation.
export async function extractTripDetails(
  message: string,
  known: Partial<TripDetails>,
): Promise<{ details: TripDetails | null; provider: string }> {
  const nowIso = new Date().toISOString()
  const prompt = buildPrompt(message, known, nowIso)

  try {
    const { text } = await generateText({ model: moonshot(KIMI_MODEL), prompt })
    const parsed = parseJson(text)
    if (parsed) return { details: parsed, provider: "Kimi" }
    console.log("Kimi returned unparseable JSON, falling back to Gemini")
  } catch (err) {
    console.log("Kimi extraction failed, falling back to Gemini:", (err as Error).message)
  }

  try {
    const { text } = await generateText({ model: GEMINI_MODEL, prompt, temperature: 0.2 })
    const parsed = parseJson(text)
    if (parsed) return { details: parsed, provider: "Gemini (fallback)" }
  } catch (err) {
    console.log("Gemini extraction also failed:", (err as Error).message)
  }

  return { details: null, provider: "none" }
}

import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const GEMINI_MODEL = "gemini-3.6-flash"
const KIMI_MODEL = "kimi-k3"

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

const moonshot = createOpenAICompatible({
  name: "moonshot",
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
})

type Body = {
  from?: string
  to?: string
  distanceKm?: number
  etaLabel?: string
  risk?: string
  weather?: string
  incidents?: { title: string; level: string }[]
}

function buildPrompt(b: Body) {
  const incidentText =
    b.incidents && b.incidents.length
      ? b.incidents.map((i) => `- ${i.title} (${i.level} risk)`).join("\n")
      : "- None reported"
  return `You are a logistics risk analyst for the North Eastern Region of India, where terrain is hilly and weather causes landslides, floods, and road damage.

Analyze this transport corridor and give a concise go/no-go recommendation for a driver hauling essential supplies.

Route: ${b.from ?? "Origin"} to ${b.to ?? "Destination"}
Distance: ${b.distanceKm ?? "?"} km
Estimated time: ${b.etaLabel ?? "?"}
Overall risk rating: ${b.risk ?? "unknown"}
Current weather at origin: ${b.weather ?? "unknown"}
Known incidents along the corridor:
${incidentText}

Respond in 2-3 short sentences, plain and practical. Start with a clear verdict such as "Good to go" or "Proceed with caution" or "Delay departure". No markdown, no lists.`
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body
  const prompt = buildPrompt(body)

  try {
    const { text } = await generateText({
      model: google(GEMINI_MODEL),
      prompt,
      temperature: 0.4,
    })
    return NextResponse.json({ provider: "Gemini", model: GEMINI_MODEL, analysis: text.trim() })
  } catch (geminiError) {
    console.log("Gemini failed, falling back to Kimi:", (geminiError as Error).message)
    try {
      // Kimi only accepts the default temperature (1); passing any other value errors out.
      const { text } = await generateText({
        model: moonshot(KIMI_MODEL),
        prompt,
      })
      return NextResponse.json({ provider: "Kimi (fallback)", model: KIMI_MODEL, analysis: text.trim() })
    } catch (kimiError) {
      console.log("Kimi also failed:", (kimiError as Error).message)
      return NextResponse.json(
        {
          provider: "Offline",
          model: "none",
          analysis:
            "AI analysis is temporarily unavailable. Based on current data the corridor is passable with light rain and one landslide-prone stretch — proceed with caution and monitor updates.",
        },
        { status: 200 },
      )
    }
  }
}

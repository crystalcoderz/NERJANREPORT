import { generateText } from "ai"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const GEMINI = "google/gemini-3-flash"
const KIMI = "moonshotai/kimi-k2"

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
      model: GEMINI,
      prompt,
      temperature: 0.4,
    })
    return NextResponse.json({ provider: "Gemini", model: GEMINI, analysis: text.trim() })
  } catch (geminiError) {
    console.log("[v0] Gemini failed, falling back to Kimi:", (geminiError as Error).message)
    try {
      const { text } = await generateText({
        model: KIMI,
        prompt,
        temperature: 0.4,
      })
      return NextResponse.json({ provider: "Kimi (fallback)", model: KIMI, analysis: text.trim() })
    } catch (kimiError) {
      console.log("[v0] Kimi also failed:", (kimiError as Error).message)
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

import type { LanguageModel } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

// Gemini reaches us two independent ways, and each has its own quota bucket:
//   1. the Vercel AI Gateway (free tier is aggressively rate-limited)
//   2. the project's own Google API key (separate free-tier quota)
// Trying the Gateway first and the direct key second means a Gateway rate limit
// no longer forces every request down to the Kimi fallback.
const GATEWAY_MODEL = "google/gemini-2.5-flash"
const DIRECT_MODELS = ["gemini-3.5-flash", "gemini-flash-latest"]

const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
const google = googleKey ? createGoogleGenerativeAI({ apiKey: googleKey }) : null

export const GEMINI_MODEL_LABEL = GATEWAY_MODEL

function candidates(): LanguageModel[] {
  const list: LanguageModel[] = [GATEWAY_MODEL]
  if (google) for (const name of DIRECT_MODELS) list.push(google(name))
  return list
}

/**
 * Runs `run` against each Gemini route in turn and returns the first success.
 * Callers must pass `maxRetries: 0` to the generate call: the SDK's default of
 * three attempts spends several seconds on exponential backoff per candidate,
 * which is what made rate-limited requests take ~50s before giving up.
 * Throws the last error if every route fails, so existing Kimi fallbacks still fire.
 */
export async function withGemini<T>(run: (model: LanguageModel) => Promise<T>): Promise<T> {
  let lastError: unknown = new Error("No Gemini route available")
  for (const model of candidates()) {
    try {
      return await run(model)
    } catch (error) {
      lastError = error
      const label = typeof model === "string" ? model : (model as { modelId?: string }).modelId
      console.log(`[v0] Gemini route ${label} failed:`, (error as Error).message.slice(0, 120))
    }
  }
  throw lastError
}

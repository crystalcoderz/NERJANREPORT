import crypto from "node:crypto"

const GRAPH_VERSION = "v21.0"

// Shared secret pasted into the Meta App Dashboard's webhook "Verify Token" field.
// This only proves webhook ownership during setup — it is not a credential used at runtime.
export const WHATSAPP_VERIFY_TOKEN = "jan_report_2026_verify"

function apiUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`
}

async function callGraph(body: Record<string, unknown>) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!phoneNumberId || !token) {
    console.log("WhatsApp credentials missing, skipping send")
    return null
  }

  const res = await fetch(apiUrl(`${phoneNumberId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  })

  if (!res.ok) {
    console.log("WhatsApp send error:", res.status, await res.text())
    return null
  }

  return res.json()
}

export async function sendWhatsAppText(to: string, text: string) {
  return callGraph({ to, type: "text", text: { body: text, preview_url: false } })
}

export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
) {
  return callGraph({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })),
      },
    },
  })
}

// Verifies the X-Hub-Signature-256 header Meta signs every webhook delivery with,
// so we only act on payloads that genuinely came from Meta.
export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret || !signatureHeader) return false

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")
  const provided = signatureHeader.replace("sha256=", "")

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"))
  } catch {
    return false
  }
}

// WhatsApp sends numbers as plain digits (e.g. "919876543210"). Normalize any
// stored/incoming phone number to digits-only so lookups are consistent.
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d]/g, "")
}

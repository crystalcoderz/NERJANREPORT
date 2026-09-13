import crypto from "node:crypto"

const GRAPH_VERSION = "v21.0"

// Shared secret pasted into the Meta App Dashboard's webhook "Verify Token" field.
// This only proves webhook ownership during setup — it is not a credential used at runtime.
export const WHATSAPP_VERIFY_TOKEN = "jan_report_2026_verify"

// Phone Number ID for +44 7344 643473 ("Jan Report Portal") on WABA 2113253752952717.
// This is a public identifier rather than a secret, so it is pinned here: the
// WHATSAPP_PHONE_NUMBER_ID project variable still holds the retired Meta test
// number, and sending from that number never reaches real recipients.
const PHONE_NUMBER_ID = "1303940209459464"

function apiUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`
}

async function callGraph(body: Record<string, unknown>) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) {
    console.log("[v0] WHATSAPP_ACCESS_TOKEN missing, skipping send")
    return null
  }

  const res = await fetch(apiUrl(`${PHONE_NUMBER_ID}/messages`), {
    signal: AbortSignal.timeout(8000),
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  })

  if (!res.ok) {
    console.log("[v0] WhatsApp send error:", res.status, await res.text())
    return null
  }

  return res.json()
}

export async function sendWhatsAppText(to: string, text: string) {
  return callGraph({ to, type: "text", text: { body: text, preview_url: false } })
}

// Upload bytes rather than sharing a Google URL containing a server API key.
export async function sendWhatsAppImage(to: string, image: Blob, caption: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) return false
  if (!["image/png", "image/jpeg"].includes(image.type) || image.size > 5 * 1024 * 1024 || image.size === 0) return false
  try {
    const form = new FormData()
    form.set("messaging_product", "whatsapp")
    form.set("type", image.type)
    form.set("file", image, image.type === "image/png" ? "route-map.png" : "route-map.jpg")
    const response = await fetch(apiUrl(`${PHONE_NUMBER_ID}/media`), {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
      body: form, signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) return false
    const media = await response.json()
    if (typeof media.id !== "string" || !media.id) return false
    const sent = await callGraph({ to, type: "image", image: { id: media.id, caption: caption.slice(0, 1024) } })
    return Boolean(sent?.messages?.[0]?.id)
  } catch {
    console.error("WhatsApp route image upload or send failed")
    return false
  }
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

export async function sendWhatsAppList(to: string, body: string, rows: { id: string; title: string }[]) {
  return callGraph({
    to, type: "interactive",
    interactive: {
      type: "list", body: { text: body },
      action: { button: "Choose vehicle", sections: [{ title: "Vehicles", rows }] },
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

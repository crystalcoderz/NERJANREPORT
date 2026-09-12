import { createAdminClient } from "@/lib/supabase/admin"
import { sendOtpEmail } from "@/lib/resend"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_MS = 30_000
const CODE_TTL_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string }

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("otp_codes")
    .select("created_at")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (existing && Date.now() - new Date(existing.created_at).getTime() < RESEND_COOLDOWN_MS) {
    return NextResponse.json({ error: "Please wait a moment before requesting another code." }, { status: 429 })
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()

  const { error: upsertError } = await admin
    .from("otp_codes")
    .upsert({ email: normalizedEmail, code, expires_at: expiresAt, attempts: 0, created_at: new Date().toISOString() })

  if (upsertError) {
    console.error("[v0] Failed to store OTP code:", upsertError)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }

  try {
    await sendOtpEmail(normalizedEmail, code)
  } catch (error) {
    console.error("[v0] Failed to send OTP email:", error)
    return NextResponse.json({ error: "Could not send the code. Please try again." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

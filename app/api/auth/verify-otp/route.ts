import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const MAX_ATTEMPTS = 5

export async function POST(request: Request) {
  const { email, code } = (await request.json().catch(() => ({}))) as { email?: string; code?: string }

  if (!email || !code) {
    return NextResponse.json({ error: "Enter the code sent to your email." }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const admin = createAdminClient()

  const { data: record, error: fetchError } = await admin
    .from("otp_codes")
    .select("code, expires_at, attempts")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (fetchError || !record) {
    return NextResponse.json({ error: "Request a new code and try again." }, { status: 400 })
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await admin.from("otp_codes").delete().eq("email", normalizedEmail)
    return NextResponse.json({ error: "That code expired. Request a new one." }, { status: 400 })
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await admin.from("otp_codes").delete().eq("email", normalizedEmail)
    return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 })
  }

  if (record.code !== code.trim()) {
    await admin.from("otp_codes").update({ attempts: record.attempts + 1 }).eq("email", normalizedEmail)
    return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 })
  }

  await admin.from("otp_codes").delete().eq("email", normalizedEmail)

  // Ensure a user exists for this email (creates one on first sign-in).
  const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1, email: normalizedEmail } as never)
  const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail)

  if (!existingUser) {
    const { error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    })
    if (createError) {
      console.error("Failed to create user:", createError)
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
    }
  }

  // Issue a magic-link token and immediately redeem it server-side to start a real session.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("Failed to generate sign-in link:", linkError)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  })

  if (verifyError) {
    console.error("Failed to verify sign-in link:", verifyError)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

import { createAdminClient } from "@/lib/supabase/admin"
import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

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
  // Supabase's admin listUsers endpoint has no server-side email filter, so
  // checking for an existing user that way is unreliable. Instead, just
  // attempt to create the user and treat "already registered" as success —
  // that's the expected outcome for every returning user.
  const { error: createError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
  })
  if (createError && createError.code !== "email_exists") {
    console.error("Failed to create user:", createError)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
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

  // Build the response up front and let Supabase write the session cookies
  // directly onto it. Route Handlers cannot reliably propagate cookie
  // mutations made through next/headers' cookies() back onto a separately
  // created NextResponse, which was causing the session to silently fail to
  // persist (the user would verify successfully but land back on the login
  // page). Attaching cookies straight to this response guarantees the
  // Set-Cookie headers actually reach the browser.
  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return Object.entries(
          Object.fromEntries(
            (request.headers.get("cookie") ?? "")
              .split(";")
              .map((pair) => pair.trim())
              .filter(Boolean)
              .map((pair) => {
                const index = pair.indexOf("=")
                return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))]
              }),
          ),
        ).map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  })

  if (verifyError) {
    console.error("Failed to verify sign-in link:", verifyError)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }

  return response
}

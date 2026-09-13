import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    // v0 previews render the app inside a cross-origin iframe, so the
    // default SameSite=Lax session cookie gets dropped there (it's only
    // sent for genuine top-level navigations). SameSite=None + Secure keeps
    // it working in the preview iframe as well as normal top-level use.
    cookieOptions: { sameSite: "none", secure: true },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component without a writable cookie store; safe to ignore.
        }
      },
    },
  })
}

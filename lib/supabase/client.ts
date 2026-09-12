import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    // The app may render inside a cross-origin iframe. The default
    // SameSite=Lax cookies are dropped there because the browser treats any
    // request from inside that iframe as third-party, so the session cookie
    // never persists. SameSite=None (which requires Secure) makes it work in
    // both the preview iframe and normal top-level browsing.
    cookieOptions: { sameSite: "none", secure: true },
  })
}

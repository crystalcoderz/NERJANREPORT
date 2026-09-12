import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Service-role client for server-only privileged operations (OTP verification,
// user lookup/creation). Never import this from client components.
export function createAdminClient() {
  return createSupabaseClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WhatsAppLinkCard } from "@/components/settings/whatsapp-link-card"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?next=%2Fsettings")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_number, full_name")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 py-10 md:p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage how you connect to Jan Report.</p>
        </div>

        <WhatsAppLinkCard
          initialPhoneNumber={profile?.phone_number ?? ""}
          initialFullName={profile?.full_name ?? ""}
        />
      </div>
    </main>
  )
}

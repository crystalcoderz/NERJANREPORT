import { TopBar } from "@/components/dashboard/top-bar"
import { StatCards } from "@/components/dashboard/stat-cards"
import { RouteMap } from "@/components/dashboard/route-map"
import { WeatherPanel } from "@/components/dashboard/weather-panel"
import { RecommendedRoute } from "@/components/dashboard/recommended-route"
import { OtherRoutes } from "@/components/dashboard/other-routes"
import { UpcomingShipments } from "@/components/dashboard/upcoming-shipments"
import { WeatherAlerts } from "@/components/dashboard/weather-alerts"
import { NewsUpdates } from "@/components/dashboard/news-updates"
import { FieldReportsPanel } from "@/components/dashboard/field-reports-panel"
import { ActiveTripsPanel } from "@/components/dashboard/active-trips-panel"
import { IncidentMonitor } from "@/components/dashboard/incident-monitor"
import { RouteProvider } from "@/components/dashboard/route-context"
import { UserMenu } from "@/components/dashboard/user-menu"
import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  const now = new Date()
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
    : { data: null }

  return (
    <main className="min-h-screen bg-background">
      <IncidentMonitor />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
        <div className="flex items-center justify-end gap-3">
          <p className="text-xs font-medium text-muted-foreground">{dateLabel}</p>
          <UserMenu email={user?.email ?? null} />
        </div>

        <TopBar userEmail={user?.email ?? null} displayName={profile?.full_name ?? null} />

        <RouteProvider>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="flex flex-col gap-5 lg:col-span-2">
              <StatCards />
              <RouteMap />
            </div>
            <div className="flex flex-col gap-5">
              <WeatherPanel />
              <RecommendedRoute />
              <OtherRoutes />
            </div>
          </div>
        </RouteProvider>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <UpcomingShipments />
          <ActiveTripsPanel />
          <WeatherAlerts />
          <NewsUpdates />
          <FieldReportsPanel />
        </div>
      </div>
    </main>
  )
}

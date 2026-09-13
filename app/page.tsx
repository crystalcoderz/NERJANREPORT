import { OpsTicker } from "@/components/dashboard/ops-ticker"
import { TopBar } from "@/components/dashboard/top-bar"
import { StatCards } from "@/components/dashboard/stat-cards"
import { RouteMap } from "@/components/dashboard/route-map"
import { WeatherPanel } from "@/components/dashboard/weather-panel"
import { EnvironmentalPanel } from "@/components/dashboard/environmental-panel"
import { RecommendedRoute } from "@/components/dashboard/recommended-route"
import { OtherRoutes } from "@/components/dashboard/other-routes"
import { UpcomingShipments } from "@/components/dashboard/upcoming-shipments"
import { WeatherAlerts } from "@/components/dashboard/weather-alerts"
import { NewsUpdates } from "@/components/dashboard/news-updates"
import { FieldReportsPanel } from "@/components/dashboard/field-reports-panel"
import { ActiveTripsPanel } from "@/components/dashboard/active-trips-panel"
import { IncidentMonitor } from "@/components/dashboard/incident-monitor"
import { RouteProvider } from "@/components/dashboard/route-context"
import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
    : { data: null }

  return (
    <main className="min-h-screen bg-background bg-grid">
      <IncidentMonitor />
      <OpsTicker />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
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
          <EnvironmentalPanel />
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

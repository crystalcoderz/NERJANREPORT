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

export default function Page() {
  const now = new Date()
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  return (
    <main className="min-h-screen bg-background">
      <IncidentMonitor />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              NL
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-foreground">NER LogiSense</p>
              <p className="text-[11px] leading-tight text-muted-foreground">Logistics Intelligence</p>
            </div>
          </div>
          <p className="shrink-0 text-xs font-medium text-muted-foreground">{dateLabel}</p>
        </div>

        <TopBar />

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

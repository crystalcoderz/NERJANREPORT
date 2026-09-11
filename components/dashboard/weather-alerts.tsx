import { CloudRain, Mountain, CloudFog, Waves, Wind } from "lucide-react"
import { cn } from "@/lib/utils"
import { weatherAlerts } from "@/lib/data"
import { Panel, PanelHeader } from "./panel"

const kindIcons = {
  rain: CloudRain,
  landslide: Mountain,
  fog: CloudFog,
  flood: Waves,
  wind: Wind,
}

const levelStyles = {
  high: "bg-risk-high-bg text-risk-high",
  moderate: "bg-risk-moderate-bg text-risk-moderate",
  low: "bg-risk-low-bg text-risk-low",
}

export function WeatherAlerts() {
  return (
    <Panel>
      <PanelHeader
        title="Weather Alerts"
        count={weatherAlerts.length}
        action={
          <button type="button" className="text-xs font-medium text-info hover:underline">
            View All
          </button>
        }
      />
      <ul className="flex flex-col">
        {weatherAlerts.slice(0, 5).map((a) => {
          const Icon = kindIcons[a.kind]
          return (
            <li key={a.id} className="flex items-center gap-3 border-t border-border px-4 py-3">
              <span className={cn("flex size-9 items-center justify-center rounded-lg", levelStyles[a.level])}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{a.place}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{a.eta}</span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

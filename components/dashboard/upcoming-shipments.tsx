import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { shipments, type ShipmentStatus } from "@/lib/data"
import { Panel, PanelHeader } from "./panel"

const statusStyles: Record<ShipmentStatus, string> = {
  "In Transit": "bg-risk-low-bg text-risk-low",
  Scheduled: "bg-info-bg text-info",
  Delayed: "bg-risk-high-bg text-risk-high",
}

export function UpcomingShipments() {
  return (
    <Panel>
      <PanelHeader
        title="Upcoming Shipments"
        action={
          <button type="button" className="text-xs font-medium text-info hover:underline">
            View All
          </button>
        }
      />
      <ul className="flex flex-col">
        {shipments.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between border-t border-border px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs font-medium text-muted-foreground">{s.id}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                {s.from}
                <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                {s.to}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                statusStyles[s.status],
              )}
            >
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

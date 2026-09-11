import { Route } from "lucide-react"
import { otherRoutes } from "@/lib/data"
import { RiskBadge } from "./risk-badge"
import { Panel, PanelHeader } from "./panel"

export function OtherRoutes() {
  return (
    <Panel>
      <PanelHeader
        title="Other Routes"
        action={
          <button type="button" className="text-xs font-medium text-info hover:underline">
            View All
          </button>
        }
      />
      <ul className="flex flex-col">
        {otherRoutes.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between border-t border-border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Route className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.distanceKm} km · {r.etaLabel}
                </p>
              </div>
            </div>
            <RiskBadge level={r.risk} />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

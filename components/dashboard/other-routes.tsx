"use client"

import { Route, Check } from "lucide-react"
import { RiskBadge } from "./risk-badge"
import { Panel, PanelHeader } from "./panel"
import { useRoute } from "./route-context"

export function OtherRoutes() {
  const { routes, selectedIndex, setSelectedIndex, status } = useRoute()

  const alternatives = routes.map((r, i) => ({ ...r, index: i })).filter((r) => r.index !== selectedIndex)

  return (
    <Panel>
      <PanelHeader
        title="Other Routes"
        action={
          <span className="text-xs font-medium text-muted-foreground">
            {routes.length > 1 ? `${routes.length} found` : ""}
          </span>
        }
      />
      {status === "computing" ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">Finding alternative routes...</p>
      ) : alternatives.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No alternative routes for this corridor.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {alternatives.map((r) => (
            <li key={r.index}>
              <button
                type="button"
                onClick={() => setSelectedIndex(r.index)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <Route className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.distanceKm} km · {r.etaLabel}
                    </p>
                  </div>
                </div>
                <RiskBadge level={r.risk} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {routes.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <Check className="size-3.5 text-risk-low" />
          Showing best route on map · tap an alternative to compare
        </div>
      )}
    </Panel>
  )
}

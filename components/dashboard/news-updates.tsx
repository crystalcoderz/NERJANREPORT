import { Newspaper } from "lucide-react"
import { news } from "@/lib/data"
import { Panel, PanelHeader } from "./panel"

export function NewsUpdates() {
  return (
    <Panel>
      <PanelHeader
        title="News & Updates"
        action={
          <button type="button" className="text-xs font-medium text-info hover:underline">
            View All
          </button>
        }
      />
      <ul className="flex flex-col">
        {news.map((n) => (
          <li key={n.id} className="flex items-start gap-3 border-t border-border px-4 py-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Newspaper className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-foreground text-pretty">{n.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.date}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

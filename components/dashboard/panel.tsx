import { cn } from "@/lib/utils"

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-md border border-border bg-card", className)}>{children}</div>
}

export function PanelHeader({
  title,
  count,
  action,
}: {
  title: string
  count?: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
      <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
        {typeof count === "number" && <span className="text-foreground/70"> · {count}</span>}
      </h3>
      {action}
    </div>
  )
}

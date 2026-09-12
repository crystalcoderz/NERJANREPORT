import { cn } from "@/lib/utils"

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>{children}</div>
  )
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
    <div className="flex items-center justify-between px-4 pt-4 pb-3">
      <h3 className="text-sm font-semibold text-card-foreground">
        {title}
        {typeof count === "number" && <span className="text-muted-foreground"> ({count})</span>}
      </h3>
      {action}
    </div>
  )
}

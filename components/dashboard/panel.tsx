import { cn } from "@/lib/utils"

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {children}
    </div>
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
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        {typeof count === "number" && (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
            {count}
          </span>
        )}
      </h3>
      {action}
    </div>
  )
}

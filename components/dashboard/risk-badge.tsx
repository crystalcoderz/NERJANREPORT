import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/data"

const styles: Record<RiskLevel, { label: string; className: string }> = {
  low: { label: "Low Risk", className: "bg-risk-low-bg text-risk-low" },
  moderate: { label: "Moderate Risk", className: "bg-risk-moderate-bg text-risk-moderate" },
  high: { label: "High Risk", className: "bg-risk-high-bg text-risk-high" },
}

export function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  const s = styles[level]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        s.className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label ?? s.label}
    </span>
  )
}

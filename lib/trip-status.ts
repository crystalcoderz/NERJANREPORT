import type { Trip } from "@/app/api/trips/route"

export type DerivedTripStatus = "Scheduled" | "In Transit" | "Overdue" | "Completed"

export function deriveTripStatus(trip: Trip): { label: DerivedTripStatus; className: string } {
  const now = Date.now()
  const dep = new Date(trip.departure_time).getTime()
  const eta = new Date(trip.eta).getTime()

  if (trip.status === "completed") return { label: "Completed", className: "bg-secondary text-muted-foreground" }
  if (now < dep) return { label: "Scheduled", className: "bg-info-bg text-info" }
  if (now >= dep && now < eta) return { label: "In Transit", className: "bg-risk-low-bg text-risk-low" }
  return { label: "Overdue", className: "bg-risk-high-bg text-risk-high" }
}

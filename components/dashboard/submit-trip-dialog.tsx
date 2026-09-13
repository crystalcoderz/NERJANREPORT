"use client"

import { useMemo, useState } from "react"
import useSWRMutation from "swr/mutation"
import { CalendarClock, Loader2, Send, TriangleAlert, UserRound } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { drivers, type RiskLevel } from "@/lib/data"
import { formatEta } from "./route-context"

type SubmitTripDialogProps = {
  origin: string
  destination: string
  waypoints: string[]
  distanceKm: number
  durationMin: number
  risk: RiskLevel
  onSubmitted: () => void
}

function nowPlusMinutesLocal(min: number) {
  const d = new Date(Date.now() + min * 60_000)
  d.setSeconds(0, 0)
  // Format for <input type="datetime-local"> in local time.
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

async function createTrip(url: string, { arg }: { arg: Record<string, unknown> }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Failed to submit trip")
  return json as { matchedReports: { id: string; location_name: string; severity: string }[] }
}

export function SubmitTripDialog({
  origin,
  destination,
  waypoints,
  distanceKm,
  durationMin,
  risk,
  onSubmitted,
}: SubmitTripDialogProps) {
  const [open, setOpen] = useState(false)
  const [driverId, setDriverId] = useState("")
  const [departure, setDeparture] = useState(() => nowPlusMinutesLocal(15))
  const [notes, setNotes] = useState("")

  const { trigger, isMutating } = useSWRMutation("/api/trips", createTrip)

  const etaPreview = useMemo(() => {
    if (!departure) return null
    const dep = new Date(departure)
    if (Number.isNaN(dep.getTime())) return null
    return new Date(dep.getTime() + durationMin * 60_000)
  }, [departure, durationMin])

  const driver = drivers.find((d) => d.id === driverId)

  const handleSubmit = async () => {
    if (!driver) {
      toast.error("Select a driver to assign this trip.")
      return
    }
    if (!departure) {
      toast.error("Choose a departure time.")
      return
    }
    try {
      const result = await trigger({
        origin,
        destination,
        waypoints,
        assigned_to: driver.name,
        distance_km: distanceKm,
        duration_min: durationMin,
        risk_level: risk,
        departure_time: new Date(departure).toISOString(),
        notes: notes.trim() || undefined,
      })

      const matchCount = result.matchedReports?.length ?? 0
      toast.success(`Trip assigned to ${driver.name}`, {
        description:
          matchCount > 0
            ? `${matchCount} active field report${matchCount > 1 ? "s" : ""} found on this corridor.`
            : "No active field reports on this corridor right now.",
      })
      setOpen(false)
      setNotes("")
      setDriverId("")
      onSubmitted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit trip")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Send className="size-3.5" />
        Submit &amp; Assign Trip
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit &amp; assign this route</DialogTitle>
          <DialogDescription>
            {origin} {waypoints.length > 0 ? `→ ${waypoints.join(" → ")} → ` : "→ "}
            {destination} · {distanceKm} km · {formatEta(durationMin)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="driver">
              <UserRound className="size-3.5" />
              Assign to
            </Label>
            <Select value={driverId} onValueChange={(value) => setDriverId(value ?? "")}>
              <SelectTrigger id="driver" className="w-full">
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {d.vehicle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="departure">
              <CalendarClock className="size-3.5" />
              Departure time
            </Label>
            <input
              id="departure"
              type="datetime-local"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {etaPreview && (
              <p className="text-xs text-muted-foreground">
                Estimated arrival: {etaPreview.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Cargo details, special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {risk === "high" && (
            <div className="flex items-start gap-2 rounded-lg bg-risk-high-bg p-2.5 text-xs text-risk-high">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              This corridor is currently flagged high risk. Field reports for this route will be attached automatically.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isMutating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isMutating} className="gap-1.5">
            {isMutating && <Loader2 className="size-3.5 animate-spin" />}
            Confirm &amp; Sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

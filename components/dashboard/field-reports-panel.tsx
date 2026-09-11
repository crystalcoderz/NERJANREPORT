"use client"

import { useState } from "react"
import useSWR from "swr"
import { AlertTriangle, Loader2, MapPin, Plus, Radio, Sparkles, User } from "lucide-react"
import { Panel, PanelHeader } from "@/components/dashboard/panel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { FieldReport } from "@/app/api/field-reports/route"
import type { LiveIncident } from "@/app/api/incidents/route"

const REPORT_TYPE_LABELS: Record<FieldReport["report_type"], string> = {
  road_block: "Road Block",
  accident: "Accident",
  flooding: "Flooding",
  landslide: "Landslide",
  checkpoint: "Checkpoint Delay",
  breakdown: "Vehicle Breakdown",
  other: "Other",
}

const SEVERITY_STYLES: Record<FieldReport["severity"], { label: string; className: string }> = {
  low: { label: "Low", className: "bg-risk-low-bg text-risk-low" },
  medium: { label: "Medium", className: "bg-risk-moderate-bg text-risk-moderate" },
  high: { label: "High", className: "bg-risk-high-bg text-risk-high" },
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function FieldReportsPanel() {
  const { data, isLoading, mutate } = useSWR<{ reports: FieldReport[] }>("/api/field-reports", fetcher, {
    refreshInterval: 15000,
  })
  const { data: incidentData } = useSWR<{ source: string; incidents: LiveIncident[] }>(
    "/api/incidents",
    fetcher,
    { refreshInterval: 20000 },
  )
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reports = data?.reports ?? []
  const activeCount = reports.filter((r) => r.status === "active").length

  const liveIncidents = incidentData?.incidents ?? []
  const aiIncidents = liveIncidents.filter((i) => i.source === "ai")
  const latestSync = aiIncidents[0]

  function isReflectedInAiMonitor(report: FieldReport) {
    if (!report.corridor) return false
    return aiIncidents.some((inc) => inc.corridor.toLowerCase() === report.corridor?.toLowerCase())
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)

    const payload = {
      report_type: formData.get("report_type"),
      severity: formData.get("severity"),
      location_name: formData.get("location_name"),
      corridor: formData.get("corridor"),
      description: formData.get("description"),
      reporter_name: formData.get("reporter_name"),
    }

    try {
      const res = await fetch("/api/field-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to submit report")
        return
      }
      await mutate()
      setOpen(false)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Field Reports"
        count={activeCount}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 text-xs">
                <Plus className="size-3.5" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Submit Field Report</DialogTitle>
                <DialogDescription>
                  Log a road condition or incident. This feeds directly into the route risk analysis.
                </DialogDescription>
              </DialogHeader>
              <form
                action={handleSubmit}
                className="flex flex-col gap-4"
                onSubmit={() => setError(null)}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="report_type">Type</Label>
                    <Select name="report_type" defaultValue="road_block" required>
                      <SelectTrigger id="report_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="severity">Severity</Label>
                    <Select name="severity" defaultValue="medium" required>
                      <SelectTrigger id="severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="location_name">Location</Label>
                  <Input id="location_name" name="location_name" placeholder="e.g. NH6, 12km before Nongpoh" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="corridor">Corridor (optional)</Label>
                  <Input id="corridor" name="corridor" placeholder="e.g. Guwahati to Shillong" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe what you're seeing on the ground..."
                    rows={3}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reporter_name">Your name</Label>
                  <Input id="reporter_name" name="reporter_name" placeholder="Field Agent" />
                </div>
                {error && <p className="text-xs font-medium text-destructive">{error}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={submitting} className="gap-1.5">
                    {submitting && <Loader2 className="size-3.5 animate-spin" />}
                    Submit Report
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex items-center gap-1.5 border-b border-border px-4 pb-3 text-[11px] text-muted-foreground">
        <Sparkles className="size-3 shrink-0 text-primary" />
        {latestSync ? (
          <span>
            AI monitor synced {timeAgo(latestSync.created_at)} via {latestSync.model ?? "AI"}
          </span>
        ) : (
          <span>AI monitor warming up...</span>
        )}
      </div>

      <ScrollArea className="h-[280px] px-4">
        <div className="flex flex-col gap-3 pb-4 pt-3">
          {isLoading && (
            <p className="flex items-center gap-2 py-6 text-center text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading reports...
            </p>
          )}
          {!isLoading && reports.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Radio className="size-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No field reports yet. Drivers can log incidents here.</p>
            </div>
          )}
          {reports.map((report) => {
            const severity = SEVERITY_STYLES[report.severity]
            const reflected = isReflectedInAiMonitor(report)
            return (
              <div
                key={report.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className={cn("size-3.5", severity.className.split(" ")[1])} />
                    <span className="text-xs font-semibold text-card-foreground">
                      {REPORT_TYPE_LABELS[report.report_type]}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {reflected && (
                      <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Sparkles className="size-2.5" />
                        In AI monitor
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        severity.className,
                      )}
                    >
                      {severity.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-card-foreground">{report.description}</p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">
                      {report.location_name}
                      {report.corridor ? ` · ${report.corridor}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0">{timeAgo(report.created_at)}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <User className="size-3" />
                  {report.reporter_name}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </Panel>
  )
}

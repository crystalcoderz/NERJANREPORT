"use client"

import { useState } from "react"
import { MessageCircle, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function WhatsAppLinkCard({
  initialPhoneNumber,
  initialFullName,
}: {
  initialPhoneNumber: string
  initialFullName: string
}) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber)
  const [fullName, setFullName] = useState(initialFullName)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isLinked = initialPhoneNumber.length > 0

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch("/api/profile/link-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, fullName }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error ?? "Could not link this number")
        return
      }
      setSaved(true)
    } catch {
      setError("Network error — please try again")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageCircle className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">WhatsApp assignments</h2>
          <p className="text-sm text-muted-foreground">
            Link your WhatsApp number to create trip assignments by messaging the Jan Report bot. Say
            &quot;hi&quot; to it to get started once linked.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Prayaas Maurya"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phoneNumber">WhatsApp number (with country code)</Label>
          <Input
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g. 919876543210"
            inputMode="numeric"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && !error && (
          <p className="flex items-center gap-1.5 text-sm text-risk-low">
            <Check className="size-4" /> Number linked. Message the bot on WhatsApp to try it.
          </p>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="w-fit">
          {isSaving ? "Saving..." : isLinked ? "Update number" : "Link number"}
        </Button>
      </div>
    </div>
  )
}

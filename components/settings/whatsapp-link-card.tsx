"use client"

import { useState } from "react"
import { MessageCircle, Check, Loader2, ExternalLink } from "lucide-react"
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

  const [linkedPhone, setLinkedPhone] = useState(initialPhoneNumber)
  const isLinked = linkedPhone.length > 0
  const normalizedPhone = phoneNumber.replace(/[^\d]/g, "")
  const validPhone = /^[1-9]\d{9,14}$/.test(normalizedPhone)

  const handleSave = async () => {
    if (isSaving || !validPhone) return
    setIsSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch("/api/profile/link-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalizedPhone, fullName }),
        signal: AbortSignal.timeout(15000),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.error ?? "Could not link this number")
        return
      }
      setLinkedPhone(normalizedPhone)
      setPhoneNumber(normalizedPhone)
      setSaved(true)
    } catch {
      setError("Network error - please try again")
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

      <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleSave() }}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setSaved(false) }}
            autoComplete="name"
            disabled={isSaving}
            maxLength={100}
            placeholder="e.g. Prayaas Maurya"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phoneNumber">WhatsApp number (with country code)</Label>
          <Input
            id="phoneNumber"
            value={phoneNumber}
            onChange={(e) => { setPhoneNumber(e.target.value); setSaved(false); setError(null) }}
            type="tel"
            autoComplete="tel"
            disabled={isSaving}
            aria-describedby="whatsapp-phone-hint"
            placeholder="e.g. 919876543210"
            inputMode="tel"
          />
        </div>

        <p id="whatsapp-phone-hint" className="text-xs text-muted-foreground">Include the country code, for example +91. Use 10–15 digits.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {saved && !error && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-risk-low">
            <Check className="size-4" /> Number linked. Message the bot on WhatsApp to try it.
          </p>
        )}

        <Button type="submit" disabled={isSaving || !validPhone} className="w-fit">
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          {isSaving ? "Saving..." : isLinked ? "Update number" : "Link number"}
        </Button>
        {isLinked && (
          <a href="https://wa.me/447344643473?text=hi" target="_blank" rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">
            <MessageCircle className="size-4" /> Open WhatsApp <ExternalLink className="size-3" />
          </a>
        )}
        <p className="text-xs text-muted-foreground">Create a trip, choose your vehicle and departure time, then review and confirm in WhatsApp. Choose Send route map for an optional Google Maps image with your route and locations. Type help for guidance or cancel to discard a draft.</p>
      </form>
    </div>
  )
}

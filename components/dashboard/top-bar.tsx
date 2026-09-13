import Link from "next/link"
import { Search, Settings, Satellite } from "lucide-react"
import { UserMenu } from "./user-menu"
import { NotificationBell } from "./notification-bell"

function getGreetingName(email: string | null | undefined) {
  if (!email) return "there"
  const localPart = email.split("@")[0]
  const cleaned = localPart.replace(/[._-]+/g, " ").trim()
  if (!cleaned) return "there"
  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good Morning"
  if (hour < 17) return "Good Afternoon"
  return "Good Evening"
}

export function TopBar({
  userEmail,
  displayName,
}: {
  userEmail?: string | null
  displayName?: string | null
}) {
  const name = displayName?.trim() || getGreetingName(userEmail)

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">
          Dispatch Overview
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {getTimeOfDayGreeting()}, {name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s the latest on the North Eastern Region logistics network.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search location, route, or shipment..."
            className="h-10 w-72 rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <NotificationBell />

        <Link
          href="/satellite"
          aria-label="Open Satellite Command Center"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Satellite className="size-4" />
          <span className="hidden sm:inline">Satellite View</span>
        </Link>

        <Link
          href="/settings"
          aria-label="Settings"
          className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="size-5" />
        </Link>

        <UserMenu email={userEmail ?? null} name={name} />
      </div>
    </header>
  )
}

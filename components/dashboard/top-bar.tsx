import { Bell, Search, ChevronDown } from "lucide-react"

export function TopBar() {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Good Morning, Arjun
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

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="size-5" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-risk-high ring-2 ring-card" />
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            A
          </span>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium leading-tight text-foreground">Arjun Barua</p>
            <p className="text-xs leading-tight text-muted-foreground">Regional Officer</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  )
}

import { Search, Bell } from "lucide-react"

export function TopBar() {
  return (
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-risk-low opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-risk-low" />
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Network Online
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Northeast Corridor Network</h1>
        <p className="text-sm text-muted-foreground">
          Route risk, weather, and dispatch status across the region — updated live.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search location, route, or shipment"
            className="h-9 w-64 rounded-md border border-border bg-secondary/60 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring/50"
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-md border border-border bg-secondary/60 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-risk-high" />
        </button>

        <div className="hidden items-center gap-2 rounded-md border border-border bg-secondary/60 py-1.5 pl-1.5 pr-3 sm:flex">
          <span className="flex size-7 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
            A
          </span>
          <div className="text-left">
            <p className="text-xs font-medium leading-tight text-foreground">Arjun Barua</p>
            <p className="font-mono text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
              Regional Officer
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}

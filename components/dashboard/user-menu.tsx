"use client"

import { ChevronDown, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

export function UserMenu({ email, name }: { email: string | null; name?: string | null }) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (!email) return null

  const label = name?.trim() || email
  const initial = label.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-2.5 text-sm transition-colors hover:bg-secondary/60">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </span>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium leading-tight text-foreground">{label}</p>
          <p className="text-xs leading-tight text-muted-foreground">{email}</p>
        </div>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut} className="gap-2 text-destructive">
          <LogOut className="size-4" />
          {isSigningOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

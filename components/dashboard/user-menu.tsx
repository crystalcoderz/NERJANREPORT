"use client"

import { LogOut, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

export function UserMenu({ email }: { email: string | null }) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (!email) return null

  const handleSignOut = async () => {
    setIsSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 rounded-full px-2.5 text-xs">
          <span className="flex size-5 items-center justify-center rounded-full bg-muted">
            <User className="size-3 text-muted-foreground" />
          </span>
          <span className="hidden max-w-[140px] truncate sm:inline">{email}</span>
        </Button>
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

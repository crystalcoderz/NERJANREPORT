"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Supabase does not reveal whether an email is already registered, so the
// fallback stays generic. Validation failures describe the user's own input and
// are not an enumeration oracle, so surface them.
function signUpErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }

  if (code === "weak_password") {
    return "Please choose a stronger password."
  }
  if (code === "email_address_invalid") {
    return "Please use a real email address — example and test domains are not supported."
  }
  if (code === "email_address_not_authorized") {
    return "We cannot send confirmation email to that address. Please use a different one."
  }
  if (code === "validation_failed") {
    return "Please check the details you entered."
  }
  if (code === "over_email_send_rate_limit" || status === 429) {
    return "Too many attempts. Please wait a moment and try again."
  }
  return "Unable to complete sign-up. Please try again."
}

export default function Page() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      router.push("/auth/sign-up-success")
    } catch (error: unknown) {
      console.error("Sign-up error:", error)
      setError(signUpErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            JR
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-foreground">Jan Report</p>
            <p className="text-[11px] leading-tight text-muted-foreground">Logistics Intelligence</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription>Sign up with your email to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="repeat-password">Repeat password</Label>
                  <Input
                    id="repeat-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Sign up"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/auth/login" className="font-medium text-primary underline underline-offset-4">
                  Sign in
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

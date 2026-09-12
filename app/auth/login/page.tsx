"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function LoginForm() {
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/"

  const REQUEST_TIMEOUT_MS = 20_000

  const postJson = async (url: string, body: Record<string, string>) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.")
      return data
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("The request timed out. Check your connection and try again.")
      }
      if (err instanceof TypeError) {
        throw new Error("Network error. Check your connection and try again.")
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await postJson("/api/auth/send-otp", { email })
      setStep("code")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await postJson("/api/auth/verify-otp", { email, code })
      // Use a hard navigation instead of router.push/refresh so the new session
      // cookie is guaranteed to be picked up on the next request.
      window.location.assign(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
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
          {step === "email" ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">Sign in</CardTitle>
                <CardDescription>Enter your email and we&apos;ll send you a one-time code</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendCode}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Sending code..." : "Send code"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">Enter your code</CardTitle>
                <CardDescription>We sent a 6-digit code to {email}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyCode}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="code">Code</Label>
                      <Input
                        id="code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="123456"
                        required
                        autoComplete="one-time-code"
                        autoFocus
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        className="text-center text-lg tracking-[0.3em]"
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
                      {isLoading ? "Verifying..." : "Verify and sign in"}
                    </Button>
                  </div>
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-4"
                      onClick={() => {
                        setStep("email")
                        setCode("")
                        setError(null)
                      }}
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

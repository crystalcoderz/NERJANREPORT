import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams
  const code = params?.error
  const isErrorCode = typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code)

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sorry, something went wrong.</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {isErrorCode ? (
              <p className="text-sm text-muted-foreground">Code error: {code}</p>
            ) : (
              <p className="text-sm text-muted-foreground">An unspecified error occurred.</p>
            )}
            <Link href="/auth/login" className="text-sm font-medium text-primary underline underline-offset-4">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

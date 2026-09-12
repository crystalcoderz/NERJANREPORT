import { redirect } from "next/navigation"

// Sign-up and sign-in are the same email + one-time-code flow — the code
// endpoint creates the account on first use, so this route just forwards there.
export default function Page() {
  redirect("/auth/login")
}

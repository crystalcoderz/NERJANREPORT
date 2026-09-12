const RESEND_API_URL = "https://api.resend.com/emails"
const FROM_ADDRESS = "Jan Report <otp@nerjanreport.xyz>"

export async function sendOtpEmail(email: string, code: string) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [email],
      subject: `${code} is your Jan Report sign-in code`,
      html: otpEmailHtml(code),
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend request failed (${response.status}): ${body}`)
  }

  return response.json() as Promise<{ id: string }>
}

function otpEmailHtml(code: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#0a0a0a; padding:32px; color:#f5f5f5;">
      <div style="max-width:420px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:12px; padding:32px;">
        <p style="font-size:13px; letter-spacing:0.08em; text-transform:uppercase; color:#8b8b8b; margin:0 0 8px;">Jan Report</p>
        <h1 style="font-size:20px; margin:0 0 16px; color:#f5f5f5;">Your sign-in code</h1>
        <p style="font-size:14px; color:#b3b3b3; margin:0 0 24px; line-height:1.5;">
          Enter this code to sign in to Jan Report. It expires in 10 minutes.
        </p>
        <div style="font-size:32px; font-weight:700; letter-spacing:0.15em; text-align:center; padding:16px 0; background:#1f1f1f; border-radius:8px; color:#ffffff;">
          ${code}
        </div>
        <p style="font-size:12px; color:#6b6b6b; margin:24px 0 0; line-height:1.5;">
          If you didn&#39;t request this code, you can safely ignore this email.
        </p>
      </div>
    </div>
  `
}

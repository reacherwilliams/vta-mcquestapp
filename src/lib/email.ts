import "server-only"
import { Resend } from "resend"

// Single Resend client + sender identity for all transactional mail.
const FROM = "MCQ MasterLoop <noreply@mcq-masterloop.com>"
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/** Canonical app origin (no trailing slash) for links inside emails. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://mcq-masterloop.com").replace(/\/$/, "")
}

/**
 * Send a transactional email. If RESEND_API_KEY is not configured (e.g. local
 * dev before the domain is set up), the email is logged instead of sent so
 * flows still work end-to-end — the caller never sees a hard failure.
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${to} (subject: "${subject}")`)
    return { sent: false as const }
  }
  await resend.emails.send({ from: FROM, to, subject, html })
  return { sent: true as const }
}

/** Password-reset email — used by the forgot-password flow. */
export function passwordResetEmail(firstName: string, resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Reset your MCQ MasterLoop password",
    html: `
      <p>Hi ${firstName || "there"},</p>
      <p>We received a request to reset your MCQ MasterLoop password. Click below to choose a new one. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="background:#65a30d;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset password →</a></p>
      <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <p>— The MCQ MasterLoop team</p>
      <hr/>
      <p style="font-size:11px;color:#888">If the button doesn't work, paste this link into your browser:<br/>${resetUrl}</p>
    `,
  }
}

import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createWrongRetrySession } from "@/lib/sessions/practice"

/**
 * GET /api/sessions/wrong-retry-redirect?style=duo&accent=lime
 *
 * Creates a WRONG_RETRY PracticeSession for the current user then issues a
 * 307 redirect to /practice/session/[newSessionId] so the browser lands
 * directly on the retry session without a client-side POST.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const { searchParams } = new URL(req.url)
  const style = searchParams.get("style") ?? "duo"
  const accent = searchParams.get("accent") ?? "lime"

  try {
    const ps = await createWrongRetrySession(session.user.id)
    const dest = `/practice/session/${ps.id}?q=0&wrong=&style=${style}&accent=${accent}`
    return NextResponse.redirect(new URL(dest, req.url), 307)
  } catch (err) {
    // No unresolved wrong answers — go straight to complete
    const dest = `/practice/session/complete?style=${style}&accent=${accent}`
    return NextResponse.redirect(new URL(dest, req.url), 307)
  }
}

import { NextResponse } from "next/server"
import { nextAuthForMiddleware } from "@/lib/auth"
import { isAdminTier } from "@/lib/permissions"

// Routes accessible to everyone (auth or not). Auth pages bounce signed-in
// users back to the dashboard so they don't sit on /login.
const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"]
const alwaysPublicRoutes = [
  "/",
  "/legal",
  "/api/auth",
  "/contact",
  // Entire practice section and profile are open while auth is mocked.
  // Remove "/practice" and "/profile" once real auth (NextAuth signIn) is wired up —
  // sub-routes like /practice/demo and /practice/session can stay public for the demo flow.
  "/practice",
  "/profile",
  "/onboarding",
]

export default nextAuthForMiddleware(function proxy(req) {
  const { pathname } = req.nextUrl

  // Skip static + Next internals.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Canonical origin for redirects — env-pinned so we don't bounce between
  // apex and www (lesson from School-Core).
  const ORIGIN =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.nextUrl.origin

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (req as any).auth
  const isAuthenticated = !!session?.user
  const role = session?.user?.role as string | undefined

  const isAuthRoute = authRoutes.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  )
  const isAlwaysPublic = alwaysPublicRoutes.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  )

  if (isAlwaysPublic) return NextResponse.next()

  // Auth pages: signed-in users go straight to their home.
  if (isAuthRoute) {
    if (isAuthenticated) {
      const dest = isAdminTier(role) ? "/admin" : "/practice"
      return NextResponse.redirect(new URL(dest, ORIGIN))
    }
    return NextResponse.next()
  }

  // Protected routes: bounce unauthenticated users to /login.
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", ORIGIN)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes require admin tier (ADMIN, CO_FOUNDER, or SUPER_ADMIN).
  if (pathname.startsWith("/admin")) {
    if (!isAdminTier(role)) {
      return NextResponse.redirect(new URL("/practice", ORIGIN))
    }
  }

  // Contributor routes require CONTRIBUTOR, ADMIN, or SUPER_ADMIN.
  if (pathname.startsWith("/contribute")) {
    if (role === "STUDENT") {
      return NextResponse.redirect(new URL("/practice", ORIGIN))
    }
  }

  return NextResponse.next()
} as Parameters<typeof nextAuthForMiddleware>[0])

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
}

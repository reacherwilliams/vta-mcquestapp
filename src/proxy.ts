import { NextResponse } from "next/server"
import { nextAuthForMiddleware } from "@/lib/auth"

// Routes accessible to everyone (auth or not). Auth pages bounce signed-in
// users back to the dashboard so they don't sit on /login.
const authRoutes = ["/login", "/register", "/forgot-password", "/reset-password"]
const alwaysPublicRoutes = ["/", "/legal", "/api/auth", "/contact"]

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
      const dest = role === "SUPER_ADMIN" || role === "ADMIN" ? "/admin" : "/practice"
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

  // Admin routes require ADMIN or SUPER_ADMIN.
  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
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

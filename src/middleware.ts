// Next.js routes middleware through the magic filename `middleware.ts`.
// We keep the implementation in src/proxy.ts so the file name says what
// it actually does — this file just re-exports.
export { default } from "./proxy"

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
}

import NextAuth from "next-auth"
import type { Adapter, AdapterUser } from "next-auth/adapters"
import type { UserRole } from "@prisma/client"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { prisma } from "./prisma"

// Bootstrap allowlist — only emails on this list can self-sign-up via
// OAuth. Used until we open public registration. Comma-separated env var.
//   SIGN_IN_ALLOWED_EMAILS="founder@vantagetechapps.com,..."
//   SIGN_IN_ALLOWED_DOMAINS="vantagetechapps.com"   (optional, whole domain)
function isOnBootstrapAllowlist(email: string): boolean {
  const lower = email.toLowerCase().trim()
  const emails = (process.env.SIGN_IN_ALLOWED_EMAILS ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (emails.includes(lower)) return true

  const domain = lower.split("@")[1]
  const domains = (process.env.SIGN_IN_ALLOWED_DOMAINS ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return !!domain && domains.includes(domain)
}

// Our User model has firstName + lastName, not name. Wrap the adapter to
// split the OAuth-provided full name on createUser and synthesize a
// virtual `name` field on reads so the rest of Auth.js sees what it expects.
function buildAdapter(): Adapter {
  const base = PrismaAdapter(prisma)
  const synthesizeName = <T extends { firstName?: string | null; lastName?: string | null } | null>(u: T) =>
    u && { ...u, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null }

  return {
    ...base,
    createUser: async (data: Omit<AdapterUser, "id">) => {
      const fullName = (data.name ?? data.email.split("@")[0] ?? "").trim()
      const parts = fullName.split(/\s+/)
      const firstName = parts[0] || "User"
      const lastName = parts.slice(1).join(" ") || firstName
      const created = await prisma.user.create({
        data: {
          email: data.email,
          firstName,
          lastName,
          image: data.image ?? null,
          emailVerified: data.emailVerified ?? null,
          status: "ACTIVE",
        },
      })
      return {
        id: created.id,
        email: created.email,
        emailVerified: created.emailVerified,
        name: `${created.firstName} ${created.lastName}`.trim(),
        image: created.image,
      }
    },
    getUser: async (id) => synthesizeName(await prisma.user.findUnique({ where: { id } })) as AdapterUser | null,
    getUserByEmail: async (email) => synthesizeName(await prisma.user.findUnique({ where: { email } })) as AdapterUser | null,
    getUserByAccount: async (provider_providerAccountId) => {
      const account = await prisma.account.findUnique({
        where: { provider_providerAccountId },
        include: { user: true },
      })
      return synthesizeName(account?.user ?? null) as AdapterUser | null
    },
  } as Adapter
}

export const { handlers, signIn, signOut, auth: _nextAuth } = NextAuth({
  adapter: buildAdapter(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // Google is optional — enabled ONLY when its credentials are configured.
    // A Google provider with undefined clientId/secret invalidates the whole
    // Auth.js config (the "server configuration" error) and would break
    // email/password sign-in too. China deployments run credentials-only.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Auto-linking by email is dangerous: an attacker controlling a Google
            // account with the same email could sign in as that user without
            // credential verification. Linking must be an explicit, authed action.
            allowDangerousEmailAccountLinking: false,
            authorization: {
              params: {
                access_type: "offline",
                prompt: "consent",
                scope: "openid email profile",
              },
            },
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase()
        if (!email || !credentials?.password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.password) return null
        if (user.status !== "ACTIVE") return null

        const bcrypt = await import("bcryptjs")
        const ok = await bcrypt.compare(credentials.password as string, user.password)
        if (!ok) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials provider already validated in authorize().
      if (account?.type === "credentials") return true

      const email = user?.email?.toLowerCase()
      if (!email) return false

      // Sign-up is closed by default — only emails on the bootstrap allowlist
      // can create a fresh account via OAuth. Existing users always pass
      // (status check in jwt callback handles suspended accounts).
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, status: true },
      })
      if (existing) {
        if (existing.status === "SUSPENDED" || existing.status === "DELETED") {
          return "/login?error=AccessDenied"
        }
        return true
      }
      if (isOnBootstrapAllowlist(email)) return true
      return "/login?error=AccessDenied"
    },
    async jwt({ token, user, account, trigger }) {
      // Create UserSession on first login so we can revoke later.
      if (user && !token.sid) {
        try {
          const created = await prisma.userSession.create({
            data: {
              userId: user.id as string,
              provider: account?.provider ?? null,
            },
            select: { id: true },
          })
          token.sid = created.id
        } catch (err) {
          console.warn("UserSession.create failed (non-fatal):", (err as Error).message)
        }
      } else if (token.sid) {
        try {
          const row = await prisma.userSession.findUnique({
            where: { id: token.sid as string },
            select: { revokedAt: true, mfaVerifiedAt: true, lastSeenAt: true },
          })
          if (row?.revokedAt) return null as unknown as typeof token
          if (row?.mfaVerifiedAt) token.mfaVerified = true
          const SEEN_THROTTLE_MS = 5 * 60 * 1000
          if (row && Date.now() - row.lastSeenAt.getTime() > SEEN_THROTTLE_MS) {
            await prisma.userSession.update({
              where: { id: token.sid as string },
              data: { lastSeenAt: new Date() },
            }).catch(() => { /* non-fatal */ })
          }
        } catch (err) {
          console.warn("UserSession check failed (allowing through):", (err as Error).message)
        }
      }

      // Enrich on initial sign-in OR every 15 min to pick up role changes.
      const TOKEN_REFRESH_INTERVAL_MS = 15 * 60 * 1000
      const lastEnriched = token.enrichedAt as number | undefined
      const needsEnrichment = !!user || trigger === "update" || !lastEnriched || Date.now() - lastEnriched > TOKEN_REFRESH_INTERVAL_MS

      if (needsEnrichment) {
        const userId = user?.id ?? (token.id as string)
        if (userId) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                image: true,
                mfaEnabled: true,
              },
            })
            if (dbUser) {
              token.id = dbUser.id
              token.email = dbUser.email
              token.firstName = dbUser.firstName
              token.lastName = dbUser.lastName
              token.role = dbUser.role
              token.image = dbUser.image
              token.mfaEnabled = dbUser.mfaEnabled
              if (user) {
                token.mfaVerified = !dbUser.mfaEnabled
              } else if (!dbUser.mfaEnabled) {
                token.mfaVerified = true
              }
              token.enrichedAt = Date.now()
            }
          } catch (err) {
            console.warn("JWT enrichment skipped (DB unavailable):", (err as Error).message)
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
        session.user.role = token.role as UserRole
        session.user.image = token.image as string | null
        session.user.sid = (token.sid as string | undefined) ?? null
        session.user.mfaEnabled = (token.mfaEnabled as boolean | undefined) ?? false
        session.user.mfaVerified = (token.mfaVerified as boolean | undefined) ?? false
      }
      return session
    },
  },
})

// Public entrypoints used elsewhere in the app.
export const auth = _nextAuth
export { _nextAuth as nextAuthForMiddleware }

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      firstName: string
      lastName: string
      role: UserRole
      image: string | null
      sid: string | null
      mfaEnabled: boolean
      mfaVerified: boolean
    }
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string
    firstName: string
    lastName: string
    role: UserRole
    enrichedAt?: number
    sid?: string
    mfaEnabled?: boolean
    mfaVerified?: boolean
  }
}

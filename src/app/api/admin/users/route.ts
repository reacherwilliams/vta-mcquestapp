import "server-only"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { canGrantRole } from "@/lib/permissions"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

const VALID_ROLES = ["SUPER_ADMIN", "CO_FOUNDER", "ADMIN", "CONTRIBUTOR", "STUDENT"] as const
type Role = (typeof VALID_ROLES)[number]

// Random 14-char temp password — letters + digits, no ambiguous chars (0/O, 1/l)
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let out = ""
  const arr = new Uint8Array(14)
  crypto.getRandomValues(arr)
  for (const n of arr) out += chars[n % chars.length]
  return out
}

export async function GET(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const role = searchParams.get("role") ?? ""
  const status = searchParams.get("status") ?? ""
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const limit = 30

  const where = {
    ...(q ? {
      OR: [
        { email: { contains: q, mode: "insensitive" as const } },
        { firstName: { contains: q, mode: "insensitive" as const } },
        { lastName: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
    ...(role ? { role: role as "SUPER_ADMIN" | "CO_FOUNDER" | "ADMIN" | "CONTRIBUTOR" | "STUDENT" } : {}),
    ...(status ? { status: status as "ACTIVE" | "PENDING" | "SUSPENDED" | "DELETED" } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, emailVerified: true,
        createdAt: true, lastLoginAt: true,
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) })
}

// POST /api/admin/users
// Body: { firstName, lastName, email, role }
// Creates a user with the chosen role + a random temp password. Returns the
// plaintext password ONCE so the SA can share it out-of-band — it is hashed
// before storage and never logged.
//
// Permission rules:
//   - ADMIN can create STUDENT or CONTRIBUTOR
//   - SUPER_ADMIN can create any role
// Privilege-escalation gate: promoting to ADMIN or SUPER_ADMIN requires SA.
export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  const actorRole = session!.user!.role as string

  const body = await req.json()
  const firstName = (body.firstName as string | undefined)?.trim()
  const lastName  = (body.lastName  as string | undefined)?.trim()
  const email     = (body.email     as string | undefined)?.toLowerCase().trim()
  const role      = body.role as Role | undefined

  if (!firstName || !lastName || !email || !role) {
    return NextResponse.json({ error: "firstName, lastName, email, and role are required." }, { status: 400 })
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 })
  }
  // Privilege escalation guard — actor may only create roles at/below their authority.
  if (!canGrantRole(actorRole, role)) {
    return NextResponse.json({ error: "You are not allowed to create an account with that role." }, { status: 403 })
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 })
  }

  const tempPassword = generateTempPassword()
  const hash = await bcrypt.hash(tempPassword, 12)

  const user = await prisma.user.create({
    data: {
      email, firstName, lastName,
      password: hash,
      role,
      status: "ACTIVE",
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  })

  writeAudit(session!.user!.id, "USER_ROLE_CHANGED", "User", user.id, {
    action: "invite", role, byInvite: true,
  })

  return NextResponse.json({ ...user, tempPassword }, { status: 201 })
}

import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { canGrantRole } from "@/lib/permissions"

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: RouteCtx) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { role, status } = body

  const VALID_ROLES = ["SUPER_ADMIN", "CO_FOUNDER", "ADMIN", "CONTRIBUTOR", "STUDENT"]
  const VALID_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "DELETED"]

  if (role && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 })
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 })
  }

  const actorRole = session!.user!.role as string

  // Look up the target's current role to enforce hierarchy on ANY change.
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  // Actor may only act on members at/below their authority — gates role AND
  // status changes (e.g. a co-founder cannot suspend or re-rank a super-admin).
  if (!canGrantRole(actorRole, target.role)) {
    return NextResponse.json({ error: "You are not allowed to manage this member." }, { status: 403 })
  }

  // ...and may only assign a new role at/below their authority.
  if (role && !canGrantRole(actorRole, role)) {
    return NextResponse.json({ error: "You are not allowed to assign that role." }, { status: 403 })
  }

  // Never let the last active super-admin be demoted, suspended, or deleted.
  if (
    target.role === "SUPER_ADMIN" &&
    ((role && role !== "SUPER_ADMIN") || status === "SUSPENDED" || status === "DELETED")
  ) {
    const activeSupers = await prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } })
    if (activeSupers <= 1) {
      return NextResponse.json({ error: "Cannot demote or suspend the only active super admin." }, { status: 400 })
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    },
    select: { id: true, role: true, status: true },
  })

  if (role) writeAudit(session!.user!.id, "USER_ROLE_CHANGED", "User", id, { role })
  if (status) writeAudit(session!.user!.id, "USER_STATUS_CHANGED", "User", id, { status })

  return NextResponse.json(user)
}

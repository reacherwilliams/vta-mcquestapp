/**
 * Manage the founder accounts (Reacher = SUPER_ADMIN, Jayesh = CO_FOUNDER).
 * One script for both. Run from app/ with the DB env loaded (.env.local).
 *
 *   npx tsx scripts/founders.ts                       # list founder/admin accounts + the exact emails to sign in with
 *   npx tsx scripts/founders.ts ensure                # create/repair BOTH founder accounts (prints temp passwords for new ones)
 *   npx tsx scripts/founders.ts set-password <email> <newPassword>   # change a password (min 8 chars)
 *   npx tsx scripts/founders.ts rename <oldEmail> <newEmail>         # move a login email without creating a duplicate
 *
 * `ensure` is idempotent and SAFE: it never overwrites an existing password,
 * and it will NOT create a second super-admin if one already exists under a
 * different email (it tells you to use `rename` instead).
 */
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

// Supabase serves a self-signed cert in its chain — trust it for this local CLI
// script (same approach as the `db:seed` npm script). Must be set before the
// first DB connection.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

import { PrismaClient, type UserRole } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

// Shared starter password for newly-provisioned founders. There's an in-app
// "Change password" page now, so rotate it right after first login.
const TEMP_PASSWORD = "Changeme1!"

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  ssl: { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter })

const FOUNDERS: { email: string; firstName: string; lastName: string; role: UserRole }[] = [
  { email: "reacher.williams@mcq-masterloop.com", firstName: "Reacher", lastName: "Williams", role: "SUPER_ADMIN" },
  { email: "jayesh.patole@mcq-masterloop.com",    firstName: "Jayesh",  lastName: "Patole",   role: "CO_FOUNDER" },
]

async function list() {
  const accounts = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "CO_FOUNDER", "ADMIN"] } },
    select: { email: true, role: true, status: true, lastLoginAt: true },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  })
  if (accounts.length === 0) { console.log("No SUPER_ADMIN / CO_FOUNDER / ADMIN accounts found."); return }
  console.log("Founder / admin accounts (sign in with one of these emails):\n")
  for (const a of accounts) {
    const last = a.lastLoginAt ? a.lastLoginAt.toISOString().slice(0, 10) : "never"
    console.log(`  ${a.role.padEnd(11)}  ${a.email.padEnd(40)}  ${a.status.padEnd(9)}  last login: ${last}`)
  }
}

async function ensure() {
  for (const f of FOUNDERS) {
    const existing = await prisma.user.findUnique({ where: { email: f.email }, select: { id: true } })
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: f.role, status: "ACTIVE" } })
      console.log(`✓ ${f.email} — already existed, set role=${f.role}, status=ACTIVE (password unchanged).`)
      continue
    }
    // Guard: don't silently create a second super-admin under a new email.
    if (f.role === "SUPER_ADMIN") {
      const others = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { email: true } })
      if (others.length > 0) {
        console.log(`! ${f.email} — NOT created. A super-admin already exists: ${others.map((o) => o.email).join(", ")}.`)
        console.log(`  To move it to the new email run:`)
        console.log(`     npx tsx scripts/founders.ts rename ${others[0].email} ${f.email}`)
        continue
      }
    }
    await prisma.user.create({
      data: { email: f.email, firstName: f.firstName, lastName: f.lastName, role: f.role, status: "ACTIVE", password: await bcrypt.hash(TEMP_PASSWORD, 12) },
    })
    console.log(`✓ ${f.email} — created as ${f.role}.`)
    console.log(`    temp password: ${TEMP_PASSWORD}   ← change it after first login via Settings → Change password`)
  }
}

async function setPassword(email: string, password: string) {
  if (password.length < 8) { console.error("Password must be at least 8 characters."); process.exit(1) }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } })
  if (!user) { console.error(`No account with email ${email}.`); process.exit(1) }
  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 12) } })
  console.log(`✓ Password updated for ${email}.`)
}

async function rename(oldEmail: string, newEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: oldEmail.toLowerCase() }, select: { id: true } })
  if (!user) { console.error(`No account with email ${oldEmail}.`); process.exit(1) }
  const clash = await prisma.user.findUnique({ where: { email: newEmail.toLowerCase() }, select: { id: true } })
  if (clash) { console.error(`${newEmail} is already taken by another account.`); process.exit(1) }
  await prisma.user.update({ where: { id: user.id }, data: { email: newEmail.toLowerCase() } })
  console.log(`✓ Login email changed: ${oldEmail} → ${newEmail}.`)
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  switch (cmd) {
    case undefined:
    case "list":         await list(); break
    case "ensure":       await ensure(); break
    case "set-password": if (!a || !b) { console.error("Usage: set-password <email> <newPassword>"); process.exit(1) } await setPassword(a, b); break
    case "rename":       if (!a || !b) { console.error("Usage: rename <oldEmail> <newEmail>"); process.exit(1) } await rename(a, b); break
    default:             console.error(`Unknown command "${cmd}". Run with no args for usage.`); process.exit(1)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Reuse the client across Lambda invocations / dev HMR. Without this guard,
// every hot-reload in dev spawns a new client and exhausts Postgres
// connections within a few minutes.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function build() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL || "",
  })
  return new PrismaClient({ adapter })
}

export const prisma: PrismaClient = global.__prisma ?? build()

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma
}

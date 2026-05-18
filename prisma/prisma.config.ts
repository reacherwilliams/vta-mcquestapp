import { defineConfig } from "prisma/config"
import { config } from "dotenv"
import { resolve } from "path"

// Load .env from project root (this file lives in prisma/).
config({ path: resolve(__dirname, "../.env.local") })
config({ path: resolve(__dirname, "../.env") })

export default defineConfig({
  schema: "./schema.prisma",
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
})

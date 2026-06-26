import "server-only"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { r2, R2_BUCKET, R2_PUBLIC_BASE_URL } from "@/lib/r2/client"
import { randomUUID } from "crypto"

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"])

function isAdmin(role: string | undefined) {
  return role === "ADMIN" || role === "SUPER_ADMIN" || role === "CO_FOUNDER"
}

export async function POST(req: Request) {
  const session = await auth()
  if (!isAdmin(session?.user?.role as string)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 })

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB limit." }, { status: 413 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, and SVG files are allowed." }, { status: 415 })
  }

  const isSvg = file.type === "image/svg+xml"
  const ext = isSvg ? "svg" : file.type.split("/")[1]
  const key = `questions/${randomUUID()}.${ext}`

  const bytes = await file.arrayBuffer()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Buffer<any> = Buffer.from(new Uint8Array(bytes))

  // Resize raster images to max 1200px wide (skip for SVG)
  if (!isSvg) {
    try {
      // Dynamic import — sharp is a heavy native dep, keep out of cold-start bundle
      const sharp = (await import("sharp")).default
      body = await sharp(body)
        .resize({ width: 1200, withoutEnlargement: true })
        .toBuffer()
    } catch {
      // sharp not installed or failed — upload original
    }
  }

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  const url = `${R2_PUBLIC_BASE_URL}/${key}`
  return NextResponse.json({ url, key })
}

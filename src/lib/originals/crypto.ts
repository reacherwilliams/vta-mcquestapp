import "server-only"
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

// AES-256-GCM encryption for Original Question Bank expressive content (stem/options).
// The copyrighted text is stored ONLY as ciphertext; it is decrypted solely via the
// audited, case-by-case reveal flow — never bulk-readable, even by a Super Admin.
//
// The key is derived from ENCRYPTION_KEY (held in env, never in the DB) so a database
// leak exposes ciphertext only.

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error("ENCRYPTION_KEY is not set — required to encrypt/decrypt originals.")
  return createHash("sha256").update(secret).digest() // 32 bytes
}

/** Encrypt UTF-8 plaintext → base64(iv ‖ authTag ‖ ciphertext). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

/** Decrypt a payload produced by encrypt(). Throws if tampered or key is wrong. */
export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}

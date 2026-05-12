import { hash, verify } from '@node-rs/argon2'

const OPTIONS = {
  memoryCost: 19456,    // 19 MiB — OWASP recommended floor for argon2id
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS)
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain)
  } catch {
    return false
  }
}

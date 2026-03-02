import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const LEGACY_FALLBACK_KEY = 'default-key-please-change-in-production-32-chars!!'
const LEGACY_ALGORITHM = 'aes-256-cbc'
const V2_ALGORITHM = 'aes-256-gcm'
let warnedAboutFallbackKey = false

function pushUniqueKey(target: string[], candidate?: string | null) {
  if (!candidate) return
  const normalized = candidate.trim()
  if (!normalized) return
  if (!target.includes(normalized)) {
    target.push(normalized)
  }
}

function resolveEncryptionKeys(): string[] {
  const keys: string[] = []
  const configured = process.env.INVITE_CODE_ENCRYPTION_KEY?.trim()
  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim()

  if (configured && configured.length >= 32) {
    pushUniqueKey(keys, configured)
  }

  if (nextAuthSecret && nextAuthSecret.length >= 32) {
    if (!configured && process.env.NODE_ENV === 'production' && !warnedAboutFallbackKey) {
      warnedAboutFallbackKey = true
      console.warn(
        'INVITE_CODE_ENCRYPTION_KEY is missing/weak; falling back to NEXTAUTH_SECRET for invite-code encryption.'
      )
    }
    pushUniqueKey(keys, nextAuthSecret)
  }

  // Include weaker historical keys as decrypt-only fallbacks for backward compatibility.
  pushUniqueKey(keys, configured)
  pushUniqueKey(keys, nextAuthSecret)
  pushUniqueKey(keys, LEGACY_FALLBACK_KEY)

  if (keys.length === 0) {
    keys.push(LEGACY_FALLBACK_KEY)
  }

  if (
    process.env.NODE_ENV === 'production' &&
    keys[0] === LEGACY_FALLBACK_KEY &&
    !warnedAboutFallbackKey
  ) {
    warnedAboutFallbackKey = true
    console.warn(
      'INVITE_CODE_ENCRYPTION_KEY and NEXTAUTH_SECRET are missing/weak; using legacy fallback key. Set INVITE_CODE_ENCRYPTION_KEY immediately.'
    )
  }

  return keys
}

const ENCRYPTION_KEYS = resolveEncryptionKeys()
const PRIMARY_ENCRYPTION_KEY = ENCRYPTION_KEYS[0]
const LEGACY_DERIVED_ENCRYPTION_KEYS = ENCRYPTION_KEYS.map((key) =>
  crypto.scryptSync(key, 'salt', 32),
)

function deriveEncryptionKey(key: string, salt: Buffer): Buffer {
  return crypto.scryptSync(key, salt, 32)
}

/**
 * Generates a human-readable invite code
 */
export function generateInviteCode(): string {
  // Generate 12-character code
  return nanoid(12)
}

/**
 * Hashes an invite code for secure storage
 */
export async function hashInviteCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

/**
 * Verifies an invite code against a hash
 */
export async function verifyInviteCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash)
}

/**
 * Encrypts an invite code for retrievable storage
 */
export function encryptInviteCode(code: string): string {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = deriveEncryptionKey(PRIMARY_ENCRYPTION_KEY, salt)
  const cipher = crypto.createCipheriv(V2_ALGORITHM, key, iv)

  let encrypted = cipher.update(code, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `v2:${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}:${authTag}`
}

/**
 * Decrypts an invite code
 */
export function decryptInviteCode(encrypted: string): string {
  if (encrypted.startsWith('v2:')) {
    const parts = encrypted.split(':')
    if (parts.length !== 5) {
      throw new Error('Invalid invite code ciphertext format')
    }

    const [, saltHex, ivHex, encryptedData, authTagHex] = parts
    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    for (const keyCandidate of ENCRYPTION_KEYS) {
      try {
        const key = deriveEncryptionKey(keyCandidate, salt)
        const decipher = crypto.createDecipheriv(V2_ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
      } catch {
        // Try next key candidate.
      }
    }

    throw new Error('Failed to decrypt invite code with available encryption keys')
  }

  const [ivHex, encryptedData] = encrypted.split(':')
  if (!ivHex || !encryptedData) {
    throw new Error('Invalid invite code ciphertext format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  for (const key of LEGACY_DERIVED_ENCRYPTION_KEYS) {
    try {
      const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv)
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch {
      // Try next legacy key candidate.
    }
  }

  throw new Error('Failed to decrypt invite code with available encryption keys')
}

/**
 * Creates both admin and member invite codes
 */
export async function createInviteCodes(): Promise<{
  adminCode: string
  adminHash: string
  adminEncrypted: string
  memberCode: string
  memberHash: string
  memberEncrypted: string
}> {
  const adminCode = generateInviteCode()
  const memberCode = generateInviteCode()
  
  const [adminHash, memberHash] = await Promise.all([
    hashInviteCode(adminCode),
    hashInviteCode(memberCode),
  ])

  const adminEncrypted = encryptInviteCode(adminCode)
  const memberEncrypted = encryptInviteCode(memberCode)
  
  return {
    adminCode,
    adminHash,
    adminEncrypted,
    memberCode,
    memberHash,
    memberEncrypted,
  }
}

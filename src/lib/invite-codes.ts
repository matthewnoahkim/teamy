import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.INVITE_CODE_ENCRYPTION_KEY || 'default-key-please-change-in-production-32-chars!!'
const ALGORITHM = 'aes-256-cbc'
const DERIVED_ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32)

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
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, DERIVED_ENCRYPTION_KEY, iv)
  
  let encrypted = cipher.update(code, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Return IV and encrypted data together
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypts an invite code
 */
export function decryptInviteCode(encrypted: string): string {
  const [ivHex, encryptedData] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, DERIVED_ENCRYPTION_KEY, iv)
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
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

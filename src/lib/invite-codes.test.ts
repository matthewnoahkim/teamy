import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import { decryptInviteCode, encryptInviteCode } from '@/lib/invite-codes'

function encryptLegacyInviteCode(code: string): string {
  const keyMaterial =
    process.env.INVITE_CODE_ENCRYPTION_KEY ||
    'default-key-please-change-in-production-32-chars!!'
  const key = crypto.scryptSync(keyMaterial, 'salt', 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(code, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

test('encryptInviteCode uses authenticated v2 format and decrypts successfully', () => {
  const plaintext = 'invite-code-123'
  const encrypted = encryptInviteCode(plaintext)

  assert.equal(encrypted.startsWith('v2:'), true)
  assert.equal(decryptInviteCode(encrypted), plaintext)
})

test('decryptInviteCode supports legacy invite ciphertext', () => {
  const plaintext = 'legacy-code-abc'
  const legacyCiphertext = encryptLegacyInviteCode(plaintext)
  assert.equal(decryptInviteCode(legacyCiphertext), plaintext)
})

test('decryptInviteCode rejects tampered v2 ciphertext', () => {
  const plaintext = 'secure-code'
  const encrypted = encryptInviteCode(plaintext)
  const tampered =
    encrypted.slice(0, -1) + (encrypted.endsWith('0') ? '1' : '0')

  assert.throws(() => decryptInviteCode(tampered))
})

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { config } from '../config'

// AES-256-GCM: authenticated encryption, analogous to the .NET Data Protection API
// used in the original backend. Reversible by design — unlike portal login passwords
// (bcrypt, one-way), stored application credentials must be decryptable for display/export.
const key = Buffer.from(config.credentialEncryptionKeyHex, 'hex')
if (key.length !== 32) {
  throw new Error('CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes (a 64-char hex string).')
}

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

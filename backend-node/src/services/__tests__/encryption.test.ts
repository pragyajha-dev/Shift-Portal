import 'dotenv/config'
import { describe, expect, it } from 'vitest'
import { encrypt, decrypt } from '../encryption'

describe('credential encryption', () => {
  it('round-trips plaintext through encrypt then decrypt', () => {
    const plaintext = 'Sup3r$ecretDbPassword!'
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('does not return the plaintext verbatim as ciphertext', () => {
    const plaintext = 'Sup3r$ecretDbPassword!'
    const ciphertext = encrypt(plaintext)
    expect(ciphertext).not.toBe(plaintext)
    expect(ciphertext).not.toContain(plaintext)
  })

  it('produces different ciphertext each time (random IV) even for the same input', () => {
    const plaintext = 'same-input'
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext))
  })

  it('throws instead of silently returning garbage when the ciphertext is tampered with', () => {
    const ciphertext = encrypt('value')
    const tampered = ciphertext.slice(0, -4) + 'abcd'
    expect(() => decrypt(tampered)).toThrow()
  })
})

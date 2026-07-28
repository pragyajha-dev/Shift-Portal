import { randomInt } from 'node:crypto'

// Excludes visually ambiguous characters (I, O, l, o, 0, 1) — matches the .NET version's charset.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'

export function generateTemporaryPassword(length = 12): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += CHARS[randomInt(CHARS.length)]
  }
  return result
}

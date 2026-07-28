function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: required('FRONTEND_ORIGIN'),
  jwt: {
    secret: required('JWT_SECRET'),
    issuer: required('JWT_ISSUER'),
    audience: required('JWT_AUDIENCE'),
    expiryMinutes: Number(process.env.JWT_EXPIRY_MINUTES ?? 480),
  },
  credentialEncryptionKeyHex: required('CREDENTIAL_ENCRYPTION_KEY'),
}

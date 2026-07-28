const VALID_SIDES = new Set(['OutSystems', 'NewApp'])

export interface SaveCredentialRequest {
  roleLabel?: string
  username?: string
  password?: string
  sortOrder?: number
}

export interface SaveEnvironmentRequest {
  side?: string
  name?: string
  url?: string
  sortOrder?: number
  credentials?: SaveCredentialRequest[]
}

export interface SaveProjectRequest {
  name?: string
  environments?: SaveEnvironmentRequest[]
}

export function validateSaveProjectRequest(request: SaveProjectRequest): string | null {
  if (!request.name?.trim()) {
    return 'Project name is required.'
  }

  for (const env of request.environments ?? []) {
    if (!env.side || !VALID_SIDES.has(env.side)) {
      return `Environment side must be OutSystems or NewApp (got '${env.side}').`
    }
    if (!env.name?.trim()) {
      return 'Environment name is required.'
    }
    if (!env.url?.trim()) {
      return 'Environment URL is required.'
    }
    for (const cred of env.credentials ?? []) {
      if (!cred.roleLabel?.trim() || !cred.username?.trim()) {
        return 'Credential role and username are required.'
      }
    }
  }

  return null
}

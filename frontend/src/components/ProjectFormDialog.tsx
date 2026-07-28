import { useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-context'
import { ApiError, projectsApi } from '@/lib/api'
import { SIDE_LABELS, type EnvironmentSide, type SaveEnvironmentPayload, type SaveProjectPayload } from '@/lib/types'

const SIDES: EnvironmentSide[] = ['OutSystems', 'NewApp']

// A Persona is a role (e.g. "Admin") defined once for the whole project — it applies
// identically across both OutSystems and Pro Code, and across every environment on
// each side, rather than being retyped per environment.
interface FormPersona {
  clientId: string
  name: string
}

interface FormCredentialEntry {
  personaId: string
  username: string
  password: string
  showPassword: boolean
}

interface FormEnvironment {
  clientId: string
  name: string
  url: string
  credentials: FormCredentialEntry[]
}

type EnvironmentsBySide = Record<EnvironmentSide, FormEnvironment[]>

function blankCredentialsFor(personas: FormPersona[]): FormCredentialEntry[] {
  return personas.map((p) => ({ personaId: p.clientId, username: '', password: '', showPassword: false }))
}

function emptyEnvironment(personas: FormPersona[]): FormEnvironment {
  return { clientId: crypto.randomUUID(), name: '', url: '', credentials: blankCredentialsFor(personas) }
}

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string | null
  onSaved: () => void
}

export function ProjectFormDialog({ open, onOpenChange, projectId, onSaved }: ProjectFormDialogProps) {
  const { token } = useAuth()
  const isEditMode = projectId !== null

  const [name, setName] = useState('')
  const [personas, setPersonas] = useState<FormPersona[]>([])
  const [environments, setEnvironments] = useState<EnvironmentsBySide>({ OutSystems: [], NewApp: [] })
  const [activeTab, setActiveTab] = useState<EnvironmentSide>('OutSystems')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setError(null)
    setActiveTab('OutSystems')

    if (!isEditMode) {
      setName('')
      setPersonas([])
      setEnvironments({ OutSystems: [emptyEnvironment([])], NewApp: [emptyEnvironment([])] })
      return
    }

    if (!token || !projectId) return
    setIsLoading(true)
    projectsApi
      .get(token, projectId)
      .then((detail) => {
        setName(detail.name)

        // Personas aren't a separate saved entity yet — derive the project's persona
        // list from the distinct role labels already used anywhere in its credentials.
        const personaByName = new Map<string, FormPersona>()
        for (const env of detail.environments) {
          for (const cred of env.credentials) {
            if (!personaByName.has(cred.roleLabel)) {
              personaByName.set(cred.roleLabel, { clientId: crypto.randomUUID(), name: cred.roleLabel })
            }
          }
        }
        const derivedPersonas = [...personaByName.values()]
        setPersonas(derivedPersonas)

        const bySide: EnvironmentsBySide = { OutSystems: [], NewApp: [] }
        for (const env of detail.environments) {
          const credByRole = new Map(env.credentials.map((c) => [c.roleLabel, c]))
          bySide[env.side].push({
            clientId: env.id,
            name: env.name,
            url: env.url,
            // Backfill any persona that wasn't already saved for this environment,
            // so every persona × environment cell is present and fillable.
            credentials: derivedPersonas.map((persona) => {
              const existing = credByRole.get(persona.name)
              return {
                personaId: persona.clientId,
                username: existing?.username ?? '',
                password: existing?.password ?? '',
                showPassword: false,
              }
            }),
          })
        }
        if (bySide.OutSystems.length === 0) bySide.OutSystems.push(emptyEnvironment(derivedPersonas))
        if (bySide.NewApp.length === 0) bySide.NewApp.push(emptyEnvironment(derivedPersonas))
        setEnvironments(bySide)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load project.'))
      .finally(() => setIsLoading(false))
  }, [open, isEditMode, projectId, token])

  function updateSide(side: EnvironmentSide, updater: (envs: FormEnvironment[]) => FormEnvironment[]) {
    setEnvironments((prev) => ({ ...prev, [side]: updater(prev[side]) }))
  }

  function addPersona() {
    const persona: FormPersona = { clientId: crypto.randomUUID(), name: '' }
    setPersonas((prev) => [...prev, persona])
    setEnvironments((prev) => {
      const next: EnvironmentsBySide = { OutSystems: [], NewApp: [] }
      for (const side of SIDES) {
        next[side] = prev[side].map((env) => ({
          ...env,
          credentials: [...env.credentials, { personaId: persona.clientId, username: '', password: '', showPassword: false }],
        }))
      }
      return next
    })
  }

  function updatePersonaName(personaId: string, value: string) {
    setPersonas((prev) => prev.map((p) => (p.clientId === personaId ? { ...p, name: value } : p)))
  }

  function removePersona(personaId: string) {
    setPersonas((prev) => prev.filter((p) => p.clientId !== personaId))
    setEnvironments((prev) => {
      const next: EnvironmentsBySide = { OutSystems: [], NewApp: [] }
      for (const side of SIDES) {
        next[side] = prev[side].map((env) => ({
          ...env,
          credentials: env.credentials.filter((c) => c.personaId !== personaId),
        }))
      }
      return next
    })
  }

  function addEnvironment(side: EnvironmentSide) {
    updateSide(side, (envs) => [...envs, emptyEnvironment(personas)])
  }

  function removeEnvironment(side: EnvironmentSide, envId: string) {
    updateSide(side, (envs) => envs.filter((e) => e.clientId !== envId))
  }

  function updateEnvironment(side: EnvironmentSide, envId: string, patch: Partial<FormEnvironment>) {
    updateSide(side, (envs) => envs.map((e) => (e.clientId === envId ? { ...e, ...patch } : e)))
  }

  function updateCredential(side: EnvironmentSide, envId: string, personaId: string, patch: Partial<FormCredentialEntry>) {
    updateSide(side, (envs) =>
      envs.map((e) =>
        e.clientId === envId
          ? { ...e, credentials: e.credentials.map((c) => (c.personaId === personaId ? { ...c, ...patch } : c)) }
          : e,
      ),
    )
  }

  function validate(): string | null {
    if (!name.trim()) return 'Project name is required.'

    for (const persona of personas) {
      if (!persona.name.trim()) return 'Every persona needs a name.'
    }
    const personaNames = personas.map((p) => p.name.trim().toLowerCase())
    if (new Set(personaNames).size !== personaNames.length) {
      return 'Persona names must be unique.'
    }

    for (const side of SIDES) {
      for (const env of environments[side]) {
        if (!env.name.trim() || !env.url.trim()) {
          return `Every environment needs a name and URL (check ${SIDE_LABELS[side]}).`
        }
        for (const cred of env.credentials) {
          if (!cred.username.trim() || !cred.password) {
            const persona = personas.find((p) => p.clientId === cred.personaId)
            return `"${persona?.name ?? 'A persona'}" needs a username and password in every environment (check ${SIDE_LABELS[side]} → ${env.name || 'an environment'}).`
          }
        }
      }
    }
    return null
  }

  async function handleSave() {
    if (!token) return
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const payload: SaveProjectPayload = {
      name: name.trim(),
      environments: SIDES.flatMap((side) =>
        environments[side].map((env, envIndex): SaveEnvironmentPayload => ({
          side,
          name: env.name.trim(),
          url: env.url.trim(),
          sortOrder: envIndex,
          credentials: env.credentials.map((cred, credIndex) => {
            const persona = personas.find((p) => p.clientId === cred.personaId)
            return {
              roleLabel: persona?.name.trim() ?? '',
              username: cred.username.trim(),
              password: cred.password,
              sortOrder: credIndex,
            }
          }),
        })),
      ),
    }

    setIsSaving(true)
    setError(null)
    try {
      if (isEditMode && projectId) {
        await projectsApi.update(token, projectId, payload)
      } else {
        await projectsApi.create(token, payload)
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save project.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto p-6 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{isEditMode ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogDescription className="text-sm">
            Record the OutSystems and Pro Code details for this migration — environments and credentials for both
            sides are saved together.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading...</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="projectName">Project Name</Label>
              <Input id="projectName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="mt-4 rounded-xl border border-indigo-100/70 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 p-3">
              <Label>Personas</Label>
              <p className="mt-0.5 text-xs text-slate-500">
                Define each role once — it applies the same way across OutSystems, Pro Code, and every environment.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {personas.map((persona) => (
                  <div
                    key={persona.clientId}
                    className="flex items-center gap-1 rounded-full border border-indigo-200/70 bg-white/80 py-1 pr-1.5 pl-3"
                  >
                    <input
                      className="w-28 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal"
                      placeholder="e.g. Admin"
                      value={persona.name}
                      onChange={(e) => updatePersonaName(persona.clientId, e.target.value)}
                    />
                    <button
                      type="button"
                      title="Remove persona"
                      className="rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600"
                      onClick={() => removePersona(persona.clientId)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPersona}>
                  <Plus className="size-3.5" /> Add Persona
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EnvironmentSide)} className="mt-4">
              <TabsList className="gap-2">
                <TabsTrigger value="OutSystems">{SIDE_LABELS.OutSystems}</TabsTrigger>
                <TabsTrigger value="NewApp">{SIDE_LABELS.NewApp}</TabsTrigger>
              </TabsList>

              {SIDES.map((side) => (
                <TabsContent key={side} value={side} className="mt-4 space-y-4">
                  {environments[side].map((env) => (
                    <div key={env.clientId} className="rounded-xl border border-indigo-100/70 bg-white/50 p-3">
                      <div className="flex items-start gap-2">
                        <div className="grid flex-1 grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Environment</Label>
                            <Input
                              placeholder="e.g. Dev, UAT, Prod"
                              value={env.name}
                              onChange={(e) => updateEnvironment(side, env.clientId, { name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">URL</Label>
                            <Input
                              placeholder="https://..."
                              value={env.url}
                              onChange={(e) => updateEnvironment(side, env.clientId, { url: e.target.value })}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="mt-5"
                          title="Remove environment"
                          onClick={() => removeEnvironment(side, env.clientId)}
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {personas.length === 0 ? (
                          <p className="text-xs text-slate-400">Add a persona above to start entering credentials.</p>
                        ) : (
                          env.credentials.map((cred) => {
                            const persona = personas.find((p) => p.clientId === cred.personaId)
                            return (
                              <div
                                key={cred.personaId}
                                className="flex items-end gap-2 rounded-lg bg-slate-100/70 p-2"
                              >
                                <div className="w-24 shrink-0">
                                  <Label className="text-xs">Role</Label>
                                  <p className="mt-1.5 truncate text-sm font-medium text-slate-700">
                                    {persona?.name || '—'}
                                  </p>
                                </div>
                                <div className="grid flex-1 grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Username</Label>
                                    <Input
                                      value={cred.username}
                                      onChange={(e) =>
                                        updateCredential(side, env.clientId, cred.personaId, { username: e.target.value })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Password</Label>
                                    <div className="relative">
                                      <Input
                                        type={cred.showPassword ? 'text' : 'password'}
                                        className="pr-8"
                                        value={cred.password}
                                        onChange={(e) =>
                                          updateCredential(side, env.clientId, cred.personaId, { password: e.target.value })
                                        }
                                      />
                                      <button
                                        type="button"
                                        className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                                        onClick={() =>
                                          updateCredential(side, env.clientId, cred.personaId, {
                                            showPassword: !cred.showPassword,
                                          })
                                        }
                                      >
                                        {cred.showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" onClick={() => addEnvironment(side)}>
                    <Plus className="size-3.5" /> Add Details
                  </Button>
                </TabsContent>
              ))}
            </Tabs>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

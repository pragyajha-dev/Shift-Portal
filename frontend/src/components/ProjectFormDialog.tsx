import { useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-context'
import { ApiError, projectsApi } from '@/lib/api'
import type { EnvironmentSide, SaveEnvironmentPayload, SaveProjectPayload } from '@/lib/types'

interface FormCredential {
  clientId: string
  roleLabel: string
  username: string
  password: string
  showPassword: boolean
}

interface FormEnvironment {
  clientId: string
  name: string
  url: string
  credentials: FormCredential[]
}

type EnvironmentsBySide = Record<EnvironmentSide, FormEnvironment[]>

function emptyCredential(): FormCredential {
  return { clientId: crypto.randomUUID(), roleLabel: '', username: '', password: '', showPassword: false }
}

function emptyEnvironment(): FormEnvironment {
  return { clientId: crypto.randomUUID(), name: '', url: '', credentials: [] }
}

const SIDE_LABELS: Record<EnvironmentSide, string> = {
  OutSystems: 'OutSystems Details',
  NewApp: 'New App Details',
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
      setEnvironments({ OutSystems: [], NewApp: [] })
      return
    }

    if (!token || !projectId) return
    setIsLoading(true)
    projectsApi
      .get(token, projectId)
      .then((detail) => {
        setName(detail.name)
        const bySide: EnvironmentsBySide = { OutSystems: [], NewApp: [] }
        for (const env of detail.environments) {
          bySide[env.side].push({
            clientId: env.id,
            name: env.name,
            url: env.url,
            credentials: env.credentials.map((c) => ({
              clientId: c.id,
              roleLabel: c.roleLabel,
              username: c.username,
              password: c.password,
              showPassword: false,
            })),
          })
        }
        setEnvironments(bySide)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load project.'))
      .finally(() => setIsLoading(false))
  }, [open, isEditMode, projectId, token])

  function updateSide(side: EnvironmentSide, updater: (envs: FormEnvironment[]) => FormEnvironment[]) {
    setEnvironments((prev) => ({ ...prev, [side]: updater(prev[side]) }))
  }

  function addEnvironment(side: EnvironmentSide) {
    updateSide(side, (envs) => [...envs, emptyEnvironment()])
  }

  function removeEnvironment(side: EnvironmentSide, envId: string) {
    updateSide(side, (envs) => envs.filter((e) => e.clientId !== envId))
  }

  function updateEnvironment(side: EnvironmentSide, envId: string, patch: Partial<FormEnvironment>) {
    updateSide(side, (envs) => envs.map((e) => (e.clientId === envId ? { ...e, ...patch } : e)))
  }

  function addCredential(side: EnvironmentSide, envId: string) {
    updateSide(side, (envs) =>
      envs.map((e) => (e.clientId === envId ? { ...e, credentials: [...e.credentials, emptyCredential()] } : e)),
    )
  }

  function removeCredential(side: EnvironmentSide, envId: string, credId: string) {
    updateSide(side, (envs) =>
      envs.map((e) =>
        e.clientId === envId ? { ...e, credentials: e.credentials.filter((c) => c.clientId !== credId) } : e,
      ),
    )
  }

  function updateCredential(side: EnvironmentSide, envId: string, credId: string, patch: Partial<FormCredential>) {
    updateSide(side, (envs) =>
      envs.map((e) =>
        e.clientId === envId
          ? { ...e, credentials: e.credentials.map((c) => (c.clientId === credId ? { ...c, ...patch } : c)) }
          : e,
      ),
    )
  }

  function validate(): string | null {
    if (!name.trim()) return 'Project name is required.'
    for (const side of ['OutSystems', 'NewApp'] as EnvironmentSide[]) {
      for (const env of environments[side]) {
        if (!env.name.trim() || !env.url.trim()) {
          return `Every environment needs a name and URL (check ${SIDE_LABELS[side]}).`
        }
        for (const cred of env.credentials) {
          if (!cred.roleLabel.trim() || !cred.username.trim() || !cred.password) {
            return `Every credential needs a role, username, and password (check ${SIDE_LABELS[side]} → ${env.name || 'an environment'}).`
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
      environments: (['OutSystems', 'NewApp'] as EnvironmentSide[]).flatMap((side) =>
        environments[side].map((env, envIndex): SaveEnvironmentPayload => ({
          side,
          name: env.name.trim(),
          url: env.url.trim(),
          sortOrder: envIndex,
          credentials: env.credentials.map((cred, credIndex) => ({
            roleLabel: cred.roleLabel.trim(),
            username: cred.username.trim(),
            password: cred.password,
            sortOrder: credIndex,
          })),
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogDescription>
            Record the OutSystems and New App details for this migration — environments and credentials for both
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

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EnvironmentSide)} className="mt-2">
              <TabsList>
                <TabsTrigger value="OutSystems">OutSystems Details</TabsTrigger>
                <TabsTrigger value="NewApp">New App Details</TabsTrigger>
              </TabsList>

              {(['OutSystems', 'NewApp'] as EnvironmentSide[]).map((side) => (
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
                        {env.credentials.map((cred) => (
                          <div key={cred.clientId} className="flex items-end gap-2 rounded-lg bg-slate-100/70 p-2">
                            <div className="grid flex-1 grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Role</Label>
                                <Input
                                  placeholder="e.g. Admin"
                                  value={cred.roleLabel}
                                  onChange={(e) =>
                                    updateCredential(side, env.clientId, cred.clientId, { roleLabel: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Username</Label>
                                <Input
                                  value={cred.username}
                                  onChange={(e) =>
                                    updateCredential(side, env.clientId, cred.clientId, { username: e.target.value })
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
                                      updateCredential(side, env.clientId, cred.clientId, { password: e.target.value })
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                                    onClick={() =>
                                      updateCredential(side, env.clientId, cred.clientId, {
                                        showPassword: !cred.showPassword,
                                      })
                                    }
                                  >
                                    {cred.showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Remove credential"
                              onClick={() => removeCredential(side, env.clientId, cred.clientId)}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCredential(side, env.clientId)}
                        >
                          <Plus className="size-3.5" /> Add Credential
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" onClick={() => addEnvironment(side)}>
                    <Plus className="size-3.5" /> Add Environment
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

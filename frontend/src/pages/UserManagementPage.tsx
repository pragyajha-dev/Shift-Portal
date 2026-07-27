import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/RoleBadge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import { ApiError, usersApi } from '@/lib/api'
import type { Role, UserSummary } from '@/lib/types'

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

export function UserManagementPage() {
  const { token, user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('Viewer')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdResult, setCreatedResult] = useState<{ user: UserSummary; temporaryPassword: string } | null>(null)

  const loadUsers = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setListError(null)
    try {
      const data = await usersApi.list(token)
      setUsers(data)
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  function resetAddForm() {
    setFullName('')
    setEmail('')
    setRole('Viewer')
    setFormError(null)
    setCreatedResult(null)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setFormError(null)
    setIsSubmitting(true)
    try {
      const result = await usersApi.create(token, fullName.trim(), email.trim(), role)
      setCreatedResult(result)
      setUsers((prev) => [...prev, result.user])
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create user.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRoleChange(targetUserId: string, newRole: Role) {
    if (!token) return
    setUpdatingUserId(targetUserId)
    try {
      const updated = await usersApi.updateRole(token, targetUserId, newRole)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to update role.')
    } finally {
      setUpdatingUserId(null)
    }
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">User Management</h1>
        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open)
            if (!open) resetAddForm()
          }}
        >
          <Button onClick={() => setIsAddOpen(true)}>+ Add User</Button>
          <DialogContent>
            {createdResult ? (
              <>
                <DialogHeader>
                  <DialogTitle>User created</DialogTitle>
                  <DialogDescription>
                    Share this temporary password with {createdResult.user.fullName}. They'll be required to set a new
                    one on first login.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-violet-50 p-3">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-900">{createdResult.user.email}</p>
                  <p className="mt-2 text-xs text-slate-500">Temporary password</p>
                  <p className="font-mono text-sm font-medium text-slate-900">{createdResult.temporaryPassword}</p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setIsAddOpen(false)
                      resetAddForm()
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Add user</DialogTitle>
                  <DialogDescription>Creates an account with a generated temporary password.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newUserEmail">Email</Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newUserRole">Role</Label>
                    <select
                      id="newUserRole"
                      className="w-full rounded-lg border border-slate-300 bg-white/70 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/20"
                      value={role}
                      onChange={(e) => setRole(e.target.value as Role)}
                    >
                      <option value="Viewer">Viewer</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  {formError && <p className="text-sm text-red-600">{formError}</p>}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create user'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-panel mt-6 overflow-hidden rounded-2xl">
        {listError && <p className="p-4 text-sm text-red-600">{listError}</p>}
        {isLoading ? (
          <p className="p-4 text-sm text-slate-400">Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.id === currentUser?.id ? (
                      <RoleBadge role={u.role} />
                    ) : (
                      <select
                        className="rounded-lg border border-slate-300 bg-white/70 px-2 py-1 text-sm outline-none focus:border-indigo-400 focus:ring-3 focus:ring-indigo-500/20"
                        value={u.role}
                        disabled={updatingUserId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      >
                        <option value="Viewer">Viewer</option>
                        <option value="Admin">Admin</option>
                      </select>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.mustChangePassword ? (
                      <Badge variant="outline">Pending first login</Badge>
                    ) : (
                      <Badge className="border-emerald-200/60 bg-emerald-500/10 text-emerald-700" variant="secondary">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500">{formatDate(u.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

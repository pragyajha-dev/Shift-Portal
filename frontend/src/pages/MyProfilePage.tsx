import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { RoleBadge } from '@/components/RoleBadge'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

export function MyProfilePage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="glass-panel-strong max-w-lg animate-in fade-in slide-in-from-bottom-2 rounded-2xl p-6 duration-500">
      <h1 className="text-lg font-semibold text-slate-900">My Profile</h1>

      <dl className="mt-6 space-y-4">
        <div>
          <dt className="text-sm text-slate-500">Full name</dt>
          <dd className="text-sm font-medium text-slate-900">{user.fullName}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Email</dt>
          <dd className="text-sm font-medium text-slate-900">{user.email}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Role</dt>
          <dd>
            <RoleBadge role={user.role} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Last login</dt>
          <dd className="text-sm font-medium text-slate-900">{formatDate(user.lastLoginAt)}</dd>
        </div>
      </dl>

      <Link to="/change-password" className={cn(buttonVariants({ variant: 'default' }), 'mt-6')}>
        Change password
      </Link>
    </div>
  )
}

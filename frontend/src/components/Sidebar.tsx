import { NavLink } from 'react-router-dom'
import { LayoutDashboard, LogOut, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/RoleBadge'
import { useAuth } from '@/lib/auth-context'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
    isActive
      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/30'
      : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
  }`

export function Sidebar() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <aside className="glass-sidebar sticky top-0 flex h-screen w-60 shrink-0 flex-col px-4 py-5">
      <span className="bg-gradient-to-br from-indigo-700 to-violet-600 bg-clip-text px-2 text-lg font-semibold text-transparent">
        Legacy2Next
      </span>

      <nav className="mt-6 flex flex-col gap-1">
        <NavLink to="/" end className={navLinkClass}>
          <LayoutDashboard className="size-4" />
          Dashboard
        </NavLink>
        {user.role === 'Admin' && (
          <NavLink to="/users" className={navLinkClass}>
            <Users className="size-4" />
            User Management
          </NavLink>
        )}
        <NavLink to="/profile" className={navLinkClass}>
          <UserRound className="size-4" />
          My Profile
        </NavLink>
      </nav>

      <div className="mt-auto space-y-3 border-t border-white/50 pt-4">
        <div className="flex items-center gap-2 px-2 text-sm text-slate-600">
          <span className="truncate">{user.fullName}</span>
          <RoleBadge role={user.role} />
        </div>
        <Button variant="outline" size="sm" className="w-full justify-center" onClick={logout}>
          <LogOut className="size-3.5" />
          Log out
        </Button>
      </div>
    </aside>
  )
}

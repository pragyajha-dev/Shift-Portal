import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/types'

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        role === 'Admin'
          ? 'border-indigo-200/60 bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-indigo-700'
          : 'border-slate-200/60 bg-slate-500/10 text-slate-600',
        className,
      )}
    >
      {role}
    </Badge>
  )
}

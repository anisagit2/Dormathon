'use client'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 gap-4 text-center', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/25">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-white/60">{title}</p>
        {description && <p className="text-xs text-white/30 mt-1 max-w-xs mx-auto">{description}</p>}
      </div>
      {action}
    </div>
  )
}

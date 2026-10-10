'use client'
import { cn } from '@/lib/utils'

interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; className?: string }

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const s = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' }
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-violet-500/30 border-t-violet-500',
        s[size],
        className
      )}
    />
  )
}

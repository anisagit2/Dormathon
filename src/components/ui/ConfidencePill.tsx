'use client'
import { cn, confidenceColor, confidenceLabel } from '@/lib/utils'

interface ConfidencePillProps {
  value: number   // 0–1
  showLabel?: boolean
  className?: string
}

export default function ConfidencePill({ value, showLabel = true, className }: ConfidencePillProps) {
  const pct = Math.round(value * 100)
  const color = confidenceColor(value)
  const label = confidenceLabel(value)

  const barColor =
    value >= 0.8
      ? 'from-emerald-500 to-emerald-400'
      : value >= 0.5
      ? 'from-amber-500 to-amber-400'
      : 'from-rose-500 to-rose-400'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn('text-xs font-medium tabular-nums', color)}>
          {pct}%{' '}
          <span className="text-white/30 font-normal">({label})</span>
        </span>
      )}
    </div>
  )
}

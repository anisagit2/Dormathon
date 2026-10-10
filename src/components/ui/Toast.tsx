'use client'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

type Variant = 'info' | 'success' | 'warning' | 'error'

interface ToastProps {
  variant?: Variant
  message: string
  onClose?: () => void
}

const styles: Record<Variant, { icon: React.ReactNode; cls: string }> = {
  info:    { icon: <Info size={16} />,          cls: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' },
  success: { icon: <CheckCircle2 size={16} />,  cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  warning: { icon: <AlertTriangle size={16} />, cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  error:   { icon: <XCircle size={16} />,       cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
}

export default function Toast({ variant = 'info', message, onClose }: ToastProps) {
  const { icon, cls } = styles[variant]
  return (
    <div className={cn('flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm animate-slide-in shadow-glass', cls)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <XCircle size={14} />
        </button>
      )}
    </div>
  )
}

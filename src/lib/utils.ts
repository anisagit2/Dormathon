import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string | undefined | null, fmt = 'dd MMM yyyy'): string {
  if (!iso) return '—'
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  return isValid(d) ? format(d, fmt) : iso
}

export function formatDateTime(iso: string | undefined | null): string {
  return formatDate(iso, 'dd MMM yyyy HH:mm')
}

export function formatRelative(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = parseISO(iso)
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : iso
}

export function formatTime(iso: string | undefined | null): string {
  return formatDate(iso, 'HH:mm')
}

export function confidenceColor(conf: number): string {
  if (conf >= 0.8) return 'text-emerald-400'
  if (conf >= 0.5) return 'text-amber-400'
  return 'text-rose-400'
}

export function confidenceLabel(conf: number): string {
  if (conf >= 0.8) return 'High'
  if (conf >= 0.5) return 'Medium'
  return 'Low'
}

export function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    concept_review: 'Concept Review',
    practice: 'Practice',
    mock_test: 'Mock Test',
    final_review: 'Final Review',
    general: 'Study',
  }
  return map[phase] ?? phase
}

export function phaseColor(phase: string): string {
  const map: Record<string, string> = {
    concept_review: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/20',
    practice: 'bg-violet-500/20 text-violet-300 border-violet-500/20',
    mock_test: 'bg-rose-500/20 text-rose-300 border-rose-500/20',
    final_review: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
    general: 'bg-white/[0.06] text-white/60 border-white/[0.08]',
  }
  return map[phase] ?? map.general
}

export function itemTypeColor(type: string): string {
  const map: Record<string, string> = {
    exam: 'badge-rose',
    assignment: 'badge-violet',
    deadline: 'badge-amber',
    event: 'badge-cyan',
    cancellation: 'badge-gray',
    timetable_change: 'badge-emerald',
    unknown: 'badge-gray',
  }
  return map[type] ?? 'badge-gray'
}

export function alertSeverityColor(sev: string): string {
  const map: Record<string, string> = { info: 'text-cyan-400', warning: 'text-amber-400', critical: 'text-rose-400' }
  return map[sev] ?? 'text-white/60'
}

export function truncate(str: string, n = 80): string {
  return str.length <= n ? str : str.slice(0, n) + '…'
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

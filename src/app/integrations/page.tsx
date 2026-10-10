'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle2, XCircle, Brain, Mic,
} from 'lucide-react'
import api from '@/lib/api'
import { IntegrationStatus } from '@/types'
import { cn } from '@/lib/utils'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/ToastProvider'

function IntCard({
  title, icon, active, label, simulated, detail,
}: {
  title: string; icon: React.ReactNode; active: boolean
  label: string; simulated?: boolean; detail?: string
}) {
  return (
    <div className={cn(
      'glass-card p-5 flex flex-col gap-4',
      active ? 'border-emerald-500/20' : 'border-white/[0.05] opacity-60'
    )}>
      <div className="flex items-center justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', active ? 'bg-emerald-500/10' : 'bg-white/[0.04]')}>
          <span className={active ? 'text-emerald-400' : 'text-white/25'}>{icon}</span>
        </div>
        {active
          ? <CheckCircle2 size={16} className="text-emerald-400" />
          : <XCircle size={16} className="text-white/25" />
        }
      </div>
      <div>
        <p className="text-sm font-semibold text-white/85">{title}</p>
        <p className="text-xs text-white/45 mt-0.5">{label}</p>
        {detail && <p className="text-xs text-white/25 mt-1 font-mono">{detail}</p>}
      </div>
      {simulated && (
        <div className="badge-sim self-start">SIMULATED PROVIDER</div>
      )}
      {active && !simulated && (
        <div className="badge-emerald self-start">LIVE</div>
      )}
    </div>
  )
}

export default function IntegrationsPage() {
  const { toast } = useToast()
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setStatus(await api.integrations()) }
    catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load integration status.', 'error')
    }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <AppShell>
        <Topbar title="Integrations" />
        <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>
      </AppShell>
    )
  }

  const s = status

  return (
    <AppShell>
      <Topbar title="Integrations" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
        <p className="text-sm text-white/40">
          ReCap uses Google sign-in for read-only Gmail access and Gemini for meeting transcription and summaries.
          Credentials stay in the local backend configuration.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <IntCard
            title="Gmail"
            icon={<MailIcon />}
            active={s?.google.connected ?? false}
            label={s?.google.label ?? 'Not connected'}
            detail={s?.google.email ?? 'Read-only email access'}
          />

          <IntCard
            title="Gemini AI"
            icon={<Brain size={18} />}
            active={s?.ai.engine === 'gemini'}
            label={s?.ai.label ?? 'No engine'}
            detail={s?.ai.engine}
          />

          <IntCard
            title="Meeting transcription"
            icon={<Mic size={18} />}
            active={s?.transcription.available ?? false}
            label={s?.transcription.label ?? 'Gemini API key not configured'}
          />

        </div>

        <div className="glass-card p-5">
          <p className="label-text mb-2">Local setup</p>
          <p className="text-sm leading-relaxed text-white/50">
            Configure Google OAuth and GEMINI_API_KEY in <code className="text-cyan-200">backend/.env</code>.
            See the README for the local setup steps. Do not put credentials in frontend environment variables.
          </p>
        </div>
      </div>
    </AppShell>
  )
}

function MailIcon() {
  return <span className="text-base font-bold">G</span>
}

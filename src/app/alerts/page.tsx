'use client'
import { useEffect, useState, useCallback } from 'react'
import { Bell, CheckCheck, Info, AlertTriangle, AlertOctagon, Mail, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { Alert, AlertSeverity, GmailStatus } from '@/types'
import { formatRelative, cn } from '@/lib/utils'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'

const SEV_ICON: Record<AlertSeverity, React.ReactNode> = {
  info:     <Info size={15} className="text-cyan-400" />,
  warning:  <AlertTriangle size={15} className="text-amber-400" />,
  critical: <AlertOctagon size={15} className="text-rose-400" />,
}

const SEV_BADGE: Record<AlertSeverity, string> = {
  info:     'badge-cyan',
  warning:  'badge-amber',
  critical: 'badge-rose',
}

export default function AlertsPage() {
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [gmail, setGmail] = useState<GmailStatus>({ connected: false, email: null })
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, status] = await Promise.all([api.alerts(unreadOnly), api.gmailStatus()])
      setAlerts(res.alerts)
      setGmail(status)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load alerts', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, unreadOnly])

  useEffect(() => { load() }, [load])

  async function syncGmail() {
    setSyncing(true)
    try {
      const result = await api.sync()
      toast(
        `Checked Gmail: ${result.emails_new} new emails, ${result.items_extracted} important dates found.`,
        'success'
      )
      await load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gmail sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  function connectGmail() {
    window.location.assign(api.gmailAuthUrl())
  }

  async function markAllRead() {
    try {
      await api.markAlertsRead()
      toast('All alerts marked as read', 'success')
      load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to mark read', 'error')
    }
  }

  async function markOneRead(id: string) {
    try {
      await api.markAlertsRead([id])
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to mark alert as read', 'error')
    }
  }

  const filtered = alerts.filter((a) => filter === 'all' || a.severity === filter)
  const unreadCount = alerts.filter((a) => !a.is_read).length

  return (
    <AppShell>
      <Topbar title="Alerts" unreadAlerts={unreadCount} showSync={false} />
      <main className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Stay ahead</h2>
            <p className="mt-1 text-sm text-white/45">
              Class changes, reminders, project deadlines, and exam updates from your Gmail.
            </p>
            {gmail.connected && gmail.email && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-emerald-300/80">
                <Mail size={12} /> Connected to {gmail.email}
                {gmail.last_sync && <span className="text-white/35">· Last synced {formatRelative(gmail.last_sync)}</span>}
              </p>
            )}
          </div>
          {gmail.connected ? (
            <button onClick={syncGmail} disabled={syncing} className="btn-primary shrink-0">
              {syncing ? <Spinner size="sm" /> : <RefreshCw size={14} />}
              {syncing ? 'Checking Gmail…' : 'Sync Gmail'}
            </button>
          ) : (
            <button onClick={connectGmail} className="btn-secondary shrink-0">
              <Mail size={14} /> Connect Gmail
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'info', 'warning', 'critical'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                aria-pressed={filter === s}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  filter === s
                    ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/25'
                    : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80'
                )}
              >
                {s === 'all' ? `All (${alerts.length})` : s}
              </button>
            ))}
            <button
              onClick={() => setUnreadOnly((p) => !p)}
              aria-pressed={unreadOnly}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                unreadOnly
                  ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25'
                  : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80'
              )}
            >
              Unread · {unreadCount}
            </button>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-xs h-8 px-3">
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>

        {/* Alerts list */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Bell size={24} />}
            title={unreadOnly ? 'No unread alerts' : 'No alerts here'}
            description={unreadOnly ? "You're all caught up." : 'New class and study updates will appear here.'}
          />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((alert) => (
              <article
                key={alert.id}
                className={cn(
                  'glass-card flex items-start gap-3 p-4 transition-colors sm:gap-4',
                  !alert.is_read
                    ? 'border-violet-500/20 bg-violet-500/[0.04]'
                    : 'opacity-75'
                )}
              >
                <div className="mt-0.5 shrink-0">{SEV_ICON[alert.severity]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white/90">{alert.title}</h3>
                    {alert.category && alert.category !== 'unknown' && (
                      <span className="badge-violet capitalize">{alert.category.replace('_', ' ')}</span>
                    )}
                    <span className={SEV_BADGE[alert.severity]}>{alert.severity}</span>
                    {!alert.is_read && (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/55 mt-1 leading-relaxed">{alert.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/35">
                    <span>{formatRelative(alert.created_at)}</span>
                    {alert.source_type && (
                      <span className="capitalize">From {alert.source_type === 'email' ? 'Gmail' : 'meeting notes'}</span>
                    )}
                    {alert.date && <span>Event date: {alert.date}{alert.time ? ` · ${alert.time}` : ''}</span>}
                    {alert.location && <span>Location: {alert.location}</span>}
                  </div>
                </div>
                {!alert.is_read && (
                  <button
                    type="button"
                    onClick={() => markOneRead(alert.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                    aria-label={`Mark "${alert.title}" as read`}
                  >
                    Mark read
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </AppShell>
  )
}

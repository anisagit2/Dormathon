'use client'
import Link from 'next/link'
import { Bell, RefreshCw, WifiOff } from 'lucide-react'
import { useState } from 'react'
import api from '@/lib/api'
import { useToast } from '@/components/ui/ToastProvider'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

interface TopbarProps {
  title: string
  unreadAlerts?: number
  simulated?: boolean
  onSync?: () => void
  showSync?: boolean
}

export default function Topbar({
  title,
  unreadAlerts = 0,
  simulated = false,
  onSync,
  showSync = true,
}: TopbarProps) {
  const { toast } = useToast()
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.sync()
      toast(`Synced — ${res.emails_new} new emails, ${res.items_extracted} items extracted.`, 'success')
      onSync?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sync failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <header className="h-14 flex items-center gap-4 px-6 border-b border-white/[0.05] bg-navy-900/40 backdrop-blur-xl shrink-0">
      {/* Title */}
      <h1 className="text-sm font-semibold text-white/80 flex-1">{title}</h1>

      {/* Simulated badge */}
      {simulated && (
        <div className="badge-sim flex items-center gap-1.5">
          <WifiOff size={11} />
          SIMULATED
        </div>
      )}

      {showSync && (
        <button
          id="btn-sync"
          onClick={handleSync}
          disabled={syncing}
          className="btn-secondary h-8 px-3 text-xs"
        >
          {syncing ? <Spinner size="sm" /> : <RefreshCw size={13} />}
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      )}

      {/* Alerts bell */}
      <Link href="/alerts" className="relative p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all">
        <Bell size={18} />
        {unreadAlerts > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-rose-500 text-white flex items-center justify-center">
            {unreadAlerts > 9 ? '9+' : unreadAlerts}
          </span>
        )}
      </Link>
    </header>
  )
}

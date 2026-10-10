'use client'
import { useEffect, useState, useCallback } from 'react'
import { Mail, Search, ChevronRight, RefreshCw, Inbox } from 'lucide-react'
import api from '@/lib/api'
import { Email } from '@/types'
import { formatRelative, truncate, itemTypeColor, cn } from '@/lib/utils'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import ConfidencePill from '@/components/ui/ConfidencePill'
import { useToast } from '@/components/ui/ToastProvider'

export default function EmailsPage() {
  const { toast } = useToast()
  const [emails, setEmails] = useState<Email[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Email | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.emails(page, 20)
      setEmails(res.emails)
      setTotal(res.total)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load emails', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, toast])

  useEffect(() => { load() }, [load])

  async function openEmail(e: Email) {
    try {
      const full = await api.email(e.id)
      setSelected(full)
    } catch {
      setSelected(e)
    }
  }

  const filtered = emails.filter((e) =>
    !query ||
    e.subject.toLowerCase().includes(query.toLowerCase()) ||
    e.sender.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <AppShell>
      <Topbar title="Emails" onSync={load} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="px-6 py-3 border-b border-white/[0.05] flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              className="input-field pl-9 h-9"
              placeholder="Search subject or sender…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="text-xs text-white/30 tabular-nums">{total} emails</span>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Inbox size={24} />} title="No emails found" description="Connect Gmail and sync to find class changes, deadlines, and exam dates." />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {filtered.map((email) => (
                <li
                  key={email.id}
                  onClick={() => openEmail(email)}
                  className="flex gap-4 px-6 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {!email.is_read
                      ? <div className="w-2 h-2 rounded-full bg-violet-500" />
                      : <div className="w-2 h-2" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm truncate', email.is_read ? 'text-white/55 font-normal' : 'text-white/90 font-semibold')}>
                        {email.subject}
                      </p>
                      <span className="text-[10px] text-white/30 shrink-0">{formatRelative(email.received_at)}</span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{email.sender}</p>
                    <p className="text-xs text-white/30 mt-1 line-clamp-1">{email.body_preview}</p>
                    {/* Extracted item badges */}
                    {(email.extracted_items?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {email.extracted_items!.map((item) => (
                          <span key={item.id} className={itemTypeColor(item.type)}>
                            {item.type.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className="shrink-0 self-center text-white/20 group-hover:text-white/50 transition-colors" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-6 py-3 border-t border-white/[0.05] flex items-center justify-between">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs disabled:opacity-40">
              Previous
            </button>
            <span className="text-xs text-white/30">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)} className="btn-secondary text-xs disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>

      {/* Email detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.subject} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-white/40">
              <span>{selected.sender}</span>
              <span>{formatRelative(selected.received_at)}</span>
            </div>
            {selected.simulated && (
              <div className="badge-sim self-start">SIMULATED EMAIL</div>
            )}
            <div className="rounded-xl bg-navy-900/60 border border-white/[0.06] p-4 text-sm text-white/70 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono leading-relaxed">
              {selected.body_preview}
            </div>
            {/* Extracted items */}
            {(selected.extracted_items?.length ?? 0) > 0 && (
              <div>
                <p className="label-text mb-3">Extracted Items</p>
                <div className="space-y-2">
                  {selected.extracted_items!.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <span className={itemTypeColor(item.type)}>{item.type.replace('_', ' ')}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80">{item.title}</p>
                        {item.date && <p className="text-xs text-white/40 mt-0.5">{item.date} {item.time ?? ''}</p>}
                        <ConfidencePill value={item.confidence} className="mt-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  )
}

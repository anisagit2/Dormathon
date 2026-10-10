'use client'
import { useEffect, useState, useCallback } from 'react'
import { Save, AlertTriangle, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { Settings } from '@/types'
import { cn } from '@/lib/utils'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/ToastProvider'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-4 border-b border-white/[0.04] items-start">
      <div>
        <p className="text-sm font-medium text-white/75">{label}</p>
        {note && <p className="text-xs text-white/30 mt-0.5">{note}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setSettings(await api.settings()) }
    catch (e) { toast(e instanceof Error ? e.message : 'Failed to load settings', 'error') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await api.saveSettings(settings)
      setSettings(updated)
      toast('Settings saved', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!confirm('This will delete ALL data (emails, notes, plans, proposals). Continue?')) return
    setResetting(true)
    try {
      await api.reset()
      toast('Database reset — reload to start fresh', 'warning')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Reset failed', 'error')
    } finally {
      setResetting(false)
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function updateWindow(dayIdx: number, field: 'start' | 'end', value: string) {
    setSettings((prev) => {
      if (!prev) return prev
      const windows = { ...prev.study_windows }
      const key = String(dayIdx)
      const existing = windows[key] ?? { start: '09:00', end: '22:00' }
      windows[key] = { ...existing, [field]: value }
      return { ...prev, study_windows: windows }
    })
  }

  function toggleWindow(dayIdx: number) {
    setSettings((prev) => {
      if (!prev) return prev
      const windows = { ...prev.study_windows }
      const key = String(dayIdx)
      windows[key] = windows[key] ? null : { start: '09:00', end: '22:00' }
      return { ...prev, study_windows: windows }
    })
  }

  if (loading) {
    return (
      <AppShell>
        <Topbar title="Settings" />
        <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>
      </AppShell>
    )
  }

  const s = settings!

  return (
    <AppShell>
      <Topbar title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Identity */}
          <div className="glass-card p-5">
            <p className="label-text mb-4">Identity</p>
            <Field label="Name" note="Your display name">
              <input className="input-field" value={s.student_name} onChange={(e) => update('student_name', e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input-field" type="email" value={s.student_email} onChange={(e) => update('student_email', e.target.value)} />
            </Field>
            <Field label="Timezone" note="IANA timezone string">
              <input className="input-field" value={s.student_tz} onChange={(e) => update('student_tz', e.target.value)} />
            </Field>
          </div>

          {/* Planner */}
          <div className="glass-card p-5">
            <p className="label-text mb-4">Planner</p>
            <Field label="Daily Study Cap" note="Maximum minutes/day">
              <input
                className="input-field"
                type="number" min={30} max={720} step={30}
                value={s.max_study_min_per_day}
                onChange={(e) => update('max_study_min_per_day', parseInt(e.target.value))}
              />
            </Field>
            <Field label="Plan Horizon" note="Days ahead to schedule">
              <input
                className="input-field"
                type="number" min={1} max={90}
                value={s.plan_horizon_days}
                onChange={(e) => update('plan_horizon_days', parseInt(e.target.value))}
              />
            </Field>
            <Field label="Mail Lookback" note="Days back to scan emails">
              <input
                className="input-field"
                type="number" min={1} max={365}
                value={s.mail_lookback_days}
                onChange={(e) => update('mail_lookback_days', parseInt(e.target.value))}
              />
            </Field>
          </div>

          {/* Study windows */}
          <div className="glass-card p-5">
            <p className="label-text mb-4">Daily Study Windows</p>
            <div className="space-y-3">
              {DAYS.map((day, i) => {
                const win = s.study_windows[String(i)]
                return (
                  <div key={day} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleWindow(i)}
                      className={cn(
                        'w-24 shrink-0 text-xs font-medium py-1.5 px-2 rounded-lg transition-all',
                        win ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20' : 'bg-white/[0.04] text-white/30'
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                    {win ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          className="input-field w-32"
                          value={win.start}
                          onChange={(e) => updateWindow(i, 'start', e.target.value)}
                        />
                        <span className="text-white/30 text-xs">to</span>
                        <input
                          type="time"
                          className="input-field w-32"
                          value={win.end}
                          onChange={(e) => updateWindow(i, 'end', e.target.value)}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-white/20 italic">Off (no study sessions)</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Safety */}
          <div className="glass-card p-5">
            <p className="label-text mb-4">Safety</p>
            <Field label="Calendar Read-Only" note="Blocks all live calendar writes">
              <button
                onClick={() => update('calendar_read_only', !s.calendar_read_only)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors duration-200',
                  s.calendar_read_only ? 'bg-rose-500' : 'bg-white/10'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow',
                  s.calendar_read_only ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </Field>
            <Field label="Webhook URL" note="Slack-compatible push alerts">
              <input
                className="input-field"
                type="url"
                placeholder="https://hooks.slack.com/…"
                value={s.notify_webhook_url ?? ''}
                onChange={(e) => update('notify_webhook_url', e.target.value || undefined)}
              />
            </Field>
          </div>

          {/* Save / Reset */}
          <div className="flex items-center justify-between">
            <button onClick={reset} disabled={resetting} className="btn-danger">
              {resetting ? <Spinner size="sm" /> : <RotateCcw size={14} />}
              Reset Database
            </button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" /> : <Save size={14} />}
              Save Settings
            </button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs text-amber-300/70 mt-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Reset permanently deletes all emails, notes, extracted items, calendar proposals, study plans, and alerts.
          </div>
        </div>
      </div>
    </AppShell>
  )
}

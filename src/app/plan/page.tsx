'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, TrendingUp, CheckCircle2, SkipForward,
  Circle, Clock, Calendar, Plus, UploadCloud, Sparkles,
} from 'lucide-react'
import api from '@/lib/api'
import { Note, StudyPlan, StudySession, SessionStatus } from '@/types'
import { formatDate, formatRelative, phaseLabel, phaseColor, cn } from '@/lib/utils'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'

// Group sessions by date
function groupByDate(sessions: StudySession[]): Map<string, StudySession[]> {
  const map = new Map<string, StudySession[]>()
  for (const s of sessions) {
    const list = map.get(s.date) ?? []
    list.push(s)
    map.set(s.date, list)
  }
  return map
}

function SessionCard({
  session,
  onStatus,
}: {
  session: StudySession
  onStatus: (id: string, status: SessionStatus) => void
}) {
  const durationMin =
    (new Date(`1970-01-01T${session.end_time}`).getTime() -
      new Date(`1970-01-01T${session.start_time}`).getTime()) /
    60000

  return (
    <div
      className={cn(
        'glass-card p-4 transition-all duration-200',
        session.status === 'done' && 'opacity-50',
        session.status === 'skipped' && 'opacity-35',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <button
          className="mt-0.5 shrink-0"
          onClick={() =>
            onStatus(
              session.id,
              session.status === 'done' ? 'planned' : 'done'
            )
          }
          title="Toggle done"
        >
          {session.status === 'done' ? (
            <CheckCircle2 size={18} className="text-emerald-400" />
          ) : session.status === 'skipped' ? (
            <SkipForward size={18} className="text-white/25" />
          ) : (
            <Circle size={18} className="text-white/20 hover:text-violet-400 transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white/85">{session.title}</p>
            <span className={cn('badge border text-xs', phaseColor(session.phase))}>
              {phaseLabel(session.phase)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {session.start_time}–{session.end_time} ({durationMin}m)
            </span>
            <span className="text-white/20">·</span>
            <span>{session.subject}</span>
          </div>
          {session.rationale && (
            <p className="mt-3 border-l border-violet-400/30 pl-2.5 text-xs leading-relaxed text-white/40">
              <span className="font-medium not-italic text-white/55">Why this session: </span>
              {session.rationale}
            </p>
          )}
        </div>

        {/* Skip button */}
        {session.status === 'planned' && (
          <button
            onClick={() => onStatus(session.id, 'skipped')}
            className="shrink-0 p-1 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all"
            title="Skip"
          >
            <SkipForward size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function PlanPage() {
  const { toast } = useToast()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [recordingOpen, setRecordingOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [recording, setRecording] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, noteResponse] = await Promise.all([api.plan(), api.notes(1, 10)])
      setPlan(p)
      setNotes(noteResponse.notes)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load plan', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  async function uploadRecording() {
    if (!meetingTitle.trim() || !recording) {
      toast('Add a meeting title and choose an audio recording.', 'warning')
      return
    }
    if (recording.size > 25 * 1024 * 1024) {
      toast('The audio file must be 25 MB or smaller.', 'warning')
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('title', meetingTitle.trim())
      body.append('audio', recording)
      const note = await api.uploadMeeting(body)
      setNotes((previous) => [note, ...previous.filter((item) => item.id !== note.id)])
      setMeetingTitle('')
      setRecording(null)
      setRecordingOpen(false)
      toast('Meeting summarized. Review the key points before generating your study plan.', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not process the meeting recording.', 'error')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true)
    try {
      const p = await api.generatePlan()
      setPlan(p)
      toast(`Plan generated — ${p.total_sessions} sessions over ${p.horizon_days} days`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function setStatus(id: string, status: SessionStatus) {
    try {
      await api.sessionStatus(id, status)
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              sessions: prev.sessions.map((s) =>
                s.id === id ? { ...s, status } : s
              ),
            }
          : prev
      )
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Update failed', 'error')
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Topbar title="Study Plan" showSync={false} />
        <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>
      </AppShell>
    )
  }

  const grouped = plan ? groupByDate(plan.sessions) : new Map<string, StudySession[]>()
  const today = new Date().toISOString().slice(0, 10)
  const doneSessions = plan?.sessions.filter((s) => s.status === 'done').length ?? 0
  const totalMin = plan?.total_study_minutes ?? 0

  return (
    <AppShell>
      <Topbar title="Study Plan" showSync={false} />
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 animate-fade-in">

        {/* Header + generate button */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="section-title">Your study plan</h2>
            {plan && (
              <p className="text-xs text-white/35 mt-1">
                Updated {formatRelative(plan.created_at)} · planned around your upcoming study
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRecordingOpen(true)} className="btn-secondary">
              <Plus size={15} /> Add meeting
            </button>
            <button onClick={generate} disabled={generating} className="btn-primary">
              {generating ? <Spinner size="sm" /> : <TrendingUp size={14} />}
              {generating ? 'Generating…' : plan ? 'Generate this week' : 'Generate study plan'}
            </button>
          </div>
        </div>

        {notes.length > 0 && (
          <section className="space-y-3" aria-labelledby="meeting-notes-heading">
            <div>
              <h3 id="meeting-notes-heading" className="text-sm font-semibold text-white/80">
                Meeting notes & key dates
              </h3>
              <p className="mt-1 text-xs text-white/40">
                Review extracted lesson points and dates before building your plan.
              </p>
            </div>
            {notes.slice(0, 5).map((note) => (
              <article key={note.id} className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-300" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white/85">{note.title}</h4>
                      <span className="text-xs text-white/35">{formatRelative(note.created_at)}</span>
                    </div>
                    {note.summary && (
                      <p className="mt-2 text-sm leading-relaxed text-white/60">{note.summary}</p>
                    )}
                    {(note.key_points ?? []).length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {note.key_points!.slice(0, 5).map((point, index) => (
                          <li key={`${note.id}-point-${index}`} className="flex gap-2 text-xs leading-relaxed text-white/55">
                            <span className="text-violet-300">•</span><span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(note.extracted_items ?? []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {note.extracted_items!.map((item) => (
                          <span key={item.id} className="badge-amber">
                            {item.title}{item.date ? ` · ${item.date}` : ' · date not confirmed'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {!plan ? (
          <EmptyState
            icon={<BookOpen size={26} />}
            title="No study plan yet"
            description="Add a class recording to capture key points and due dates, then generate a weekly study plan."
          />
        ) : (
          <>
            {/* Compact progress summary */}
            <div className="glass-card flex flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-white/85">{plan.total_sessions}</span>
                <span className="text-xs text-white/40">sessions</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-emerald-300">{doneSessions}</span>
                <span className="text-xs text-white/40">completed</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-cyan-300">{(totalMin / 60).toFixed(1)}h</span>
                <span className="text-xs text-white/40">study time</span>
              </div>
              <span className="ml-auto text-xs text-white/35">{plan.horizon_days}-day plan</span>
            </div>

            {/* Sessions by day */}
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([date, sessions]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      'flex items-center gap-2',
                      date === today ? 'text-violet-400' : 'text-white/40'
                    )}>
                      <Calendar size={13} />
                      <span className="text-sm font-semibold">
                        {formatDate(date, 'EEEE, dd MMM')}
                        {date === today && (
                          <span className="ml-2 badge-violet text-xs">Today</span>
                        )}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-white/[0.05]" />
                    <span className="text-xs text-white/25">
                      {sessions.reduce((acc, s) => {
                        const start = new Date(`1970-01-01T${s.start_time}`)
                        const end   = new Date(`1970-01-01T${s.end_time}`)
                        return acc + (end.getTime() - start.getTime()) / 60000
                      }, 0)}m
                    </span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {sessions.map((s) => (
                      <SessionCard key={s.id} session={s} onStatus={setStatus} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Modal
        open={recordingOpen}
        onClose={() => {
          if (!uploading) {
            setRecordingOpen(false)
            setMeetingTitle('')
            setRecording(null)
          }
        }}
        title="Add a recorded meeting"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-white/50">
            The recording is sent to the Google Gemini API to transcribe and summarize the lesson and identify
            project or exam dates. ReCap deletes the temporary audio after processing; the meeting notes are saved.
          </p>
          <div>
            <label htmlFor="meeting-title" className="label-text mb-1.5 block">Meeting title</label>
            <input
              id="meeting-title"
              className="input-field"
              placeholder="e.g. Biology lecture — cell division"
              value={meetingTitle}
              onChange={(event) => setMeetingTitle(event.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="meeting-audio" className="label-text mb-1.5 block">Audio recording</label>
            <input
              id="meeting-audio"
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,audio/*"
              className="input-field file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-200"
              onChange={(event) => setRecording(event.target.files?.[0] ?? null)}
            />
            <p className="mt-1.5 text-xs text-white/35">MP3, WAV, M4A, AAC, OGG, FLAC, or WEBM · up to 25 MB</p>
          </div>
          {recording && <p className="text-xs text-white/50">Selected: {recording.name}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setRecordingOpen(false); setMeetingTitle(''); setRecording(null) }}
              disabled={uploading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={uploadRecording}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? <Spinner size="sm" /> : <UploadCloud size={14} />}
              {uploading ? 'Summarizing…' : 'Summarize meeting'}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}

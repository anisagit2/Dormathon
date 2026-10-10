'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  FileText, Plus, Trash2, ChevronRight, Upload,
  Sparkles, Tag, CheckSquare, X,
} from 'lucide-react'
import api from '@/lib/api'
import { Note, ExtractedItem } from '@/types'
import { formatRelative, formatDateTime, itemTypeColor, cn } from '@/lib/utils'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import ConfidencePill from '@/components/ui/ConfidencePill'
import { useToast } from '@/components/ui/ToastProvider'

export default function NotesPage() {
  const { toast } = useToast()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Note | null>(null)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.notes(1, 50)
      setNotes(res.notes)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load notes', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!title.trim() || !content.trim()) {
      toast('Title and content are required', 'warning')
      return
    }
    setSubmitting(true)
    try {
      await api.createNote({ title: title.trim(), content: content.trim() })
      toast('Note analysed and saved', 'success')
      setAdding(false)
      setTitle(''); setContent('')
      load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save note', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteNote(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this note?')) return
    try {
      await api.deleteNote(id)
      toast('Note deleted', 'info')
      if (selected?.id === id) setSelected(null)
      load()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error')
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setContent(ev.target?.result as string ?? '')
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function openNote(n: Note) {
    try {
      const full = await api.note(n.id)
      setSelected(full)
    } catch { setSelected(n) }
  }

  return (
    <AppShell>
      <Topbar title="Meeting Notes" />
      <div className="flex-1 flex overflow-hidden">
        {/* Notes list */}
        <div className="w-72 shrink-0 border-r border-white/[0.05] flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <span className="text-xs text-white/40">{notes.length} notes</span>
            <button onClick={() => setAdding(true)} className="btn-primary text-xs h-7 px-2.5">
              <Plus size={12} /> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10"><Spinner /></div>
            ) : notes.length === 0 ? (
              <EmptyState icon={<FileText size={20} />} title="No notes yet" description="Paste or upload a meeting transcript." />
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    onClick={() => openNote(note)}
                    className={cn(
                      'px-4 py-3 cursor-pointer transition-colors group',
                      selected?.id === note.id ? 'bg-violet-500/10' : 'hover:bg-white/[0.03]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white/80 line-clamp-2 flex-1">{note.title}</p>
                      <button
                        onClick={(e) => deleteNote(note.id, e)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="text-xs text-white/30 mt-1">{formatRelative(note.created_at)}</p>
                    {(note.extracted_items?.length ?? 0) > 0 && (
                      <span className="badge-violet mt-1">{note.extracted_items!.length} items</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Note detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {selected ? (
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-white/90">{selected.title}</h2>
                <p className="text-xs text-white/35 mt-1">{formatDateTime(selected.created_at)}</p>
                {selected.simulated && <span className="badge-sim mt-2">SIMULATED</span>}
              </div>

              {/* Summary */}
              {selected.summary && (
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-violet-400" />
                    <p className="label-text">AI Summary</p>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{selected.summary}</p>
                </div>
              )}

              {/* Key points, topics, action items */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(selected.key_points?.length ?? 0) > 0 && (
                  <div className="glass-card p-4">
                    <p className="label-text mb-2">Key Points</p>
                    <ul className="space-y-1">
                      {selected.key_points!.map((kp, i) => (
                        <li key={i} className="text-xs text-white/65 flex gap-2 items-start">
                          <span className="text-violet-400 mt-0.5">·</span>{kp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(selected.topics?.length ?? 0) > 0 && (
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-1.5 mb-2"><Tag size={12} className="text-cyan-400" /><p className="label-text">Topics</p></div>
                    <div className="flex flex-wrap gap-1">
                      {selected.topics!.map((t, i) => <span key={i} className="badge-cyan">{t}</span>)}
                    </div>
                  </div>
                )}
                {(selected.action_items?.length ?? 0) > 0 && (
                  <div className="glass-card p-4">
                    <div className="flex items-center gap-1.5 mb-2"><CheckSquare size={12} className="text-emerald-400" /><p className="label-text">Action Items</p></div>
                    <ul className="space-y-1">
                      {selected.action_items!.map((ai, i) => (
                        <li key={i} className="text-xs text-white/65 flex gap-2 items-start">
                          <span className="text-emerald-400 mt-0.5">✓</span>{ai}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Raw content */}
              <div className="glass-card p-4">
                <p className="label-text mb-2">Transcript</p>
                <pre className="text-xs text-white/50 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{selected.content}</pre>
              </div>

              {/* Extracted items */}
              {(selected.extracted_items?.length ?? 0) > 0 && (
                <div>
                  <p className="label-text mb-3">Extracted Items</p>
                  <div className="space-y-2">
                    {selected.extracted_items!.map((item) => (
                      <div key={item.id} className="glass-card p-3 flex items-start gap-3">
                        <span className={itemTypeColor(item.type)}>{item.type.replace('_', ' ')}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/80">{item.title}</p>
                          {item.description && <p className="text-xs text-white/40 mt-0.5">{item.description}</p>}
                          {item.date && <p className="text-xs text-white/35 mt-0.5">{item.date} {item.time ?? ''}</p>}
                          <ConfidencePill value={item.confidence} className="mt-1.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<FileText size={24} />}
              title="Select a note"
              description="Click a note on the left or add a new one."
            />
          )}
        </div>
      </div>

      {/* Add note modal */}
      <Modal open={adding} onClose={() => { setAdding(false); setTitle(''); setContent('') }} title="New Meeting Note" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label-text mb-1.5 block">Title</label>
            <input
              className="input-field"
              placeholder="e.g. Dr. Chen — Linear Algebra Q3 review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label-text">Transcript / Notes</label>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn-secondary text-xs h-7 px-2.5"
              >
                <Upload size={11} /> Upload .txt / .md
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFile} />
            </div>
            <textarea
              className="textarea-field min-h-[200px]"
              placeholder="Paste meeting transcript here… The AI will extract deadlines, exams, and action items."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => { setAdding(false); setTitle(''); setContent('') }} className="btn-secondary">Cancel</button>
            <button onClick={submit} disabled={submitting} className="btn-primary">
              {submitting ? <Spinner size="sm" /> : <Sparkles size={14} />}
              {submitting ? 'Analysing…' : 'Analyse & Save'}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}

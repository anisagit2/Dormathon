// ─── Centralised API client ───────────────────────────────────────────────────
// API calls use the Next.js proxy except audio uploads, which go directly to Flask.

import type {
  AppState, SyncResult, IntegrationStatus,
  Email, Note, ExtractedItem, ItemStatus,
  CalendarEvent, CalendarProposal, ProposalDecision,
  StudyPlan, SessionStatus,
  Alert, Settings, LogEntry, GmailStatus,
} from '@/types'

const BASE = '/api'
const PUBLIC_BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
).replace(/\/+$/, '')

async function apiFetch<T>(path: string, options?: RequestInit, base = BASE): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData
  const res = await fetch(`${base}${path}`, {
    headers: isFormData
      ? options?.headers
      : { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    let message = text
    try {
      const payload: unknown = JSON.parse(text)
      if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
      ) {
        message = payload.error
      }
    } catch {
      // Keep the raw response text for non-JSON errors.
    }
    throw new Error(message || `Request failed (${res.status}).`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Dashboard
  state: () => apiFetch<AppState>('/state'),

  // Sync
  sync: () => apiFetch<SyncResult>('/sync', { method: 'POST' }),

  // Integrations
  integrations: () => apiFetch<IntegrationStatus>('/integrations'),

  // Emails
  emails: (page = 1, per_page = 20) =>
    apiFetch<{ emails: Email[]; total: number }>(`/emails?page=${page}&per_page=${per_page}`),
  email: (id: string) => apiFetch<Email>(`/emails/${id}`),

  // Notes
  notes: (page = 1, per_page = 20) =>
    apiFetch<{ notes: Note[]; total: number }>(`/notes?page=${page}&per_page=${per_page}`),
  note: (id: string) => apiFetch<Note>(`/notes/${id}`),
  createNote: (data: { title: string; content: string }) =>
    apiFetch<Note>('/notes', { method: 'POST', body: JSON.stringify(data) }),
  uploadMeeting: (data: FormData) =>
    apiFetch<Note>('/api/notes/audio', { method: 'POST', body: data }, PUBLIC_BACKEND_URL),
  deleteNote: (id: string) =>
    apiFetch<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' }),

  // Extracted items
  items: (status?: ItemStatus) =>
    apiFetch<{ items: ExtractedItem[] }>(`/items${status ? `?status=${status}` : ''}`),
  itemStatus: (id: string, status: ItemStatus) =>
    apiFetch<{ ok: boolean }>(`/items/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Calendar
  calendar: (from?: string, to?: string) =>
    apiFetch<{ events: CalendarEvent[] }>(
      `/calendar${from ? `?from=${from}${to ? `&to=${to}` : ''}` : ''}`
    ),

  // Proposals
  proposals: (status?: string) =>
    apiFetch<{ proposals: CalendarProposal[] }>(
      `/proposals${status ? `?status=${status}` : ''}`
    ),
  decideProposal: (id: string, decision: ProposalDecision) =>
    apiFetch<{ ok: boolean }>(`/proposals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  applyProposal: (id: string) =>
    apiFetch<{ ok: boolean; error?: string }>(`/proposals/${id}/apply`, { method: 'POST' }),
  applyAllApproved: () =>
    apiFetch<{ applied: number; failed: number }>('/proposals/apply-approved', { method: 'POST' }),

  // Study plan
  plan: () => apiFetch<StudyPlan | null>('/plan'),
  generatePlan: () => apiFetch<StudyPlan>('/plan/generate', { method: 'POST' }),
  sessionStatus: (id: string, status: SessionStatus) =>
    apiFetch<{ ok: boolean }>(`/sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Alerts
  gmailStatus: () => apiFetch<GmailStatus>('/gmail/status'),
  gmailAuthUrl: () =>
    `${PUBLIC_BACKEND_URL}/auth/google/start`,
  alerts: (unread_only = false) =>
    apiFetch<{ alerts: Alert[] }>(`/alerts${unread_only ? '?unread=1' : ''}`),
  markAlertsRead: (ids?: string[]) =>
    apiFetch<{ ok: boolean }>('/alerts/read', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Settings
  settings: () => apiFetch<Settings>('/settings'),
  saveSettings: (data: Partial<Settings>) =>
    apiFetch<Settings>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Log
  log: (level?: string, limit = 200) =>
    apiFetch<{ entries: LogEntry[] }>(`/log?limit=${limit}${level ? `&level=${level}` : ''}`),

  // Reset
  reset: () => apiFetch<{ ok: boolean }>('/reset', { method: 'POST' }),
}

export default api

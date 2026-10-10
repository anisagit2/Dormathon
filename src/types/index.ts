// ─── Core domain types that mirror the Flask backend ─────────────────────────

export type SimFlag = { simulated?: 0 | 1 }

// Integration status
export interface IntegrationStatus {
  google: {
    provider: 'gmail' | 'none'
    label: string
    connected: boolean
    email: string | null
    scopes: string[]
  }
  ai: {
    engine: 'gemini' | 'not_configured'
    label: string
    simulated: boolean
  }
  transcription: {
    available: boolean
    label: string
  }
  webhook: {
    configured: boolean
    url?: string
  }
  mcp_servers: string[]
}

// Email
export interface Email {
  id: string
  subject: string
  sender: string
  received_at: string        // ISO
  body_preview: string
  is_read: boolean
  simulated?: boolean
  extracted_items?: ExtractedItem[]
}

// Extracted item (deadline / exam / timetable change / etc.)
export type ItemType = 'exam' | 'assignment' | 'deadline' | 'event' | 'cancellation' | 'timetable_change' | 'unknown'
export type ItemStatus = 'pending' | 'confirmed' | 'rejected' | 'done'

export interface ExtractedItem {
  id: string
  source_type: 'email' | 'note'
  source_id: string
  type: ItemType
  title: string
  description?: string
  date?: string              // ISO date
  time?: string
  end_date?: string
  end_time?: string
  location?: string
  confidence: number         // 0–1
  status: ItemStatus
  simulated?: boolean
  created_at: string
}

// Meeting note
export interface Note {
  id: string
  title: string
  content: string
  created_at: string
  summary?: string
  key_points?: string[]
  topics?: string[]
  action_items?: string[]
  extracted_items?: ExtractedItem[]
  simulated?: boolean
}

// Calendar event
export interface CalendarEvent {
  id: string
  alert_id: string
  source_type: 'email' | 'note'
  source_id: string
  title: string
  description?: string
  date: string               // YYYY-MM-DD
  time: string | null
  end_date?: string | null
  end_time?: string | null
  location?: string
  type: ItemType
  all_day: boolean
}

// Proposal
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'failed'
export type ProposalDecision = 'approve' | 'reject'

export interface ValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
}

export interface CalendarProposal {
  id: string
  item_id: string
  title: string
  start: string
  end: string
  location?: string
  status: ProposalStatus
  validation_errors: ValidationIssue[]
  validation_warnings: ValidationIssue[]
  confidence: number
  created_at: string
  simulated?: boolean
}

// Study plan session
export type SessionStatus = 'planned' | 'done' | 'skipped'
export type StudyPhase = 'concept_review' | 'practice' | 'mock_test' | 'final_review' | 'general'

export interface StudySession {
  id: string
  plan_id: string
  title: string
  subject: string
  date: string               // YYYY-MM-DD
  start_time: string         // HH:MM
  end_time: string
  phase: StudyPhase
  rationale: string
  status: SessionStatus
}

export interface StudyPlan {
  id: string
  created_at: string
  horizon_days: number
  total_sessions: number
  total_study_minutes: number
  sessions: StudySession[]
  archived?: boolean
}

// Alert
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface Alert {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  is_read: boolean
  created_at: string
  related_item_id?: string
  category?: ItemType | null
  date?: string | null
  time?: string | null
  location?: string | null
  source_type?: 'email' | 'note' | null
  source_id?: string | null
}

// Settings
export interface Settings {
  student_name: string
  student_email: string
  student_tz: string
  max_study_min_per_day: number
  plan_horizon_days: number
  mail_lookback_days: number
  calendar_read_only: boolean
  notify_webhook_url?: string
  study_windows: Record<string, { start: string; end: string } | null>  // 0=Mon..6=Sun
}

// Dashboard state
export interface AppState {
  emails_count: number
  notes_count: number
  pending_proposals: number
  unread_alerts: number
  active_plan_sessions: number
  last_sync?: string
  integration_provider: string
  simulated: boolean
}

// Log entry
export interface LogEntry {
  id: string
  level: 'debug' | 'info' | 'warning' | 'error'
  message: string
  created_at: string
  context?: Record<string, unknown>
}

// Generic paginated response
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

// Sync result
export interface SyncResult {
  emails_fetched: number
  emails_new: number
  items_extracted: number
  alerts_created: number
  simulated: boolean
  duration_ms: number
}

export interface GmailStatus {
  connected: boolean
  email: string | null
  last_sync?: string | null
}

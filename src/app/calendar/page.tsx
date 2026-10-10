'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react'
import api from '@/lib/api'
import { CalendarEvent } from '@/types'
import { cn, itemTypeColor } from '@/lib/utils'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day))
}

function eventTypeLabel(type: CalendarEvent['type']) {
  return type.replace('_', ' ')
}

function CalendarEventDetails({ event }: { event: CalendarEvent }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
      <span className="inline-flex items-center gap-1">
        <Clock3 size={12} />
        {event.all_day ? 'All day' : `${event.time}${event.end_time ? `–${event.end_time}` : ''}`}
      </span>
      {event.location && (
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} /> {event.location}
        </span>
      )}
      <span>{event.source_type === 'email' ? 'From Gmail' : 'From meeting notes'}</span>
    </div>
  )
}

export default function CalendarPage() {
  const { toast } = useToast()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const monthKey = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(viewMonth)
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const gridStart = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    1 - firstOfMonth.getDay(),
  )
  const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 41)
  const rangeStart = dateKey(gridStart)
  const rangeEnd = dateKey(gridEnd)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.calendar(rangeStart, rangeEnd)
      setEvents(result.events)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to load calendar', 'error')
    } finally {
      setLoading(false)
    }
  }, [rangeEnd, rangeStart, toast])

  useEffect(() => { load() }, [load])

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const dayEvents = grouped.get(event.date) ?? []
      dayEvents.push(event)
      grouped.set(event.date, dayEvents)
    }
    return grouped
  }, [events])

  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return { date: day, key: dateKey(day), inMonth: day.getMonth() === viewMonth.getMonth() }
  })

  const todayKey = dateKey(new Date())
  const monthEvents = events
    .filter((event) => event.date.startsWith(monthKey))
    .filter((event) => monthKey !== todayKey.slice(0, 7) || event.date >= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date) || (left.time ?? '').localeCompare(right.time ?? ''))

  return (
    <AppShell>
      <Topbar title="Calendar" showSync={false} />
      <main className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 animate-fade-in">
        <div>
          <h2 className="section-title">Your academic calendar</h2>
          <p className="mt-1 text-sm text-white/45">
            Dates from class updates, meeting notes, deadlines, and exams appear here automatically.
          </p>
        </div>

        <section className="glass-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                <CalendarDays size={18} />
              </div>
              <h3 className="text-base font-semibold text-white/90">{monthLabel}</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                aria-label="Previous month"
                className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                aria-label="Next month"
                className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : (
            <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-white/[0.06]">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="border-b border-white/[0.06] bg-white/[0.025] py-2 text-center text-[11px] font-medium text-white/40">
                  {weekday}
                </div>
              ))}
              {calendarDays.map(({ date, key, inMonth }) => {
                const dayEvents = eventsByDate.get(key) ?? []
                return (
                  <div
                    key={key}
                    className={cn(
                      'min-h-20 border-b border-r border-white/[0.05] p-1.5 sm:min-h-24 sm:p-2',
                      !inMonth && 'bg-black/[0.08]',
                    )}
                  >
                    <span className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      key === todayKey ? 'bg-violet-500 text-white' : inMonth ? 'text-white/70' : 'text-white/25',
                    )}>
                      {date.getDate()}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          title={`${event.title}${event.all_day ? ' · All day' : ` · ${event.time}`}`}
                          className={cn('truncate rounded px-1 py-0.5 text-[10px] capitalize', itemTypeColor(event.type))}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="px-1 text-[10px] text-white/35">+{dayEvents.length - 2} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-white/80">
            {monthKey === todayKey.slice(0, 7) ? 'Upcoming this month' : `Events in ${monthLabel}`}
            <span className="ml-2 text-xs font-normal text-white/35">{monthEvents.length}</span>
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Spinner /></div>
          ) : monthEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="Nothing scheduled"
              description="Dated class updates, deadlines, and exams will appear here after they are found in Gmail or meeting notes."
            />
          ) : (
            <div className="space-y-2">
              {monthEvents.map((event) => (
                <article key={event.id} className="glass-card flex items-start gap-3 p-4 sm:gap-4">
                  <div className="min-w-12 rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
                    <span className="block text-[10px] uppercase text-white/40">{displayDate(event.date, { month: 'short' })}</span>
                    <span className="block text-lg font-semibold leading-tight text-white/85">{Number(event.date.slice(8, 10))}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-white/90">{event.title}</h4>
                      <span className={cn('capitalize', itemTypeColor(event.type))}>{eventTypeLabel(event.type)}</span>
                    </div>
                    {event.description && <p className="mt-1 text-sm leading-relaxed text-white/50">{event.description}</p>}
                    <CalendarEventDetails event={event} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  )
}

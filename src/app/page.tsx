'use client'

import Link from 'next/link'
import { ArrowRight, Bell, BookOpen, CalendarDays } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import Topbar from '@/components/layout/Topbar'

const mainSections = [
  {
    href: '/plan',
    title: 'Study Plan',
    description: 'See what to study next and keep track of your sessions.',
    detail: 'Your sessions, in one clear plan',
    icon: <BookOpen size={22} />,
    accent: 'text-violet-300 bg-violet-500/15',
  },
  {
    href: '/alerts',
    title: 'Alerts',
    description: 'Keep up with class changes, reminders, deadlines, and exams.',
    detail: 'Important updates, all in one place',
    icon: <Bell size={22} />,
    accent: 'text-cyan-300 bg-cyan-500/15',
  },
]

export default function HomePage() {
  return (
    <AppShell>
      <Topbar title="Home" showSync={false} />
      <main className="flex-1 overflow-y-auto p-5 sm:p-8">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center py-8">
          <div className="mb-8 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
              <CalendarDays size={14} className="text-violet-300" />
              Your student workspace
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Your study, in sync.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/50 sm:text-base">
              Focus on your study plan and the updates that matter. Choose where you want to start.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {mainSections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="glass-card-hover group flex min-h-52 flex-col p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${section.accent}`}>
                    {section.icon}
                  </span>
                  <ArrowRight
                    size={18}
                    className="mt-1 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/70"
                  />
                </div>
                <div className="mt-6">
                  <p className="text-lg font-semibold text-white/90">{section.title}</p>
                  <p className="mt-1 text-sm leading-5 text-white/50">{section.description}</p>
                </div>
                <p className="mt-auto pt-5 text-xs font-medium text-white/35">{section.detail}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </AppShell>
  )
}

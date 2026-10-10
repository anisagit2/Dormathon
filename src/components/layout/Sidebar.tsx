'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen, Bell, CalendarDays, Settings, GraduationCap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { href: '/plan', label: 'Study Plan', icon: <BookOpen size={18} /> },
  { href: '/alerts', label: 'Alerts', icon: <Bell size={18} /> },
  { href: '/calendar', label: 'Calendar', icon: <CalendarDays size={18} /> },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-white/[0.05] bg-navy-900/80 backdrop-blur-xl sm:w-60">
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-white/[0.05] px-2 py-5 sm:justify-start sm:gap-3 sm:px-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-glow-violet">
          <GraduationCap size={16} className="text-white" />
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-bold text-white leading-none">ReCap</p>
          <p className="text-[10px] text-white/40 mt-0.5">Study Assistant</p>
        </div>
      </div>

      {/* Main nav */}
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4 sm:px-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className={cn(
              isActive(item.href) ? 'sidebar-item-active' : 'sidebar-item',
              'justify-center px-2 sm:justify-start sm:px-3'
            )}
          >
            <span className={isActive(item.href) ? 'text-violet-400' : 'text-white/40'}>
              {item.icon}
            </span>
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Keep settings available without making it a primary section. */}
      <div className="border-t border-white/[0.05] px-2 py-3 sm:px-3">
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          className={cn(
            isActive('/settings') ? 'sidebar-item-active' : 'sidebar-item',
            'justify-center px-2 sm:justify-start sm:px-3'
          )}
        >
          <span className={isActive('/settings') ? 'text-violet-400' : 'text-white/40'}>
            <Settings size={18} />
          </span>
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </div>
    </aside>
  )
}

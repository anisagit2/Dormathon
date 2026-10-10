'use client'
import { ToastProvider } from '@/components/ui/ToastProvider'
import Sidebar from '@/components/layout/Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="orb w-96 h-96 bg-violet-600/10 -top-32 -left-32" />
        <div className="orb w-80 h-80 bg-cyan-600/8 top-1/2 -right-20" />
        <div className="orb w-64 h-64 bg-violet-800/8 bottom-10 left-1/3" />
      </div>

      {/* Layout grid */}
      <div className="relative z-10 flex h-dvh">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </ToastProvider>
  )
}
